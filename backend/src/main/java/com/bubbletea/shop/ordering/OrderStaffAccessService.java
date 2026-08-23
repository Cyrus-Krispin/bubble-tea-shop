package com.bubbletea.shop.ordering;

import com.bubbletea.shop.identity.StaffAccessDeniedException;
import com.bubbletea.shop.identity.StaffContextService;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
class OrderStaffAccessService {
    private final StaffContextService staffContext;

    OrderStaffAccessService(StaffContextService staffContext) {
        this.staffContext = staffContext;
    }

    UUID authorize(UUID subject, UUID organizationId, UUID locationId) {
        StaffContextService.StaffContext context = staffContext.resolve(subject);
        boolean allowed = context.memberships().stream()
            .filter(membership -> membership.organizationId().equals(organizationId))
            .flatMap(membership -> membership.locations().stream())
            .anyMatch(location -> location.id().equals(locationId));
        if (!allowed) throw new StaffAccessDeniedException();
        return context.accountId();
    }
}
