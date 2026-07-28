package com.bubbletea.shop.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "organization_membership")
public class OrganizationMembershipEntity {
    @Id
    UUID id;

    @Column(name = "organization_id", nullable = false)
    UUID organizationId;

    @Column(name = "account_id", nullable = false)
    UUID accountId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    Role role;

    @Column(nullable = false)
    boolean active;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    Instant updatedAt;

    protected OrganizationMembershipEntity() {
    }

    public enum Role {
        OWNER, MANAGER
    }
}

