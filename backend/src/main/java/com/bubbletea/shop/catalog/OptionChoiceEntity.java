package com.bubbletea.shop.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "option_choice")
public class OptionChoiceEntity {
    @Id
    UUID id;

    @Column(name = "organization_id", nullable = false)
    UUID organizationId;

    @Column(name = "option_group_id", nullable = false)
    UUID optionGroupId;

    @Column(nullable = false, length = 120)
    String name;

    @Column(name = "display_order", nullable = false)
    int displayOrder;

    @Column(name = "is_default", nullable = false)
    boolean defaultChoice;

    @Column(name = "archived_at")
    Instant archivedAt;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    Instant updatedAt;

    protected OptionChoiceEntity() {
    }
}
