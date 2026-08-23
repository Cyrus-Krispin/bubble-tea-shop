package com.bubbletea.shop.ordering;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "order_item_option")
public class OrderItemOptionEntity {
    @Id
    UUID id;

    @Column(name = "organization_id", nullable = false)
    UUID organizationId;

    @Column(name = "order_item_id", nullable = false)
    UUID orderItemId;

    @Column(name = "option_choice_id")
    UUID optionChoiceId;

    @Column(name = "selection_number", nullable = false)
    int selectionNumber;

    @Column(name = "group_name_snapshot", nullable = false, length = 120)
    String groupNameSnapshot;

    @Column(name = "choice_name_snapshot", nullable = false, length = 120)
    String choiceNameSnapshot;

    @Column(name = "price_delta_minor", nullable = false)
    long priceDeltaMinor;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    protected OrderItemOptionEntity() {
    }
}
