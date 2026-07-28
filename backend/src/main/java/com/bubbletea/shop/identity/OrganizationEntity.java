package com.bubbletea.shop.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "organization")
public class OrganizationEntity {
    @Id
    UUID id;

    @Column(nullable = false, length = 160)
    String name;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    Instant updatedAt;

    protected OrganizationEntity() {
    }
}

