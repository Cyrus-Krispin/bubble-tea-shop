package com.bubbletea.shop.identity;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class OwnerManagerService {
    private final JdbcClient jdbc;
    private final StaffContextService staffContext;

    public OwnerManagerService(JdbcClient jdbc, StaffContextService staffContext) {
        this.jdbc = jdbc;
        this.staffContext = staffContext;
    }

    @Transactional(readOnly = true)
    public ManagerPage list(UUID subject, UUID organizationId, int page, int size) {
        authorizeOwner(subject, organizationId);
        long total = jdbc.sql("""
                SELECT count(*)
                  FROM organization_membership
                 WHERE organization_id = :organizationId
                   AND role = 'MANAGER'
                """)
            .param("organizationId", organizationId)
            .query(Long.class)
            .single();
        List<ManagerRow> rows = jdbc.sql("""
                SELECT membership.id, membership.account_id,
                       COALESCE(account.email, account.username,
                           'Account ' || left(account.id::text, 8)) AS email,
                       membership.active, membership.version,
                       membership.created_at, membership.updated_at
                  FROM organization_membership membership
                  JOIN account ON account.id = membership.account_id
                 WHERE membership.organization_id = :organizationId
                   AND membership.role = 'MANAGER'
              ORDER BY membership.active DESC, lower(COALESCE(account.email, account.username, '')),
                       membership.id
                 LIMIT :size OFFSET :offset
                """)
            .param("organizationId", organizationId)
            .param("size", size)
            .param("offset", (long) page * size)
            .query(this::managerRow)
            .list();
        List<ManagerSummary> items = summaries(organizationId, rows);
        int totalPages = total == 0 ? 0 : (int) ((total + size - 1) / size);
        return new ManagerPage(items, page, size, total, totalPages);
    }

    @Transactional
    public MutationResult addOrReactivate(
        UUID subject,
        UUID organizationId,
        String email,
        List<UUID> locationIds
    ) {
        UUID actor = authorizeOwner(subject, organizationId);
        List<UUID> locations = validateLocations(organizationId, locationIds);
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        UUID accountId = jdbc.sql("""
                SELECT id
                  FROM account
                 WHERE lower(email) = :email
                   AND enabled
                   FOR UPDATE
                """)
            .param("email", normalizedEmail)
            .query(UUID.class)
            .optional()
            .orElseThrow(ManagerAccountNotFoundException::new);

        MembershipState existing = lockByAccount(organizationId, accountId);
        UUID membershipId;
        boolean created;
        if (existing == null) {
            membershipId = jdbc.sql("""
                    INSERT INTO organization_membership
                        (organization_id, account_id, role, active)
                    VALUES (:organizationId, :accountId, 'MANAGER', true)
                    RETURNING id
                    """)
                .param("organizationId", organizationId)
                .param("accountId", accountId)
                .query(UUID.class)
                .single();
            created = true;
            replaceAssignments(organizationId, membershipId, locations);
            appendChange(organizationId, membershipId, "CREATE", actor);
        } else {
            if (existing.role() != StaffContextService.StaffRole.MANAGER || existing.active()) {
                throw new ManagerConflictException();
            }
            membershipId = existing.id();
            jdbc.sql("""
                    UPDATE organization_membership
                       SET active = true, version = version + 1, updated_at = now()
                     WHERE id = :membershipId
                    """)
                .param("membershipId", membershipId)
                .update();
            replaceAssignments(organizationId, membershipId, locations);
            appendChange(organizationId, membershipId, "REACTIVATE", actor);
            created = false;
        }
        return new MutationResult(summary(organizationId, membershipId), created);
    }

    @Transactional
    public ManagerSummary replaceAssignments(
        UUID subject,
        UUID organizationId,
        UUID membershipId,
        long expectedVersion,
        List<UUID> locationIds
    ) {
        UUID actor = authorizeOwner(subject, organizationId);
        List<UUID> locations = validateLocations(organizationId, locationIds);
        MembershipState membership = lockManager(organizationId, membershipId);
        if (!membership.active()) throw new ManagerConflictException();
        requireVersion(membership, expectedVersion);
        replaceAssignments(organizationId, membershipId, locations);
        jdbc.sql("""
                UPDATE organization_membership
                   SET version = version + 1, updated_at = now()
                 WHERE id = :membershipId
                """)
            .param("membershipId", membershipId)
            .update();
        appendChange(organizationId, membershipId, "UPDATE_ASSIGNMENTS", actor);
        return summary(organizationId, membershipId);
    }

    @Transactional
    public ManagerSummary deactivate(
        UUID subject,
        UUID organizationId,
        UUID membershipId,
        long expectedVersion
    ) {
        UUID actor = authorizeOwner(subject, organizationId);
        MembershipState membership = lockManager(organizationId, membershipId);
        if (!membership.active()) return summary(organizationId, membershipId);
        requireVersion(membership, expectedVersion);
        jdbc.sql("""
                UPDATE organization_membership
                   SET active = false, version = version + 1, updated_at = now()
                 WHERE id = :membershipId
                """)
            .param("membershipId", membershipId)
            .update();
        appendChange(organizationId, membershipId, "DEACTIVATE", actor);
        return summary(organizationId, membershipId);
    }

    private UUID authorizeOwner(UUID subject, UUID organizationId) {
        StaffContextService.StaffContext context = staffContext.resolve(subject);
        boolean owner = context.memberships().stream().anyMatch(membership ->
            membership.organizationId().equals(organizationId)
                && membership.role() == StaffContextService.StaffRole.OWNER);
        if (!owner) throw new StaffAccessDeniedException();
        return context.accountId();
    }

    private List<UUID> validateLocations(UUID organizationId, List<UUID> requested) {
        LinkedHashSet<UUID> unique = new LinkedHashSet<>(requested);
        if (unique.isEmpty() || unique.size() != requested.size()) {
            throw new ManagerInvalidException();
        }
        List<UUID> locations = List.copyOf(unique);
        long count = jdbc.sql("""
                SELECT count(*)
                  FROM location
                 WHERE organization_id = :organizationId
                   AND active
                   AND id IN (:locationIds)
                """)
            .param("organizationId", organizationId)
            .param("locationIds", locations)
            .query(Long.class)
            .single();
        if (count != locations.size()) throw new ManagerInvalidException();
        return locations;
    }

    private MembershipState lockByAccount(UUID organizationId, UUID accountId) {
        return jdbc.sql("""
                SELECT id, role, active, version
                  FROM organization_membership
                 WHERE organization_id = :organizationId
                   AND account_id = :accountId
                   FOR UPDATE
                """)
            .param("organizationId", organizationId)
            .param("accountId", accountId)
            .query(this::membershipState)
            .optional()
            .orElse(null);
    }

    private MembershipState lockManager(UUID organizationId, UUID membershipId) {
        return jdbc.sql("""
                SELECT id, role, active, version
                  FROM organization_membership
                 WHERE organization_id = :organizationId
                   AND id = :membershipId
                   AND role = 'MANAGER'
                   FOR UPDATE
                """)
            .param("organizationId", organizationId)
            .param("membershipId", membershipId)
            .query(this::membershipState)
            .optional()
            .orElseThrow(ManagerNotFoundException::new);
    }

    private MembershipState membershipState(ResultSet rs, int rowNumber) throws SQLException {
        return new MembershipState(
            rs.getObject("id", UUID.class),
            StaffContextService.StaffRole.valueOf(rs.getString("role")),
            rs.getBoolean("active"),
            rs.getLong("version"));
    }

    private void requireVersion(MembershipState membership, long expectedVersion) {
        if (membership.version() != expectedVersion) throw new ManagerVersionConflictException();
    }

    private void replaceAssignments(UUID organizationId, UUID membershipId, List<UUID> locations) {
        jdbc.sql("DELETE FROM location_assignment WHERE membership_id = :membershipId")
            .param("membershipId", membershipId)
            .update();
        for (UUID locationId : locations) {
            jdbc.sql("""
                    INSERT INTO location_assignment (organization_id, membership_id, location_id)
                    VALUES (:organizationId, :membershipId, :locationId)
                    """)
                .param("organizationId", organizationId)
                .param("membershipId", membershipId)
                .param("locationId", locationId)
                .update();
        }
    }

    private void appendChange(UUID organizationId, UUID membershipId, String action, UUID actor) {
        jdbc.sql("""
                INSERT INTO staff_access_change
                    (organization_id, membership_id, action, actor_account_id)
                VALUES (:organizationId, :membershipId, :action, :actor)
                """)
            .param("organizationId", organizationId)
            .param("membershipId", membershipId)
            .param("action", action)
            .param("actor", actor)
            .update();
    }

    private ManagerSummary summary(UUID organizationId, UUID membershipId) {
        ManagerRow row = jdbc.sql("""
                SELECT membership.id, membership.account_id,
                       COALESCE(account.email, account.username,
                           'Account ' || left(account.id::text, 8)) AS email,
                       membership.active, membership.version,
                       membership.created_at, membership.updated_at
                  FROM organization_membership membership
                  JOIN account ON account.id = membership.account_id
                 WHERE membership.organization_id = :organizationId
                   AND membership.id = :membershipId
                   AND membership.role = 'MANAGER'
                """)
            .param("organizationId", organizationId)
            .param("membershipId", membershipId)
            .query(this::managerRow)
            .single();
        return summaries(organizationId, List.of(row)).getFirst();
    }

    private ManagerRow managerRow(ResultSet rs, int rowNumber) throws SQLException {
        return new ManagerRow(
            rs.getObject("id", UUID.class),
            rs.getObject("account_id", UUID.class),
            rs.getString("email"),
            rs.getBoolean("active"),
            rs.getLong("version"),
            rs.getObject("created_at", java.time.OffsetDateTime.class).toInstant(),
            rs.getObject("updated_at", java.time.OffsetDateTime.class).toInstant());
    }

    private List<ManagerSummary> summaries(UUID organizationId, List<ManagerRow> rows) {
        if (rows.isEmpty()) return List.of();
        List<UUID> membershipIds = rows.stream().map(ManagerRow::id).toList();
        Map<UUID, List<ManagerLocation>> locations = new LinkedHashMap<>();
        jdbc.sql("""
                SELECT assignment.membership_id, location.id, location.name
                  FROM location_assignment assignment
                  JOIN location
                    ON location.id = assignment.location_id
                   AND location.organization_id = assignment.organization_id
                 WHERE assignment.organization_id = :organizationId
                   AND assignment.membership_id IN (:membershipIds)
              ORDER BY lower(location.name), location.id
                """)
            .param("organizationId", organizationId)
            .param("membershipIds", membershipIds)
            .query((rs, rowNumber) -> {
                UUID membershipId = rs.getObject("membership_id", UUID.class);
                locations.computeIfAbsent(membershipId, ignored -> new ArrayList<>())
                    .add(new ManagerLocation(
                        rs.getObject("id", UUID.class),
                        rs.getString("name")));
                return membershipId;
            })
            .list();
        return rows.stream().map(row -> new ManagerSummary(
            row.id(), row.accountId(), row.email(), row.active(), row.version(),
            List.copyOf(locations.getOrDefault(row.id(), List.of())),
            row.createdAt(), row.updatedAt())).toList();
    }

    private record MembershipState(
        UUID id,
        StaffContextService.StaffRole role,
        boolean active,
        long version
    ) { }

    private record ManagerRow(
        UUID id,
        UUID accountId,
        String email,
        boolean active,
        long version,
        Instant createdAt,
        Instant updatedAt
    ) { }

    public record ManagerLocation(UUID id, String name) { }

    public record ManagerSummary(
        UUID id,
        UUID accountId,
        String email,
        boolean active,
        long version,
        List<ManagerLocation> locations,
        Instant createdAt,
        Instant updatedAt
    ) {
        public ManagerSummary {
            locations = List.copyOf(locations);
        }
    }

    public record ManagerPage(
        List<ManagerSummary> items,
        int page,
        int size,
        long totalItems,
        int totalPages
    ) {
        public ManagerPage {
            items = List.copyOf(items);
        }
    }

    public record MutationResult(ManagerSummary manager, boolean created) { }

    public static class ManagerInvalidException extends RuntimeException { }
    public static class ManagerAccountNotFoundException extends RuntimeException { }
    public static class ManagerNotFoundException extends RuntimeException { }
    public static class ManagerConflictException extends RuntimeException { }
    public static class ManagerVersionConflictException extends RuntimeException { }
}
