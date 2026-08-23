package com.bubbletea.shop.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "account")
public class AccountEntity {
    @Id
    UUID id;

    @Column(length = 100)
    String username;

    @Column(name = "normalized_username", length = 100)
    String normalizedUsername;

    @Column(name = "password_hash")
    String passwordHash;

    @Column(name = "auth_subject", unique = true)
    UUID authSubject;

    @Column(nullable = false)
    boolean enabled;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    Instant updatedAt;

    protected AccountEntity() {
    }
}
