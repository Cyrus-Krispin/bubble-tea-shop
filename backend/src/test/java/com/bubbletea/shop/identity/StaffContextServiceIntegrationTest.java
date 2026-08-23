package com.bubbletea.shop.identity;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Testcontainers
@SpringBootTest(properties = "spring.main.web-application-type=none")
class StaffContextServiceIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>("postgres:18.4-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    StaffContextService staffContext;

    @Test
    void resolvesAllOwnerLocationsAndOnlyAssignedManagerLocations() {
        UUID authSubject = UUID.randomUUID();
        UUID accountId = account(authSubject, true);

        UUID ownerOrganization = organization("Zulu Tea");
        membership(ownerOrganization, accountId, "OWNER", true);
        UUID ownerSecond = location(ownerOrganization, "Second", true);
        UUID ownerFirst = location(ownerOrganization, "First", true);
        location(ownerOrganization, "Closed", false);

        UUID managerOrganization = organization("Alpha Tea");
        UUID managerMembership = membership(managerOrganization, accountId, "MANAGER", true);
        UUID assigned = location(managerOrganization, "Assigned", true);
        location(managerOrganization, "Unassigned", true);
        UUID inactiveAssigned = location(managerOrganization, "Inactive assigned", false);
        assign(managerOrganization, managerMembership, assigned);
        assign(managerOrganization, managerMembership, inactiveAssigned);

        StaffContextService.StaffContext result = staffContext.resolve(authSubject);

        assertThat(result.accountId()).isEqualTo(accountId);
        assertThat(result.memberships())
            .extracting(StaffContextService.StaffMembership::organizationName)
            .containsExactly("Alpha Tea", "Zulu Tea");
        assertThat(result.memberships().getFirst().role())
            .isEqualTo(StaffContextService.StaffRole.MANAGER);
        assertThat(result.memberships().getFirst().locations())
            .extracting(StaffContextService.StaffLocation::id)
            .containsExactly(assigned);
        assertThat(result.memberships().getLast().role())
            .isEqualTo(StaffContextService.StaffRole.OWNER);
        assertThat(result.memberships().getLast().locations())
            .extracting(StaffContextService.StaffLocation::id)
            .containsExactly(ownerFirst, ownerSecond);
    }

    @Test
    void retainsAnActiveMembershipWithNoVisibleLocationsAndIgnoresInactiveMemberships() {
        UUID authSubject = UUID.randomUUID();
        UUID accountId = account(authSubject, true);
        UUID activeOrganization = organization("No locations");
        membership(activeOrganization, accountId, "MANAGER", true);
        UUID inactiveOrganization = organization("Inactive membership");
        membership(inactiveOrganization, accountId, "OWNER", false);
        location(inactiveOrganization, "Hidden", true);

        StaffContextService.StaffContext result = staffContext.resolve(authSubject);

        assertThat(result.memberships()).hasSize(1);
        assertThat(result.memberships().getFirst().organizationId()).isEqualTo(activeOrganization);
        assertThat(result.memberships().getFirst().locations()).isEmpty();
    }

    @Test
    void deniesUnmappedDisabledAndCustomerOnlyIdentities() {
        UUID disabled = UUID.randomUUID();
        account(disabled, false);
        UUID customerOnly = UUID.randomUUID();
        account(customerOnly, true);

        assertThatThrownBy(() -> staffContext.resolve(UUID.randomUUID()))
            .isInstanceOf(StaffAccessDeniedException.class);
        assertThatThrownBy(() -> staffContext.resolve(disabled))
            .isInstanceOf(StaffAccountDisabledException.class);
        assertThatThrownBy(() -> staffContext.resolve(customerOnly))
            .isInstanceOf(StaffAccessDeniedException.class);
    }

    private UUID account(UUID authSubject, boolean enabled) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO account (id, auth_subject, enabled) VALUES (?, ?, ?)",
            id, authSubject, enabled);
        return id;
    }

    private UUID organization(String name) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO organization (id, name) VALUES (?, ?)", id, name);
        return id;
    }

    private UUID membership(UUID organizationId, UUID accountId, String role, boolean active) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO organization_membership (
                id, organization_id, account_id, role, active
            ) VALUES (?, ?, ?, ?, ?)
            """, id, organizationId, accountId, role, active);
        return id;
    }

    private UUID location(UUID organizationId, String name, boolean active) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO location (
                id, organization_id, name, timezone, default_locale, currency_code, active
            ) VALUES (?, ?, ?, 'Asia/Singapore', 'en-SG', 'SGD', ?)
            """, id, organizationId, name, active);
        return id;
    }

    private void assign(UUID organizationId, UUID membershipId, UUID locationId) {
        jdbc.update("""
            INSERT INTO location_assignment (organization_id, membership_id, location_id)
            VALUES (?, ?, ?)
            """, organizationId, membershipId, locationId);
    }
}
