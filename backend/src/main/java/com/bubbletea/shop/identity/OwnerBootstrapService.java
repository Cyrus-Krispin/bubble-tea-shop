package com.bubbletea.shop.identity;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class OwnerBootstrapService {
    private final JdbcClient jdbc;

    public OwnerBootstrapService(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public BootstrapResult bootstrap(UUID authSubject, UUID organizationId) {
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
            .orElseThrow(() -> new OwnerBootstrapException(
                "The owner account is not provisioned."));

        if (!account.enabled()) {
            throw new OwnerBootstrapException("The owner account is disabled.");
        }

        boolean organizationExists = jdbc.sql("""
                SELECT EXISTS (
                    SELECT 1 FROM organization WHERE id = :organizationId
                )
                """)
            .param("organizationId", organizationId)
            .query(Boolean.class)
            .single();
        if (!organizationExists) {
            throw new OwnerBootstrapException("The organization does not exist.");
        }

        UUID proposedMembershipId = UUID.randomUUID();
        boolean created = jdbc.sql("""
                INSERT INTO organization_membership (
                    id, organization_id, account_id, role, active
                )
                VALUES (
                    :membershipId, :organizationId, :accountId, 'OWNER', true
                )
                ON CONFLICT (organization_id, account_id) DO NOTHING
                """)
            .param("membershipId", proposedMembershipId)
            .param("organizationId", organizationId)
            .param("accountId", account.id())
            .update() == 1;

        MembershipRecord membership = jdbc.sql("""
                SELECT id, role, active
                  FROM organization_membership
                 WHERE organization_id = :organizationId
                   AND account_id = :accountId
                """)
            .param("organizationId", organizationId)
            .param("accountId", account.id())
            .query((rs, rowNum) -> new MembershipRecord(
                rs.getObject("id", UUID.class),
                rs.getString("role"),
                rs.getBoolean("active")))
            .single();

        if (!membership.active() || !"OWNER".equals(membership.role())) {
            throw new OwnerBootstrapException(
                "The existing membership cannot be promoted or reactivated by bootstrap.");
        }

        return new BootstrapResult(account.id(), membership.id(), organizationId, created);
    }

    private record AccountRecord(UUID id, boolean enabled) {
    }

    private record MembershipRecord(UUID id, String role, boolean active) {
    }

    public record BootstrapResult(
        UUID accountId,
        UUID membershipId,
        UUID organizationId,
        boolean created
    ) {
    }
}
