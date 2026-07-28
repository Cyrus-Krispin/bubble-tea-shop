package com.bubbletea.shop.identity;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public class LocationAssignmentId implements Serializable {
    UUID membershipId;
    UUID locationId;

    public LocationAssignmentId() {
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) return true;
        if (!(other instanceof LocationAssignmentId that)) return false;
        return Objects.equals(membershipId, that.membershipId)
            && Objects.equals(locationId, that.locationId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(membershipId, locationId);
    }
}

