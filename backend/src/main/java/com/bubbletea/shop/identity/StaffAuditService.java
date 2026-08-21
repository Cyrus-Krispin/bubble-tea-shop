package com.bubbletea.shop.identity;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class StaffAuditService {
    private final JdbcTemplate jdbc;
    private final StaffContextService staffContext;

    public StaffAuditService(JdbcTemplate jdbc, StaffContextService staffContext) {
        this.jdbc = jdbc;
        this.staffContext = staffContext;
    }

    @Transactional(readOnly = true)
    public AuditPage list(UUID subject, UUID organizationId, AuditCategory category, int page, int size) {
        StaffContextService.StaffMembership membership = authorize(subject, organizationId);
        boolean owner = membership.role() == StaffContextService.StaffRole.OWNER;
        List<UUID> locationIds = membership.locations().stream()
            .map(StaffContextService.StaffLocation::id)
            .toList();
        String locationScope = owner ? "" : " AND %s.location_id IN (%s)";
        String placeholders = String.join(",", locationIds.stream().map(ignored -> "?").toList());
        String inventoryScope = owner ? "" : locationScope.formatted("movement", placeholders);
        String orderScope = owner ? "" : locationScope.formatted("orders", placeholders);
        String union = unionSql(inventoryScope, orderScope);

        List<Object> unionParameters = new ArrayList<>();
        unionParameters.add(organizationId);
        unionParameters.add(organizationId);
        if (!owner) unionParameters.addAll(locationIds);
        unionParameters.add(organizationId);
        if (!owner) unionParameters.addAll(locationIds);

        String categoryClause = category == null ? "" : " WHERE category = ?";
        List<Object> filterParameters = new ArrayList<>(unionParameters);
        if (category != null) filterParameters.add(category.name());
        long total = jdbc.queryForObject(
            "SELECT count(*) FROM (" + union + ") event" + categoryClause,
            Long.class,
            filterParameters.toArray());

        List<Object> pageParameters = new ArrayList<>(filterParameters);
        pageParameters.add(size);
        pageParameters.add((long) page * size);
        List<AuditEvent> items = jdbc.query(
            "SELECT * FROM (" + union + ") event" + categoryClause
                + " ORDER BY occurred_at DESC, id DESC LIMIT ? OFFSET ?",
            this::map,
            pageParameters.toArray());
        int totalPages = total == 0 ? 0 : (int) ((total + size - 1) / size);
        return new AuditPage(List.copyOf(items), page, size, total, totalPages);
    }

    private StaffContextService.StaffMembership authorize(UUID subject, UUID organizationId) {
        return staffContext.resolve(subject).memberships().stream()
            .filter(membership -> membership.organizationId().equals(organizationId))
            .filter(membership -> membership.role() == StaffContextService.StaffRole.OWNER
                || !membership.locations().isEmpty())
            .findFirst()
            .orElseThrow(StaffAccessDeniedException::new);
    }

    private String unionSql(String inventoryScope, String orderScope) {
        return """
            SELECT change.id, 'CATALOG' AS category, change.action,
                   change.entity_type, change.entity_id,
                   COALESCE(ingredient.name, recipe.name, product.name, variant.name,
                            option_group.name, option_choice.name, change.entity_type) AS entity_label,
                   NULL::uuid AS location_id, NULL::varchar AS location_name,
                   change.actor_account_id,
                   COALESCE(actor.username, 'Staff ' || left(change.actor_account_id::text, 8)) AS actor_label,
                   change.occurred_at, NULL::text AS detail
              FROM catalog_change change
         LEFT JOIN account actor ON actor.id = change.actor_account_id
         LEFT JOIN ingredient ON change.entity_type = 'INGREDIENT' AND ingredient.id = change.entity_id
         LEFT JOIN recipe ON change.entity_type = 'RECIPE' AND recipe.id = change.entity_id
         LEFT JOIN menu_product product ON change.entity_type = 'MENU_PRODUCT' AND product.id = change.entity_id
         LEFT JOIN menu_variant variant ON change.entity_type = 'MENU_VARIANT' AND variant.id = change.entity_id
         LEFT JOIN option_group ON change.entity_type = 'OPTION_GROUP' AND option_group.id = change.entity_id
         LEFT JOIN option_choice ON change.entity_type = 'OPTION_CHOICE' AND option_choice.id = change.entity_id
             WHERE change.organization_id = ?
            UNION ALL
            SELECT movement.id, 'INVENTORY', movement.movement_type,
                   'INGREDIENT', movement.ingredient_id, ingredient.name,
                   movement.location_id, location.name, movement.actor_account_id,
                   CASE WHEN movement.actor_account_id IS NULL THEN NULL
                        ELSE COALESCE(actor.username, 'Staff ' || left(movement.actor_account_id::text, 8)) END,
                   movement.created_at,
                   movement.quantity_delta::text || ' ' || ingredient.base_unit
              FROM inventory_movement movement
              JOIN ingredient ON ingredient.id = movement.ingredient_id
              JOIN location ON location.id = movement.location_id
         LEFT JOIN account actor ON actor.id = movement.actor_account_id
             WHERE movement.organization_id = ?
            """ + inventoryScope + """
            UNION ALL
            SELECT history.id, 'ORDER', history.to_status,
                   'ORDER', orders.id, orders.public_order_number,
                   orders.location_id, location.name, history.changed_by_account_id,
                   CASE WHEN history.changed_by_account_id IS NULL THEN NULL
                        ELSE COALESCE(actor.username, 'Staff ' || left(history.changed_by_account_id::text, 8)) END,
                   history.changed_at,
                   COALESCE(history.from_status, 'NEW') || ' → ' || history.to_status
              FROM order_status_history history
              JOIN customer_order orders ON orders.id = history.customer_order_id
              JOIN location ON location.id = orders.location_id
         LEFT JOIN account actor ON actor.id = history.changed_by_account_id
             WHERE history.organization_id = ?
            """ + orderScope;
    }

    private AuditEvent map(ResultSet rs, int rowNumber) throws SQLException {
        return new AuditEvent(
            rs.getObject("id", UUID.class),
            AuditCategory.valueOf(rs.getString("category")),
            rs.getString("action"),
            rs.getString("entity_type"),
            rs.getObject("entity_id", UUID.class),
            rs.getString("entity_label"),
            rs.getObject("location_id", UUID.class),
            rs.getString("location_name"),
            rs.getObject("actor_account_id", UUID.class),
            rs.getString("actor_label"),
            rs.getObject("occurred_at", java.time.OffsetDateTime.class).toInstant(),
            rs.getString("detail"));
    }

    public enum AuditCategory { CATALOG, INVENTORY, ORDER }

    public record AuditEvent(
        UUID id,
        AuditCategory category,
        String action,
        String entityType,
        UUID entityId,
        String entityLabel,
        @Schema(nullable = true) UUID locationId,
        @Schema(nullable = true) String locationName,
        @Schema(nullable = true) UUID actorAccountId,
        @Schema(nullable = true) String actorLabel,
        Instant occurredAt,
        @Schema(nullable = true) String detail
    ) { }

    public record AuditPage(
        List<AuditEvent> items,
        int page,
        int size,
        long totalItems,
        int totalPages
    ) {
        public AuditPage {
            items = List.copyOf(items);
        }
    }
}
