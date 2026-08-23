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
    public ProvisioningResult provision(UUID authSubject, String email) {
        UUID accountId = UUID.randomUUID();
        AccountRecord account = jdbc.sql("""
                INSERT INTO account (id, auth_subject, email)
                VALUES (:accountId, :authSubject, :email)
                ON CONFLICT (auth_subject) DO UPDATE
                    SET email = EXCLUDED.email
                RETURNING id, enabled, created_at
                """)
            .param("accountId", accountId)
            .param("authSubject", authSubject)
            .param("email", email)
            .query((rs, rowNum) -> new AccountRecord(
                rs.getObject("id", UUID.class),
                rs.getBoolean("enabled"),
                rs.getTimestamp("created_at").toInstant()))
            .single();

        if (!account.enabled()) {
            throw new CustomerAccountDisabledException();
        }

        return new ProvisioningResult(account.id(), account.createdAt(), account.id().equals(accountId));
    }

    private record AccountRecord(UUID id, boolean enabled, Instant createdAt) {
    }

    public record ProvisioningResult(UUID id, Instant createdAt, boolean created) {
    }
}
