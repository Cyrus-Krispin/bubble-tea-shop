package com.bubbletea.shop.catalog;

import com.bubbletea.shop.identity.StaffAccessDeniedException;
import com.bubbletea.shop.identity.StaffContextService;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class CatalogStaffAccessService {
    private final StaffContextService staffContext;

    public CatalogStaffAccessService(StaffContextService staffContext) {
        this.staffContext = staffContext;
    }

    public StaffContextService.StaffContext authorize(UUID subject, UUID organizationId) {
        StaffContextService.StaffContext context = staffContext.resolve(subject);
        boolean allowed = context.memberships().stream().anyMatch(membership ->
            membership.organizationId().equals(organizationId)
                && (membership.role() == StaffContextService.StaffRole.OWNER
                    || !membership.locations().isEmpty()));
        if (!allowed) throw new StaffAccessDeniedException();
        return context;
    }
}
