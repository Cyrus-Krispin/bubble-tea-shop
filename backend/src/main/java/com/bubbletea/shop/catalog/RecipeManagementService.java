package com.bubbletea.shop.catalog;

import com.bubbletea.shop.identity.StaffContextService;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class RecipeManagementService {
    private final JdbcClient jdbc;
    private final CatalogStaffAccessService access;

    public RecipeManagementService(JdbcClient jdbc, CatalogStaffAccessService access) {
        this.jdbc = jdbc;
        this.access = access;
    }

    @Transactional
    public RecipeDetail create(UUID subject, UUID organizationId, CreateRecipe command) {
        StaffContextService.StaffContext context = access.authorize(subject, organizationId);
        String name = normalizeName(command.name());
        String description = normalizeDescription(command.description());
        Recipe recipe = jdbc.sql("""
                INSERT INTO recipe (organization_id, name, description)
                VALUES (:organizationId, :name, :description)
                RETURNING id, name, description, version, archived_at, created_at, updated_at
                """)
            .param("organizationId", organizationId).param("name", name)
            .param("description", description, Types.VARCHAR).query(this::mapRecipe).single();
        UUID versionId = jdbc.sql("""
                INSERT INTO recipe_version (
                    organization_id, recipe_id, version_number, created_by_account_id
                ) VALUES (:organizationId, :recipeId, 1, :accountId)
                RETURNING id
                """)
            .param("organizationId", organizationId).param("recipeId", recipe.id())
            .param("accountId", context.accountId()).query(UUID.class).single();
        audit(organizationId, "RECIPE", recipe.id(), "CREATE", context.accountId());
        audit(organizationId, "RECIPE_VERSION", versionId, "CREATE_VERSION", context.accountId());
        return detailUnchecked(organizationId, recipe.id());
    }

    @Transactional(readOnly = true)
    public RecipePage list(UUID subject, UUID organizationId, int page, int size, String query,
                           boolean includeArchived) {
        access.authorize(subject, organizationId);
        String pattern = query == null || query.isBlank() ? null
            : "%" + escapeLike(query.trim().toLowerCase(Locale.ROOT)) + "%";
        long total = jdbc.sql("""
                SELECT count(*) FROM recipe
                 WHERE organization_id = :organizationId
                   AND (:includeArchived OR archived_at IS NULL)
                   AND (:query IS NULL OR lower(name) LIKE :query ESCAPE '\\')
                """).param("organizationId", organizationId)
            .param("includeArchived", includeArchived).param("query", pattern, Types.VARCHAR)
            .query(Long.class).single();
        List<RecipeSummary> items = jdbc.sql("""
                SELECT r.id, r.name, r.description, r.version, r.archived_at,
                       latest.version_number, latest.status
                  FROM recipe r
                  JOIN LATERAL (
                       SELECT rv.version_number, rv.status FROM recipe_version rv
                        WHERE rv.recipe_id = r.id ORDER BY rv.version_number DESC LIMIT 1
                  ) latest ON true
                 WHERE r.organization_id = :organizationId
                   AND (:includeArchived OR r.archived_at IS NULL)
                   AND (:query IS NULL OR lower(r.name) LIKE :query ESCAPE '\\')
              ORDER BY lower(r.name), r.id LIMIT :size OFFSET :offset
                """).param("organizationId", organizationId)
            .param("includeArchived", includeArchived).param("query", pattern, Types.VARCHAR)
            .param("size", size).param("offset", (long) page * size)
            .query((rs, row) -> new RecipeSummary(rs.getObject("id", UUID.class),
                rs.getString("name"), rs.getString("description"), rs.getLong("version"),
                rs.getTimestamp("archived_at") != null, rs.getInt("version_number"),
                rs.getString("status"))).list();
        return new RecipePage(items, page, size, total,
            total == 0 ? 0 : (total + size - 1) / size);
    }

    @Transactional(readOnly = true)
    public RecipeDetail detail(UUID subject, UUID organizationId, UUID recipeId) {
        access.authorize(subject, organizationId);
        return detailUnchecked(organizationId, recipeId);
    }

    @Transactional
    public RecipeDetail update(UUID subject, UUID organizationId, UUID recipeId,
                               UpdateRecipe command) {
        StaffContextService.StaffContext context = access.authorize(subject, organizationId);
        int changed = jdbc.sql("""
                UPDATE recipe SET name = :name, description = :description,
                       version = version + 1, updated_at = now()
                 WHERE id = :recipeId AND organization_id = :organizationId
                   AND archived_at IS NULL AND version = :version
                """).param("name", normalizeName(command.name()))
            .param("description", normalizeDescription(command.description()), Types.VARCHAR)
            .param("recipeId", recipeId).param("organizationId", organizationId)
            .param("version", command.version()).update();
        if (changed == 0) throw recipeMutationFailure(organizationId, recipeId);
        audit(organizationId, "RECIPE", recipeId, "UPDATE", context.accountId());
        return detailUnchecked(organizationId, recipeId);
    }

    @Transactional
    public RecipeDetail archive(UUID subject, UUID organizationId, UUID recipeId, long version) {
        StaffContextService.StaffContext context = access.authorize(subject, organizationId);
        Recipe current = findRecipe(organizationId, recipeId, false);
        if (current.archived()) return detailUnchecked(organizationId, recipeId);
        if (current.version() != version) throw new RecipeVersionConflictException();
        if (hasAvailableOffering(organizationId, recipeId, null)) {
            throw new RecipeStateConflictException();
        }
        int changed;
        try {
            changed = jdbc.sql("""
                    UPDATE recipe SET archived_at = now(), version = version + 1, updated_at = now()
                     WHERE id = :recipeId AND organization_id = :organizationId
                       AND archived_at IS NULL AND version = :version
                    """).param("recipeId", recipeId).param("organizationId", organizationId)
                .param("version", version).update();
        } catch (DataIntegrityViolationException exception) {
            throw new RecipeStateConflictException();
        }
        if (changed == 0) throw recipeMutationFailure(organizationId, recipeId);
        audit(organizationId, "RECIPE", recipeId, "ARCHIVE", context.accountId());
        return detailUnchecked(organizationId, recipeId);
    }

    @Transactional
    public RecipeVersion createVersion(UUID subject, UUID organizationId, UUID recipeId,
                                       CreateVersion command) {
        StaffContextService.StaffContext context = access.authorize(subject, organizationId);
        Recipe recipe = findRecipe(organizationId, recipeId, true);
        if (recipe.archived()) throw new RecipeStateConflictException();
        if (recipe.version() != command.version()) throw new RecipeVersionConflictException();
        boolean draftExists = jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM recipe_version WHERE recipe_id = :recipeId AND status = 'DRAFT')
                """).param("recipeId", recipeId).query(Boolean.class).single();
        if (draftExists) throw new RecipeStateConflictException();
        UUID sourceId = command.sourceVersionId();
        if (sourceId == null) {
            sourceId = jdbc.sql("""
                    SELECT id FROM recipe_version
                     WHERE recipe_id = :recipeId AND status = 'PUBLISHED'
                  ORDER BY version_number DESC LIMIT 1
                    """).param("recipeId", recipeId).query(UUID.class).optional().orElse(null);
        } else {
            boolean validSource = jdbc.sql("""
                    SELECT EXISTS(
                        SELECT 1 FROM recipe_version
                         WHERE id = :sourceId AND recipe_id = :recipeId
                           AND organization_id = :organizationId AND status <> 'DRAFT'
                    )
                    """).param("sourceId", sourceId).param("recipeId", recipeId)
                .param("organizationId", organizationId).query(Boolean.class).single();
            if (!validSource) throw new RecipeNotFoundException();
        }
        int number = jdbc.sql("""
                SELECT coalesce(max(version_number), 0) + 1 FROM recipe_version WHERE recipe_id = :recipeId
                """).param("recipeId", recipeId).query(Integer.class).single();
        UUID versionId = jdbc.sql("""
                INSERT INTO recipe_version (
                    organization_id, recipe_id, version_number, created_by_account_id
                ) VALUES (:organizationId, :recipeId, :number, :accountId) RETURNING id
                """).param("organizationId", organizationId).param("recipeId", recipeId)
            .param("number", number).param("accountId", context.accountId())
            .query(UUID.class).single();
        if (sourceId != null) {
            List<Boolean> archivedIngredients = jdbc.sql("""
                    SELECT ingredient.archived_at IS NOT NULL
                      FROM recipe_component component
                      JOIN ingredient ingredient ON ingredient.id = component.ingredient_id
                     WHERE component.recipe_version_id = :sourceId
                  ORDER BY ingredient.id
                     FOR SHARE OF ingredient
                    """).param("sourceId", sourceId).query(Boolean.class).list();
            if (archivedIngredients.stream().anyMatch(Boolean::booleanValue)) {
                throw new RecipeStateConflictException();
            }
            jdbc.sql("""
                    INSERT INTO recipe_component (
                        organization_id, recipe_version_id, ingredient_id, quantity
                    )
                    SELECT organization_id, :versionId, ingredient_id, quantity
                      FROM recipe_component WHERE recipe_version_id = :sourceId
                    """).param("versionId", versionId).param("sourceId", sourceId).update();
        }
        jdbc.sql("UPDATE recipe SET version = version + 1, updated_at = now() WHERE id = :recipeId")
            .param("recipeId", recipeId).update();
        audit(organizationId, "RECIPE_VERSION", versionId, "CREATE_VERSION", context.accountId());
        return versionUnchecked(organizationId, recipeId, versionId);
    }

    @Transactional
    public RecipeVersion replaceDraft(UUID subject, UUID organizationId, UUID recipeId,
                                      UUID versionId, UpdateDraft command) {
        StaffContextService.StaffContext context = access.authorize(subject, organizationId);
        ensureRecipeActive(organizationId, recipeId);
        VersionState current = versionState(organizationId, recipeId, versionId);
        if (!current.status().equals("DRAFT")) throw new RecipeStateConflictException();
        if (current.version() != command.version()) throw new RecipeVersionConflictException();
        List<NormalizedComponent> components = normalizeComponents(
            organizationId, command.components());
        int changed = jdbc.sql("""
                UPDATE recipe_version SET version = version + 1
                 WHERE id = :versionId AND recipe_id = :recipeId
                   AND organization_id = :organizationId AND status = 'DRAFT'
                   AND version = :version
                """)
            .param("versionId", versionId).param("recipeId", recipeId)
            .param("organizationId", organizationId).param("version", command.version()).update();
        if (changed == 0) throw mutationFailure(organizationId, recipeId, versionId, "DRAFT");
        jdbc.sql("DELETE FROM recipe_component WHERE recipe_version_id = :versionId")
            .param("versionId", versionId).update();
        for (NormalizedComponent component : components) {
            jdbc.sql("""
                    INSERT INTO recipe_component (
                        organization_id, recipe_version_id, ingredient_id, quantity
                    ) VALUES (:organizationId, :versionId, :ingredientId, :quantity)
                    """)
                .param("organizationId", organizationId).param("versionId", versionId)
                .param("ingredientId", component.ingredientId())
                .param("quantity", component.quantity()).update();
        }
        audit(organizationId, "RECIPE_VERSION", versionId, "UPDATE_DRAFT", context.accountId());
        return versionUnchecked(organizationId, recipeId, versionId);
    }

    @Transactional
    public RecipeVersion publish(UUID subject, UUID organizationId, UUID recipeId,
                                 UUID versionId, long version) {
        StaffContextService.StaffContext context = access.authorize(subject, organizationId);
        ensureRecipeActive(organizationId, recipeId);
        VersionState current = versionState(organizationId, recipeId, versionId);
        if (!current.status().equals("DRAFT")) throw new RecipeStateConflictException();
        if (current.version() != version) throw new RecipeVersionConflictException();
        long components = jdbc.sql("""
                SELECT count(*) FROM recipe_component WHERE recipe_version_id = :versionId
                """).param("versionId", versionId).query(Long.class).single();
        if (components == 0) throw new RecipeStateConflictException();
        boolean containsArchivedIngredient = jdbc.sql("""
                SELECT EXISTS(
                    SELECT 1
                      FROM recipe_component component
                      JOIN ingredient ingredient ON ingredient.id = component.ingredient_id
                     WHERE component.recipe_version_id = :versionId
                       AND ingredient.archived_at IS NOT NULL
                )
                """).param("versionId", versionId).query(Boolean.class).single();
        if (containsArchivedIngredient) throw new RecipeStateConflictException();
        int changed = jdbc.sql("""
                UPDATE recipe_version
                   SET status = 'PUBLISHED', published_at = now(), version = version + 1
                 WHERE id = :versionId AND recipe_id = :recipeId
                   AND organization_id = :organizationId AND status = 'DRAFT'
                   AND version = :version
                """)
            .param("versionId", versionId).param("recipeId", recipeId)
            .param("organizationId", organizationId).param("version", version).update();
        if (changed == 0) throw mutationFailure(organizationId, recipeId, versionId, "DRAFT");
        audit(organizationId, "RECIPE_VERSION", versionId, "PUBLISH", context.accountId());
        return versionUnchecked(organizationId, recipeId, versionId);
    }

    @Transactional
    public RecipeVersion retire(UUID subject, UUID organizationId, UUID recipeId,
                                UUID versionId, long version) {
        StaffContextService.StaffContext context = access.authorize(subject, organizationId);
        VersionState current = versionState(organizationId, recipeId, versionId);
        if (!current.status().equals("PUBLISHED")) throw new RecipeStateConflictException();
        if (current.version() != version) throw new RecipeVersionConflictException();
        if (hasAvailableOffering(organizationId, recipeId, versionId)) {
            throw new RecipeStateConflictException();
        }
        int changed;
        try {
            changed = jdbc.sql("""
                    UPDATE recipe_version SET status = 'RETIRED', version = version + 1
                     WHERE id = :versionId AND recipe_id = :recipeId
                       AND organization_id = :organizationId AND status = 'PUBLISHED'
                       AND version = :version
                    """).param("versionId", versionId).param("recipeId", recipeId)
                .param("organizationId", organizationId).param("version", version).update();
        } catch (DataIntegrityViolationException exception) {
            throw new RecipeStateConflictException();
        }
        if (changed == 0) throw mutationFailure(organizationId, recipeId, versionId, "PUBLISHED");
        audit(organizationId, "RECIPE_VERSION", versionId, "RETIRE", context.accountId());
        return versionUnchecked(organizationId, recipeId, versionId);
    }

    private List<NormalizedComponent> normalizeComponents(UUID organizationId,
                                                           List<ComponentInput> inputs) {
        Set<UUID> ids = new HashSet<>();
        List<NormalizedComponent> components = new ArrayList<>(inputs.size());
        for (ComponentInput input : inputs) {
            if (!ids.add(input.ingredientId())) throw new InvalidRecipeException();
            BigDecimal quantity;
            try {
                quantity = new BigDecimal(input.quantity()).setScale(6, RoundingMode.UNNECESSARY);
            } catch (ArithmeticException | NumberFormatException exception) {
                throw new InvalidRecipeException();
            }
            if (quantity.signum() <= 0 || quantity.precision() > 19) {
                throw new InvalidRecipeException();
            }
            components.add(new NormalizedComponent(input.ingredientId(), quantity));
        }
        if (!ids.isEmpty()) {
            List<UUID> activeIngredients = jdbc.sql("""
                    SELECT id FROM ingredient
                     WHERE organization_id = :organizationId AND archived_at IS NULL
                       AND id IN (:ingredientIds)
                  ORDER BY id
                     FOR SHARE
                    """).param("organizationId", organizationId).param("ingredientIds", ids)
                .query(UUID.class).list();
            if (activeIngredients.size() != ids.size()) throw new InvalidRecipeException();
        }
        return List.copyOf(components);
    }

    private RecipeDetail detailUnchecked(UUID organizationId, UUID recipeId) {
        Recipe recipe = jdbc.sql("""
                SELECT id, name, description, version, archived_at, created_at, updated_at
                  FROM recipe WHERE id = :recipeId AND organization_id = :organizationId
                """).param("recipeId", recipeId).param("organizationId", organizationId)
            .query(this::mapRecipe).optional().orElseThrow(RecipeNotFoundException::new);
        List<VersionData> versionData = jdbc.sql("""
                SELECT id, version_number, status, version, created_at, published_at
                  FROM recipe_version
                 WHERE recipe_id = :recipeId AND organization_id = :organizationId
              ORDER BY version_number DESC
                """).param("recipeId", recipeId).param("organizationId", organizationId)
            .query(this::mapVersionData).list();
        Map<UUID, List<RecipeComponent>> componentsByVersion = new HashMap<>();
        jdbc.sql("""
                SELECT component.recipe_version_id, component.ingredient_id,
                       ingredient.name, ingredient.base_unit, component.quantity
                  FROM recipe_component component
                  JOIN recipe_version version ON version.id = component.recipe_version_id
                  JOIN ingredient ingredient ON ingredient.id = component.ingredient_id
                 WHERE version.recipe_id = :recipeId
                   AND version.organization_id = :organizationId
              ORDER BY version.version_number DESC, lower(ingredient.name), ingredient.id
                """).param("recipeId", recipeId).param("organizationId", organizationId)
            .query((rs, row) -> new VersionComponent(
                rs.getObject("recipe_version_id", UUID.class), mapComponent(rs))).list()
            .forEach(component -> componentsByVersion
                .computeIfAbsent(component.versionId(), ignored -> new ArrayList<>())
                .add(component.component()));
        List<RecipeVersion> versions = versionData.stream()
            .map(version -> toRecipeVersion(version,
                componentsByVersion.getOrDefault(version.id(), List.of())))
            .toList();
        return new RecipeDetail(recipe.id(), recipe.name(), recipe.description(), recipe.version(),
            recipe.archived(), recipe.createdAt(), recipe.updatedAt(), versions);
    }

    private RecipeVersion versionUnchecked(UUID organizationId, UUID recipeId, UUID versionId) {
        VersionData version = jdbc.sql("""
                SELECT id, version_number, status, version, created_at, published_at
                  FROM recipe_version
                 WHERE id = :versionId AND recipe_id = :recipeId
                   AND organization_id = :organizationId
                """).param("versionId", versionId).param("recipeId", recipeId)
            .param("organizationId", organizationId)
            .query(this::mapVersionData).optional()
            .orElseThrow(RecipeNotFoundException::new);
        return toRecipeVersion(version, componentsForVersion(versionId));
    }

    private List<RecipeComponent> componentsForVersion(UUID versionId) {
        return jdbc.sql("""
                SELECT rc.ingredient_id, i.name, i.base_unit, rc.quantity
                  FROM recipe_component rc
                  JOIN ingredient i ON i.id = rc.ingredient_id
                 WHERE rc.recipe_version_id = :versionId
              ORDER BY lower(i.name), i.id
                """).param("versionId", versionId).query((rs, row) -> mapComponent(rs)).list();
    }

    private RecipeComponent mapComponent(ResultSet rs) throws SQLException {
        BigDecimal quantity = rs.getBigDecimal("quantity");
        return new RecipeComponent(rs.getObject("ingredient_id", UUID.class), rs.getString("name"),
            BaseUnit.valueOf(rs.getString("base_unit")), quantity.toPlainString());
    }

    private VersionData mapVersionData(ResultSet rs, int rowNumber) throws SQLException {
        return new VersionData(rs.getObject("id", UUID.class), rs.getInt("version_number"),
            rs.getString("status"), rs.getLong("version"),
            rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("published_at") == null
                ? null : rs.getTimestamp("published_at").toInstant());
    }

    private RecipeVersion toRecipeVersion(VersionData version, List<RecipeComponent> components) {
        return new RecipeVersion(version.id(), version.versionNumber(), version.status(),
            version.version(), version.createdAt(), version.publishedAt(), components);
    }

    private VersionState versionState(UUID organizationId, UUID recipeId, UUID versionId) {
        return jdbc.sql("""
                SELECT status, version FROM recipe_version
                 WHERE id = :versionId AND recipe_id = :recipeId AND organization_id = :organizationId
                """).param("versionId", versionId).param("recipeId", recipeId)
            .param("organizationId", organizationId)
            .query((rs, row) -> new VersionState(rs.getString("status"), rs.getLong("version")))
            .optional().orElseThrow(RecipeNotFoundException::new);
    }

    private RuntimeException mutationFailure(UUID organizationId, UUID recipeId, UUID versionId,
                                             String expectedStatus) {
        VersionState current = versionState(organizationId, recipeId, versionId);
        return current.status().equals(expectedStatus)
            ? new RecipeVersionConflictException() : new RecipeStateConflictException();
    }

    private Recipe findRecipe(UUID organizationId, UUID recipeId, boolean lock) {
        String suffix = lock ? " FOR UPDATE" : "";
        return jdbc.sql("""
                SELECT id, name, description, version, archived_at, created_at, updated_at
                  FROM recipe WHERE id = :recipeId AND organization_id = :organizationId
                """ + suffix).param("recipeId", recipeId).param("organizationId", organizationId)
            .query(this::mapRecipe).optional().orElseThrow(RecipeNotFoundException::new);
    }

    private RuntimeException recipeMutationFailure(UUID organizationId, UUID recipeId) {
        Recipe current = findRecipe(organizationId, recipeId, false);
        return current.archived() ? new RecipeStateConflictException()
            : new RecipeVersionConflictException();
    }

    private void ensureRecipeActive(UUID organizationId, UUID recipeId) {
        if (findRecipe(organizationId, recipeId, true).archived()) {
            throw new RecipeStateConflictException();
        }
    }

    private boolean hasAvailableOffering(UUID organizationId, UUID recipeId, UUID versionId) {
        if (versionId == null) {
            return jdbc.sql("""
                    SELECT EXISTS(
                        SELECT 1 FROM menu_variant_offering o
                        JOIN recipe_version rv ON rv.id = o.recipe_version_id
                         WHERE o.organization_id = :organizationId AND rv.recipe_id = :recipeId
                           AND o.available
                    )
                    """).param("organizationId", organizationId).param("recipeId", recipeId)
                .query(Boolean.class).single();
        }
        return jdbc.sql("""
                SELECT EXISTS(
                    SELECT 1 FROM menu_variant_offering o
                    JOIN recipe_version rv ON rv.id = o.recipe_version_id
                     WHERE o.organization_id = :organizationId AND rv.recipe_id = :recipeId
                       AND rv.id = :versionId AND o.available
                )
                """).param("organizationId", organizationId).param("recipeId", recipeId)
            .param("versionId", versionId).query(Boolean.class).single();
    }

    private Recipe mapRecipe(ResultSet rs, int rowNumber) throws SQLException {
        return new Recipe(rs.getObject("id", UUID.class), rs.getString("name"),
            rs.getString("description"), rs.getLong("version"),
            rs.getTimestamp("archived_at") != null, rs.getTimestamp("created_at").toInstant(),
            rs.getTimestamp("updated_at").toInstant());
    }

    private String normalizeName(String raw) {
        String value = raw.trim();
        if (value.isBlank()) throw new InvalidRecipeException();
        return value;
    }

    private String normalizeDescription(String raw) {
        return raw == null || raw.isBlank() ? null : raw.trim();
    }

    private String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private void audit(UUID organizationId, String entityType, UUID entityId, String action,
                       UUID actorId) {
        jdbc.sql("""
                INSERT INTO catalog_change (
                    organization_id, entity_type, entity_id, action, actor_account_id
                ) VALUES (:organizationId, :entityType, :entityId, :action, :actorId)
                """).param("organizationId", organizationId).param("entityType", entityType)
            .param("entityId", entityId).param("action", action).param("actorId", actorId).update();
    }

    private record Recipe(UUID id, String name, String description, long version, boolean archived,
                          Instant createdAt, Instant updatedAt) { }
    private record VersionState(String status, long version) { }
    private record VersionData(UUID id, int versionNumber, String status, long version,
                               Instant createdAt, Instant publishedAt) { }
    private record VersionComponent(UUID versionId, RecipeComponent component) { }
    private record NormalizedComponent(UUID ingredientId, BigDecimal quantity) { }
    public record CreateRecipe(String name, String description) { }
    public record UpdateRecipe(String name, String description, long version) { }
    public record CreateVersion(long version, UUID sourceVersionId) { }
    public record ComponentInput(UUID ingredientId, String quantity) { }
    public record UpdateDraft(long version, List<ComponentInput> components) {
        public UpdateDraft { components = List.copyOf(components); }
    }
    public record RecipeDetail(UUID id, String name, @Schema(nullable = true) String description,
                               long version, boolean archived, Instant createdAt, Instant updatedAt,
                               List<RecipeVersion> versions) {
        public RecipeDetail { versions = List.copyOf(versions); }
    }
    public record RecipeSummary(UUID id, String name, @Schema(nullable = true) String description,
                                long version, boolean archived, int latestVersionNumber,
                                String latestStatus) { }
    public record RecipePage(List<RecipeSummary> items, int page, int size, long totalItems,
                             long totalPages) {
        public RecipePage { items = List.copyOf(items); }
    }
    public record RecipeVersion(UUID id, int versionNumber,
                                @Schema(allowableValues = {"DRAFT", "PUBLISHED", "RETIRED"})
                                String status, long version,
                                Instant createdAt, @Schema(nullable = true) Instant publishedAt,
                                List<RecipeComponent> components) {
        public RecipeVersion { components = List.copyOf(components); }
    }
    public record RecipeComponent(UUID ingredientId, String ingredientName, BaseUnit baseUnit,
                                  String quantity) { }
}
