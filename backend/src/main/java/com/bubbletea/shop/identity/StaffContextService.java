package com.bubbletea.shop.identity;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;

@Service
public class StaffContextService {
    private final JdbcClient jdbc;

    public StaffContextService(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public StaffContext resolve(UUID authSubject) {
        AccountRecord account = jdbc.sql("""
                SELECT id, enabled
                  FROM account
                 WHERE auth_subject = :authSubject
                """)
            .param("authSubject", authSubject)
            .query((rs, rowNum) -> new AccountRecord(
                rs.getObject("id", UUID.class),
                rs.getBoolean("enabled")))
            .optional()
            .orElseThrow(StaffAccessDeniedException::new);

        if (!account.enabled()) {
            throw new StaffAccountDisabledException();
        }

        List<ScopeRow> rows = jdbc.sql("""
                SELECT membership.id AS membership_id,
                       organization.id AS organization_id,
                       organization.name AS organization_name,
                       membership.role,
                       location.id AS location_id,
                       location.name AS location_name,
                       location.timezone,
                       location.default_locale,
                       location.currency_code
                  FROM organization_membership membership
                  JOIN organization
                    ON organization.id = membership.organization_id
             LEFT JOIN location
                    ON location.organization_id = membership.organization_id
                   AND location.active
                   AND (
                       membership.role = 'OWNER'
                       OR EXISTS (
                           SELECT 1
                             FROM location_assignment assignment
                            WHERE assignment.membership_id = membership.id
                              AND assignment.organization_id = membership.organization_id
                              AND assignment.location_id = location.id
                       )
                   )
                 WHERE membership.account_id = :accountId
                   AND membership.active
              ORDER BY lower(organization.name), organization.id,
                       lower(location.name) NULLS FIRST, location.id NULLS FIRST
                """)
            .param("accountId", account.id())
            .query((rs, rowNum) -> new ScopeRow(
                rs.getObject("membership_id", UUID.class),
                rs.getObject("organization_id", UUID.class),
                rs.getString("organization_name"),
                StaffRole.valueOf(rs.getString("role")),
                rs.getObject("location_id", UUID.class),
                rs.getString("location_name"),
                rs.getString("timezone"),
                rs.getString("default_locale"),
                rs.getString("currency_code")))
            .list();

        if (rows.isEmpty()) {
            throw new StaffAccessDeniedException();
        }

        LinkedHashMap<UUID, MembershipBuilder> memberships = new LinkedHashMap<>();
        for (ScopeRow row : rows) {
            MembershipBuilder membership = memberships.computeIfAbsent(
                row.membershipId(),
                ignored -> new MembershipBuilder(
                    row.organizationId(),
                    row.organizationName(),
                    row.role()));
            if (row.locationId() != null) {
                membership.locations.add(new StaffLocation(
                    row.locationId(),
                    row.locationName(),
                    row.timezone(),
                    row.defaultLocale(),
                    row.currencyCode()));
            }
        }

        List<StaffMembership> resolvedMemberships = memberships.values().stream()
            .map(MembershipBuilder::build)
            .toList();
        return new StaffContext(account.id(), resolvedMemberships);
    }

    private record AccountRecord(UUID id, boolean enabled) {
    }

    private record ScopeRow(
        UUID membershipId,
        UUID organizationId,
        String organizationName,
        StaffRole role,
        UUID locationId,
        String locationName,
        String timezone,
        String defaultLocale,
        String currencyCode
    ) {
    }

    private static final class MembershipBuilder {
        private final UUID organizationId;
        private final String organizationName;
        private final StaffRole role;
        private final List<StaffLocation> locations = new ArrayList<>();

        private MembershipBuilder(
            UUID organizationId,
            String organizationName,
            StaffRole role
        ) {
            this.organizationId = organizationId;
            this.organizationName = organizationName;
            this.role = role;
        }

        private StaffMembership build() {
            return new StaffMembership(
                organizationId,
                organizationName,
                role,
                List.copyOf(locations));
        }
    }

    public enum StaffRole {
        OWNER,
        MANAGER
    }

    public record StaffContext(UUID accountId, List<StaffMembership> memberships) {
        public StaffContext {
            memberships = List.copyOf(memberships);
        }
    }

    public record StaffMembership(
        UUID organizationId,
        String organizationName,
        StaffRole role,
        List<StaffLocation> locations
    ) {
        public StaffMembership {
            locations = List.copyOf(locations);
        }
    }

    public record StaffLocation(
        UUID id,
        String name,
        String timezone,
        String defaultLocale,
        String currencyCode
    ) {
    }
}
