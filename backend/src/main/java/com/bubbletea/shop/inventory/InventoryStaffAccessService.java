package com.bubbletea.shop.inventory;

import com.bubbletea.shop.identity.StaffAccessDeniedException;
import com.bubbletea.shop.identity.StaffContextService;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
class InventoryStaffAccessService {
    private final StaffContextService staffContext;

    InventoryStaffAccessService(StaffContextService staffContext) {
        this.staffContext = staffContext;
    }

    AuthorizedLocation authorize(UUID subject, UUID organizationId, UUID locationId) {
        StaffContextService.StaffContext context = staffContext.resolve(subject);
        return context.memberships().stream()
            .filter(membership -> membership.organizationId().equals(organizationId))
            .flatMap(membership -> membership.locations().stream())
            .filter(location -> location.id().equals(locationId))
            .findFirst()
            .map(location -> new AuthorizedLocation(context.accountId(), location.currencyCode()))
            .orElseThrow(StaffAccessDeniedException::new);
    }

    record AuthorizedLocation(UUID accountId, String currencyCode) { }
}
