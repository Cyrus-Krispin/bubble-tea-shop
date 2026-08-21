package com.bubbletea.shop.catalog;

import com.bubbletea.shop.identity.StaffAccessDeniedException;
import com.bubbletea.shop.identity.StaffContextService;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class IngredientManagementService {
    private final JdbcClient jdbc;
    private final StaffContextService staffContext;

    public IngredientManagementService(JdbcClient jdbc, StaffContextService staffContext) {
        this.jdbc = jdbc;
        this.staffContext = staffContext;
    }

    @Transactional(readOnly = true)
    public IngredientPage list(UUID subject, UUID organizationId, int page, int size,
                               String query, boolean includeArchived) {
        authorize(subject, organizationId);
        String pattern = query == null || query.isBlank()
            ? null : "%" + escapeLike(query.trim().toLowerCase(Locale.ROOT)) + "%";
        long total = jdbc.sql("""
                SELECT count(*) FROM ingredient
                 WHERE organization_id = :organizationId
                   AND (:includeArchived OR archived_at IS NULL)
                   AND (:query IS NULL OR lower(name) LIKE :query ESCAPE '\\'
                        OR lower(coalesce(sku, '')) LIKE :query ESCAPE '\\')
                """)
            .param("organizationId", organizationId).param("includeArchived", includeArchived)
            .param("query", pattern, Types.VARCHAR).query(Long.class).single();
        List<Ingredient> items = jdbc.sql("""
                SELECT id, name, sku, base_unit, reorder_threshold, version,
                       archived_at, created_at, updated_at
                  FROM ingredient
                 WHERE organization_id = :organizationId
                   AND (:includeArchived OR archived_at IS NULL)
                   AND (:query IS NULL OR lower(name) LIKE :query ESCAPE '\\'
                        OR lower(coalesce(sku, '')) LIKE :query ESCAPE '\\')
              ORDER BY lower(name), id LIMIT :size OFFSET :offset
                """)
            .param("organizationId", organizationId).param("includeArchived", includeArchived)
            .param("query", pattern, Types.VARCHAR).param("size", size)
            .param("offset", (long) page * size).query(this::map).list();
        return new IngredientPage(items, page, size, total,
            total == 0 ? 0 : (total + size - 1) / size);
    }

    @Transactional
    public Ingredient create(UUID subject, UUID organizationId, CreateIngredient command) {
        StaffContextService.StaffContext context = authorize(subject, organizationId);
        Normalized values = normalize(command.name(), command.sku(), command.reorderThreshold());
        Ingredient created = jdbc.sql("""
                INSERT INTO ingredient (organization_id, name, sku, base_unit, reorder_threshold)
                VALUES (:organizationId, :name, :sku, :baseUnit, :threshold)
                RETURNING id, name, sku, base_unit, reorder_threshold, version,
                          archived_at, created_at, updated_at
                """)
            .param("organizationId", organizationId).param("name", values.name())
            .param("sku", values.sku(), Types.VARCHAR).param("baseUnit", command.baseUnit().name())
            .param("threshold", values.threshold(), Types.NUMERIC).query(this::map).single();
        audit(organizationId, created.id(), "CREATE", context.accountId());
        return created;
    }

    @Transactional
    public Ingredient update(UUID subject, UUID organizationId, UUID ingredientId,
                             UpdateIngredient command) {
        StaffContextService.StaffContext context = authorize(subject, organizationId);
        Normalized values = normalize(command.name(), command.sku(), command.reorderThreshold());
        Ingredient updated = jdbc.sql("""
                UPDATE ingredient SET name = :name, sku = :sku, reorder_threshold = :threshold,
                       version = version + 1, updated_at = now()
                 WHERE id = :id AND organization_id = :organizationId
                   AND version = :version AND archived_at IS NULL
                RETURNING id, name, sku, base_unit, reorder_threshold, version,
                          archived_at, created_at, updated_at
                """)
            .param("name", values.name()).param("sku", values.sku(), Types.VARCHAR)
            .param("threshold", values.threshold(), Types.NUMERIC).param("id", ingredientId)
            .param("organizationId", organizationId).param("version", command.version())
            .query(this::map).optional().orElseThrow(() -> mutationFailure(organizationId, ingredientId));
        audit(organizationId, ingredientId, "UPDATE", context.accountId());
        return updated;
    }

    @Transactional
    public Ingredient archive(UUID subject, UUID organizationId, UUID ingredientId, long version) {
        StaffContextService.StaffContext context = authorize(subject, organizationId);
        Ingredient current = find(organizationId, ingredientId);
        if (current.archived()) return current;
        if (current.version() != version) throw new IngredientVersionConflictException();
        Ingredient archived = jdbc.sql("""
                UPDATE ingredient SET archived_at = now(), version = version + 1, updated_at = now()
                 WHERE id = :id AND organization_id = :organizationId
                   AND version = :version AND archived_at IS NULL
                RETURNING id, name, sku, base_unit, reorder_threshold, version,
                          archived_at, created_at, updated_at
                """)
            .param("id", ingredientId).param("organizationId", organizationId)
            .param("version", version).query(this::map).optional()
            .orElseThrow(IngredientVersionConflictException::new);
        audit(organizationId, ingredientId, "ARCHIVE", context.accountId());
        return archived;
    }

    private StaffContextService.StaffContext authorize(UUID subject, UUID organizationId) {
        StaffContextService.StaffContext context = staffContext.resolve(subject);
        boolean allowed = context.memberships().stream().anyMatch(membership ->
            membership.organizationId().equals(organizationId)
                && (membership.role() == StaffContextService.StaffRole.OWNER
                    || !membership.locations().isEmpty()));
        if (!allowed) throw new StaffAccessDeniedException();
        return context;
    }

    private Ingredient find(UUID organizationId, UUID ingredientId) {
        return jdbc.sql("""
                SELECT id, name, sku, base_unit, reorder_threshold, version,
                       archived_at, created_at, updated_at FROM ingredient
                 WHERE id = :id AND organization_id = :organizationId
                """)
            .param("id", ingredientId).param("organizationId", organizationId)
            .query(this::map).optional().orElseThrow(IngredientNotFoundException::new);
    }

    private RuntimeException mutationFailure(UUID organizationId, UUID ingredientId) {
        return jdbc.sql("SELECT version FROM ingredient WHERE id = :id AND organization_id = :org")
            .param("id", ingredientId).param("org", organizationId).query(Long.class).optional()
            .<RuntimeException>map(ignored -> new IngredientVersionConflictException())
            .orElseGet(IngredientNotFoundException::new);
    }

    private Normalized normalize(String rawName, String rawSku, String rawThreshold) {
        String name = rawName.trim();
        String sku = rawSku == null || rawSku.isBlank()
            ? null : rawSku.trim().toUpperCase(Locale.ROOT);
        BigDecimal threshold;
        try {
            threshold = rawThreshold == null ? null
                : new BigDecimal(rawThreshold).setScale(6, RoundingMode.UNNECESSARY);
        } catch (ArithmeticException exception) {
            throw new InvalidIngredientException();
        }
        if (name.isBlank() || threshold != null
            && (threshold.signum() < 0 || threshold.precision() > 19)) {
            throw new InvalidIngredientException();
        }
        return new Normalized(name, sku, threshold);
    }

    private String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private Ingredient map(ResultSet rs, int rowNumber) throws SQLException {
        BigDecimal threshold = rs.getBigDecimal("reorder_threshold");
        return new Ingredient(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("sku"),
            BaseUnit.valueOf(rs.getString("base_unit")), threshold == null ? null : threshold.toPlainString(),
            rs.getLong("version"), rs.getTimestamp("archived_at") != null,
            rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant());
    }

    private void audit(UUID organizationId, UUID entityId, String action, UUID actorId) {
        jdbc.sql("""
                INSERT INTO catalog_change (organization_id, entity_type, entity_id, action, actor_account_id)
                VALUES (:organizationId, 'INGREDIENT', :entityId, :action, :actorId)
                """)
            .param("organizationId", organizationId).param("entityId", entityId)
            .param("action", action).param("actorId", actorId).update();
    }

    private record Normalized(String name, String sku, BigDecimal threshold) { }
    public record CreateIngredient(String name, String sku, BaseUnit baseUnit, String reorderThreshold) { }
    public record UpdateIngredient(String name, String sku, String reorderThreshold, long version) { }
    public record IngredientPage(List<Ingredient> items, int page, int size, long totalItems, long totalPages) {
        public IngredientPage { items = List.copyOf(items); }
    }
    public record Ingredient(UUID id, String name, @Schema(nullable = true) String sku,
                             BaseUnit baseUnit,
                             @Schema(nullable = true) String reorderThreshold,
                             long version, boolean archived,
                             Instant createdAt, Instant updatedAt) { }
}
