package com.bubbletea.shop.identity;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class CustomerAccountService {
    private final JdbcClient jdbc;

    public CustomerAccountService(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public ProvisioningResult provision(UUID authSubject) {
        UUID accountId = UUID.randomUUID();
        boolean created = jdbc.sql("""
                INSERT INTO account (id, auth_subject)
                VALUES (:accountId, :authSubject)
                ON CONFLICT (auth_subject) DO NOTHING
                """)
            .param("accountId", accountId)
            .param("authSubject", authSubject)
            .update() == 1;

        AccountRecord account = jdbc.sql("""
                SELECT id, enabled, created_at
                  FROM account
                 WHERE auth_subject = :authSubject
                """)
            .param("authSubject", authSubject)
            .query((rs, rowNum) -> new AccountRecord(
                rs.getObject("id", UUID.class),
                rs.getBoolean("enabled"),
                rs.getTimestamp("created_at").toInstant()))
            .single();

        if (!account.enabled()) {
            throw new CustomerAccountDisabledException();
        }

        return new ProvisioningResult(account.id(), account.createdAt(), created);
    }

    private record AccountRecord(UUID id, boolean enabled, Instant createdAt) {
    }

    public record ProvisioningResult(UUID id, Instant createdAt, boolean created) {
    }
}
