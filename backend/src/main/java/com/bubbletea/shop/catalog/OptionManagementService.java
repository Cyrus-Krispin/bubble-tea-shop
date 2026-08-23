package com.bubbletea.shop.catalog;

import com.bubbletea.shop.identity.StaffContextService;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.dao.DataAccessException;
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
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class OptionManagementService {
    private final JdbcClient jdbc;
    private final CatalogStaffAccessService access;

    public OptionManagementService(JdbcClient jdbc, CatalogStaffAccessService access) {
        this.jdbc = jdbc;
        this.access = access;
    }

    @Transactional(readOnly = true)
    public GroupPage list(UUID subject, UUID organizationId, int page, int size, String query,
                          boolean includeArchived) {
        access.authorize(subject, organizationId);
        String pattern = query == null || query.isBlank() ? null
            : "%" + escapeLike(query.trim().toLowerCase(Locale.ROOT)) + "%";
        long total = jdbc.sql("""
                SELECT count(*) FROM option_group
                 WHERE organization_id = :organizationId
                   AND (:includeArchived OR archived_at IS NULL)
                   AND (:query IS NULL OR lower(name) LIKE :query ESCAPE '\\')
                """).param("organizationId", organizationId)
            .param("includeArchived", includeArchived).param("query", pattern, Types.VARCHAR)
            .query(Long.class).single();
        List<GroupSummary> items = jdbc.sql("""
                SELECT group_row.id, group_row.name, group_row.minimum_selections,
                       group_row.maximum_selections, group_row.display_order, group_row.version,
                       group_row.archived_at,
                       count(choice.id) FILTER (WHERE choice.archived_at IS NULL) AS choice_count
                  FROM option_group group_row
             LEFT JOIN option_choice choice ON choice.option_group_id = group_row.id
                 WHERE group_row.organization_id = :organizationId
                   AND (:includeArchived OR group_row.archived_at IS NULL)
                   AND (:query IS NULL OR lower(group_row.name) LIKE :query ESCAPE '\\')
              GROUP BY group_row.id
              ORDER BY group_row.display_order, lower(group_row.name), group_row.id
                 LIMIT :size OFFSET :offset
                """).param("organizationId", organizationId)
            .param("includeArchived", includeArchived).param("query", pattern, Types.VARCHAR)
            .param("size", size).param("offset", (long) page * size)
            .query((rs, row) -> new GroupSummary(rs.getObject("id", UUID.class),
                rs.getString("name"), rs.getInt("minimum_selections"),
                rs.getInt("maximum_selections"), rs.getInt("display_order"),
                rs.getLong("version"), rs.getTimestamp("archived_at") != null,
                rs.getInt("choice_count"))).list();
        return new GroupPage(items, page, size, total, total == 0 ? 0 : (total + size - 1) / size);
    }

    @Transactional
    public GroupDetail createGroup(UUID subject, UUID organizationId, GroupInput input) {
        StaffContextService.StaffContext context = access.authorize(subject, organizationId);
        validateBounds(input.minimumSelections(), input.maximumSelections());
        UUID id = jdbc.sql("""
                INSERT INTO option_group (
                    organization_id, name, minimum_selections, maximum_selections, display_order
                ) VALUES (:organizationId, :name, :minimum, :maximum, :displayOrder)
                RETURNING id
                """).param("organizationId", organizationId).param("name", normalizeName(input.name()))
            .param("minimum", input.minimumSelections()).param("maximum", input.maximumSelections())
            .param("displayOrder", input.displayOrder()).query(UUID.class).single();
        audit(organizationId, "OPTION_GROUP", id, "CREATE", context.accountId());
        return detailUnchecked(organizationId, id, false);
    }

    @Transactional(readOnly = true)
    public GroupDetail detail(UUID subject, UUID organizationId, UUID groupId,
                              boolean includeArchivedChoices) {
        access.authorize(subject, organizationId);
        return detailUnchecked(organizationId, groupId, includeArchivedChoices);
    }

    @Transactional
    public GroupDetail updateGroup(UUID subject, UUID organizationId, UUID groupId,
                                   GroupInput input) {
        StaffContextService.StaffContext context = access.authorize(subject, organizationId);
        validateBounds(input.minimumSelections(), input.maximumSelections());
        lockConfiguredVariants(groupId);
        int changed = jdbc.sql("""
                UPDATE option_group SET name = :name, minimum_selections = :minimum,
                       maximum_selections = :maximum, display_order = :displayOrder,
                       version = version + 1, updated_at = now()
                 WHERE id = :groupId AND organization_id = :organizationId
                   AND archived_at IS NULL AND version = :version
                """).param("name", normalizeName(input.name()))
            .param("minimum", input.minimumSelections()).param("maximum", input.maximumSelections())
            .param("displayOrder", input.displayOrder()).param("groupId", groupId)
            .param("organizationId", organizationId).param("version", input.version()).update();
        if (changed == 0) throw groupMutationFailure(organizationId, groupId);
        validateDeferred();
        audit(organizationId, "OPTION_GROUP", groupId, "UPDATE", context.accountId());
        return detailUnchecked(organizationId, groupId, false);
    }

    @Transactional
    public GroupDetail archiveGroup(UUID subject, UUID organizationId, UUID groupId, long version) {
        StaffContextService.StaffContext context = access.authorize(subject, organizationId);
        GroupRow current = group(organizationId, groupId, true);
        if (current.archived()) return detailUnchecked(organizationId, groupId, true);
        if (current.version() != version) throw new OptionVersionConflictException();
        lockConfiguredVariants(groupId);
        try {
            jdbc.sql("""
                    UPDATE option_group SET archived_at = now(), version = version + 1,
                           updated_at = now()
                     WHERE id = :groupId AND organization_id = :organizationId
                       AND archived_at IS NULL AND version = :version
                    """).param("groupId", groupId).param("organizationId", organizationId)
                .param("version", version).update();
            validateDeferred();
        } catch (DataAccessException exception) {
            throw new OptionStateConflictException();
        }
        audit(organizationId, "OPTION_GROUP", groupId, "ARCHIVE", context.accountId());
        return detailUnchecked(organizationId, groupId, true);
    }

    @Transactional
    public GroupDetail createChoice(UUID subject, UUID organizationId, UUID groupId,
                                    ChoiceInput input) {
        StaffContextService.StaffContext context = access.authorize(subject, organizationId);
        ensureActiveGroup(organizationId, groupId);
        lockConfiguredVariants(groupId);
        if (input.defaultChoice()) clearDefaultChoice(
            organizationId, groupId, null, context.accountId());
        UUID id = jdbc.sql("""
                INSERT INTO option_choice (
                    organization_id, option_group_id, name, display_order, is_default
                ) VALUES (:organizationId, :groupId, :name, :displayOrder, :isDefault)
                RETURNING id
                """).param("organizationId", organizationId).param("groupId", groupId)
            .param("name", normalizeName(input.name())).param("displayOrder", input.displayOrder())
            .param("isDefault", input.defaultChoice()).query(UUID.class).single();
        validateDeferred();
        audit(organizationId, "OPTION_CHOICE", id, "CREATE", context.accountId());
        return detailUnchecked(organizationId, groupId, false);
    }

    @Transactional
    public GroupDetail updateChoice(UUID subject, UUID organizationId, UUID groupId, UUID choiceId,
                                    ChoiceInput input) {
        StaffContextService.StaffContext context = access.authorize(subject, organizationId);
        ensureActiveGroup(organizationId, groupId);
        ChoiceRow current = choice(organizationId, groupId, choiceId, true);
        if (current.archived()) throw new OptionStateConflictException();
        if (current.version() != input.version()) throw new OptionVersionConflictException();
        lockConfiguredVariants(groupId);
        if (input.defaultChoice()) clearDefaultChoice(
            organizationId, groupId, choiceId, context.accountId());
        int changed = jdbc.sql("""
                UPDATE option_choice SET name = :name, display_order = :displayOrder,
                       is_default = :isDefault, version = version + 1, updated_at = now()
                 WHERE id = :choiceId AND option_group_id = :groupId
                   AND organization_id = :organizationId AND archived_at IS NULL
                   AND version = :version
                """).param("name", normalizeName(input.name()))
            .param("displayOrder", input.displayOrder()).param("isDefault", input.defaultChoice())
            .param("choiceId", choiceId).param("groupId", groupId)
            .param("organizationId", organizationId).param("version", input.version()).update();
        if (changed == 0) throw choiceMutationFailure(organizationId, groupId, choiceId);
        validateDeferred();
        audit(organizationId, "OPTION_CHOICE", choiceId, "UPDATE", context.accountId());
        return detailUnchecked(organizationId, groupId, false);
    }

    @Transactional
    public GroupDetail archiveChoice(UUID subject, UUID organizationId, UUID groupId, UUID choiceId,
                                     long version) {
        StaffContextService.StaffContext context = access.authorize(subject, organizationId);
        ChoiceRow current = choice(organizationId, groupId, choiceId, true);
        if (current.archived()) return detailUnchecked(organizationId, groupId, true);
        if (current.version() != version) throw new OptionVersionConflictException();
        lockConfiguredVariants(groupId);
        try {
            jdbc.sql("""
                    UPDATE option_choice SET archived_at = now(), is_default = false,
                           version = version + 1, updated_at = now()
                     WHERE id = :choiceId AND option_group_id = :groupId
                       AND organization_id = :organizationId AND archived_at IS NULL
                       AND version = :version
                    """).param("choiceId", choiceId).param("groupId", groupId)
                .param("organizationId", organizationId).param("version", version).update();
            validateDeferred();
        } catch (DataAccessException exception) {
            throw new OptionStateConflictException();
        }
        audit(organizationId, "OPTION_CHOICE", choiceId, "ARCHIVE", context.accountId());
        return detailUnchecked(organizationId, groupId, true);
    }

    @Transactional
    public MenuManagementService.VariantChoice configure(UUID subject, UUID organizationId,
                                                          UUID productId, UUID variantId,
                                                          UUID choiceId, ConfigurationInput input) {
        StaffContextService.StaffContext context = access.authorize(subject, organizationId);
        lockVariant(organizationId, productId, variantId);
        validateVariantChoice(organizationId, productId, variantId, choiceId);
        List<NormalizedEffect> effects = normalizeEffects(organizationId, input.effects());
        UUID linkId = jdbc.sql("""
                SELECT id FROM menu_variant_option_choice
                 WHERE menu_variant_id = :variantId AND option_choice_id = :choiceId
                   AND organization_id = :organizationId FOR UPDATE
                """).param("variantId", variantId).param("choiceId", choiceId)
            .param("organizationId", organizationId).query(UUID.class).optional().orElse(null);
        if (linkId == null) {
            if (input.version() != null) throw new OptionVersionConflictException();
            linkId = jdbc.sql("""
                    INSERT INTO menu_variant_option_choice (
                        organization_id, menu_variant_id, option_choice_id,
                        price_delta_minor, enabled
                    ) VALUES (:organizationId, :variantId, :choiceId, :priceDelta, :enabled)
                    RETURNING id
                    """).param("organizationId", organizationId).param("variantId", variantId)
                .param("choiceId", choiceId).param("priceDelta", input.priceDeltaMinor())
                .param("enabled", input.enabled()).query(UUID.class).single();
        } else {
            if (input.version() == null) throw new OptionVersionConflictException();
            int changed = jdbc.sql("""
                    UPDATE menu_variant_option_choice
                       SET price_delta_minor = :priceDelta, enabled = :enabled,
                           version = version + 1, updated_at = now()
                     WHERE id = :linkId AND organization_id = :organizationId
                       AND version = :version
                    """).param("priceDelta", input.priceDeltaMinor())
                .param("enabled", input.enabled()).param("linkId", linkId)
                .param("organizationId", organizationId).param("version", input.version()).update();
            if (changed == 0) throw new OptionVersionConflictException();
            jdbc.sql("DELETE FROM option_choice_ingredient_effect WHERE menu_variant_option_choice_id = :linkId")
                .param("linkId", linkId).update();
        }
        for (NormalizedEffect effect : effects) {
            jdbc.sql("""
                    INSERT INTO option_choice_ingredient_effect (
                        organization_id, menu_variant_option_choice_id, ingredient_id, quantity_delta
                    ) VALUES (:organizationId, :linkId, :ingredientId, :quantity)
                    """).param("organizationId", organizationId).param("linkId", linkId)
                .param("ingredientId", effect.ingredientId()).param("quantity", effect.quantity())
                .update();
        }
        try {
            validateDeferred();
        } catch (DataAccessException exception) {
            throw new OptionStateConflictException();
        }
        audit(organizationId, "VARIANT_OPTION_CHOICE", linkId, "CONFIGURE", context.accountId());
        return configuredChoice(organizationId, variantId, linkId);
    }

    private GroupDetail detailUnchecked(UUID organizationId, UUID groupId,
                                        boolean includeArchivedChoices) {
        GroupRow group = group(organizationId, groupId, false);
        List<Choice> choices = jdbc.sql("""
                SELECT id, name, display_order, is_default, version, archived_at,
                       created_at, updated_at
                  FROM option_choice
                 WHERE option_group_id = :groupId AND organization_id = :organizationId
                   AND (:includeArchived OR archived_at IS NULL)
              ORDER BY display_order, lower(name), id
                """).param("groupId", groupId).param("organizationId", organizationId)
            .param("includeArchived", includeArchivedChoices).query(this::mapChoice).list();
        return new GroupDetail(group.id(), group.name(), group.minimumSelections(),
            group.maximumSelections(), group.displayOrder(), group.version(), group.archived(),
            group.createdAt(), group.updatedAt(), choices);
    }

    private MenuManagementService.VariantChoice configuredChoice(UUID organizationId,
                                                                  UUID variantId, UUID linkId) {
        List<MenuManagementService.IngredientEffect> effects = jdbc.sql("""
                SELECT effect.ingredient_id, ingredient.name, ingredient.base_unit,
                       effect.quantity_delta
                  FROM option_choice_ingredient_effect effect
                  JOIN ingredient ON ingredient.id = effect.ingredient_id
                 WHERE effect.menu_variant_option_choice_id = :linkId
              ORDER BY lower(ingredient.name), ingredient.id
                """).param("linkId", linkId).query((rs, row) ->
                new MenuManagementService.IngredientEffect(rs.getObject("ingredient_id", UUID.class),
                    rs.getString("name"), rs.getString("base_unit"),
                    rs.getBigDecimal("quantity_delta").toPlainString())).list();
        return jdbc.sql("""
                SELECT link.id, link.option_choice_id, choice.name AS choice_name,
                       choice.option_group_id, group_row.name AS group_name,
                       link.price_delta_minor, link.enabled, link.version
                  FROM menu_variant_option_choice link
                  JOIN option_choice choice ON choice.id = link.option_choice_id
                  JOIN option_group group_row ON group_row.id = choice.option_group_id
                 WHERE link.id = :linkId AND link.menu_variant_id = :variantId
                   AND link.organization_id = :organizationId
                """).param("linkId", linkId).param("variantId", variantId)
            .param("organizationId", organizationId).query((rs, row) ->
                new MenuManagementService.VariantChoice(rs.getObject("id", UUID.class),
                    rs.getObject("option_choice_id", UUID.class), rs.getString("choice_name"),
                    rs.getObject("option_group_id", UUID.class), rs.getString("group_name"),
                    rs.getLong("price_delta_minor"), rs.getBoolean("enabled"),
                    rs.getLong("version"), effects)).optional()
            .orElseThrow(OptionNotFoundException::new);
    }

    private void validateVariantChoice(UUID organizationId, UUID productId, UUID variantId,
                                       UUID choiceId) {
        boolean valid = jdbc.sql("""
                SELECT EXISTS(
                    SELECT 1 FROM menu_variant variant
                    JOIN menu_product product ON product.id = variant.menu_product_id
                    JOIN option_choice choice ON choice.id = :choiceId
                    JOIN option_group group_row ON group_row.id = choice.option_group_id
                     WHERE variant.id = :variantId AND product.id = :productId
                       AND variant.organization_id = :organizationId
                       AND choice.organization_id = :organizationId
                       AND product.archived_at IS NULL AND variant.archived_at IS NULL
                       AND group_row.archived_at IS NULL AND choice.archived_at IS NULL
                )
                """).param("choiceId", choiceId).param("variantId", variantId)
            .param("productId", productId).param("organizationId", organizationId)
            .query(Boolean.class).single();
        if (!valid) throw new OptionNotFoundException();
    }

    private List<NormalizedEffect> normalizeEffects(UUID organizationId, List<EffectInput> inputs) {
        Set<UUID> ids = new HashSet<>();
        List<NormalizedEffect> effects = new ArrayList<>();
        for (EffectInput input : inputs) {
            if (!ids.add(input.ingredientId())) throw new InvalidOptionException();
            try {
                BigDecimal value = new BigDecimal(input.quantityDelta())
                    .setScale(6, RoundingMode.UNNECESSARY);
                if (value.signum() == 0 || value.precision() > 19) throw new InvalidOptionException();
                effects.add(new NormalizedEffect(input.ingredientId(), value));
            } catch (NumberFormatException | ArithmeticException exception) {
                throw new InvalidOptionException();
            }
        }
        if (!ids.isEmpty()) {
            List<UUID> active = jdbc.sql("""
                    SELECT id FROM ingredient
                     WHERE organization_id = :organizationId AND archived_at IS NULL
                       AND id IN (:ids)
                  ORDER BY id FOR SHARE
                    """).param("organizationId", organizationId).param("ids", ids)
                .query(UUID.class).list();
            if (active.size() != ids.size()) throw new InvalidOptionException();
        }
        return effects;
    }

    private void lockConfiguredVariants(UUID groupId) {
        jdbc.sql("""
                SELECT variant.id FROM menu_variant variant
                 WHERE EXISTS (
                     SELECT 1 FROM option_choice choice
                     JOIN menu_variant_option_choice link ON link.option_choice_id = choice.id
                      WHERE choice.option_group_id = :groupId
                        AND link.menu_variant_id = variant.id
                 )
              ORDER BY variant.id FOR UPDATE
                """).param("groupId", groupId).query(UUID.class).list();
    }

    private void lockVariant(UUID organizationId, UUID productId, UUID variantId) {
        jdbc.sql("""
                SELECT variant.id FROM menu_variant variant
                 WHERE variant.id = :variantId AND variant.menu_product_id = :productId
                   AND variant.organization_id = :organizationId
                 FOR UPDATE
                """).param("variantId", variantId).param("productId", productId)
            .param("organizationId", organizationId).query(UUID.class).optional()
            .orElseThrow(OptionNotFoundException::new);
    }

    private void clearDefaultChoice(UUID organizationId, UUID groupId, UUID excludedChoiceId,
                                    UUID actorId) {
        List<UUID> changed = jdbc.sql("""
                UPDATE option_choice SET is_default = false, version = version + 1, updated_at = now()
                 WHERE option_group_id = :groupId AND is_default AND archived_at IS NULL
                   AND (CAST(:excludedId AS uuid) IS NULL OR id <> CAST(:excludedId AS uuid))
                RETURNING id
                """).param("groupId", groupId).param("excludedId", excludedChoiceId, Types.OTHER)
            .query(UUID.class).list();
        changed.forEach(id -> audit(organizationId, "OPTION_CHOICE", id, "UPDATE", actorId));
    }

    private void validateBounds(int minimum, int maximum) {
        if (minimum < 0 || maximum <= 0 || minimum > maximum) throw new InvalidOptionException();
    }

    private void ensureActiveGroup(UUID organizationId, UUID groupId) {
        if (group(organizationId, groupId, true).archived()) throw new OptionStateConflictException();
    }

    private GroupRow group(UUID organizationId, UUID groupId, boolean lock) {
        return jdbc.sql("""
                SELECT id, name, minimum_selections, maximum_selections, display_order,
                       version, archived_at, created_at, updated_at
                  FROM option_group WHERE id = :groupId AND organization_id = :organizationId
                """ + (lock ? " FOR UPDATE" : "")).param("groupId", groupId)
            .param("organizationId", organizationId).query(this::mapGroup).optional()
            .orElseThrow(OptionNotFoundException::new);
    }

    private ChoiceRow choice(UUID organizationId, UUID groupId, UUID choiceId, boolean lock) {
        return jdbc.sql("""
                SELECT id, version, archived_at FROM option_choice
                 WHERE id = :choiceId AND option_group_id = :groupId
                   AND organization_id = :organizationId
                """ + (lock ? " FOR UPDATE" : "")).param("choiceId", choiceId)
            .param("groupId", groupId).param("organizationId", organizationId)
            .query((rs, row) -> new ChoiceRow(rs.getObject("id", UUID.class), rs.getLong("version"),
                rs.getTimestamp("archived_at") != null)).optional()
            .orElseThrow(OptionNotFoundException::new);
    }

    private RuntimeException groupMutationFailure(UUID organizationId, UUID groupId) {
        return group(organizationId, groupId, false).archived()
            ? new OptionStateConflictException() : new OptionVersionConflictException();
    }

    private RuntimeException choiceMutationFailure(UUID organizationId, UUID groupId, UUID choiceId) {
        return choice(organizationId, groupId, choiceId, false).archived()
            ? new OptionStateConflictException() : new OptionVersionConflictException();
    }

    private void forceDeferredValidation() {
        jdbc.sql("SET CONSTRAINTS ALL IMMEDIATE").update();
        jdbc.sql("SET CONSTRAINTS ALL DEFERRED").update();
    }

    private void validateDeferred() {
        try {
            forceDeferredValidation();
        } catch (DataAccessException exception) {
            throw new OptionStateConflictException();
        }
    }

    private GroupRow mapGroup(ResultSet rs, int row) throws SQLException {
        return new GroupRow(rs.getObject("id", UUID.class), rs.getString("name"),
            rs.getInt("minimum_selections"), rs.getInt("maximum_selections"),
            rs.getInt("display_order"), rs.getLong("version"),
            rs.getTimestamp("archived_at") != null, rs.getTimestamp("created_at").toInstant(),
            rs.getTimestamp("updated_at").toInstant());
    }

    private Choice mapChoice(ResultSet rs, int row) throws SQLException {
        return new Choice(rs.getObject("id", UUID.class), rs.getString("name"),
            rs.getInt("display_order"), rs.getBoolean("is_default"), rs.getLong("version"),
            rs.getTimestamp("archived_at") != null, rs.getTimestamp("created_at").toInstant(),
            rs.getTimestamp("updated_at").toInstant());
    }

    private String normalizeName(String raw) {
        if (raw == null || raw.trim().isBlank()) throw new InvalidOptionException();
        return raw.trim();
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

    private record GroupRow(UUID id, String name, int minimumSelections, int maximumSelections,
                            int displayOrder, long version, boolean archived, Instant createdAt,
                            Instant updatedAt) { }
    private record ChoiceRow(UUID id, long version, boolean archived) { }
    private record NormalizedEffect(UUID ingredientId, BigDecimal quantity) { }
    public record GroupInput(String name, int minimumSelections, int maximumSelections,
                             int displayOrder, long version) { }
    public record ChoiceInput(String name, int displayOrder, boolean defaultChoice, long version) { }
    public record EffectInput(UUID ingredientId, String quantityDelta) { }
    public record ConfigurationInput(boolean enabled, long priceDeltaMinor, Long version,
                                     List<EffectInput> effects) {
        public ConfigurationInput { effects = List.copyOf(effects); }
    }
    @Schema(name = "StaffOptionGroupSummary")
    public record GroupSummary(UUID id, String name, int minimumSelections, int maximumSelections,
                               int displayOrder, long version, boolean archived,
                               int activeChoiceCount) { }
    @Schema(name = "StaffOptionGroupPage")
    public record GroupPage(List<GroupSummary> items, int page, int size, long totalItems,
                            long totalPages) {
        public GroupPage { items = List.copyOf(items); }
    }
    @Schema(name = "StaffOptionGroupDetail")
    public record GroupDetail(UUID id, String name, int minimumSelections, int maximumSelections,
                              int displayOrder, long version, boolean archived, Instant createdAt,
                              Instant updatedAt, List<Choice> choices) {
        public GroupDetail { choices = List.copyOf(choices); }
    }
    @Schema(name = "StaffOptionChoice")
    public record Choice(UUID id, String name, int displayOrder, boolean defaultChoice,
                         long version, boolean archived, Instant createdAt, Instant updatedAt) { }
}
