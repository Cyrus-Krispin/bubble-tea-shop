package com.bubbletea.shop.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "refresh_session")
public class RefreshSessionEntity {
    @Id
    UUID id;

    @Column(name = "account_id", nullable = false)
    UUID accountId;

    @Column(name = "token_hash", nullable = false, length = 128)
    String tokenHash;

    @Column(name = "expires_at", nullable = false)
    Instant expiresAt;

    @Column(name = "revoked_at")
    Instant revokedAt;

    @Column(name = "replaced_by_session_id")
    UUID replacedBySessionId;

    @Column(name = "device_description")
    String deviceDescription;

    @Column(name = "ip_address", columnDefinition = "inet")
    String ipAddress;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    protected RefreshSessionEntity() {
    }
}
