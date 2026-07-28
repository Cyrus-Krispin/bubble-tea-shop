package com.bubbletea.shop.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@IdClass(LocationAssignmentId.class)
@Table(name = "location_assignment")
public class LocationAssignmentEntity {
    @Column(name = "organization_id", nullable = false)
    UUID organizationId;

    @Id
    @Column(name = "membership_id")
    UUID membershipId;

    @Id
    @Column(name = "location_id")
    UUID locationId;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    protected LocationAssignmentEntity() {
    }
}

