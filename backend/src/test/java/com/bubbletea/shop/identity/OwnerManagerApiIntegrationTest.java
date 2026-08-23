package com.bubbletea.shop.identity;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Testcontainers
@SpringBootTest(properties = {
    "app.security.supabase.enabled=true",
    "app.security.supabase.issuer=http://localhost:8000/auth/v1",
    "app.security.supabase.jwk-set-uri=http://localhost:8000/auth/v1/.well-known/jwks.json"
})
@AutoConfigureMockMvc
class OwnerManagerApiIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:18.4-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean JwtDecoder jwtDecoder;

    @Test
    void ownerCreatesScopesUpdatesDeactivatesAndReactivatesManager() throws Exception {
        Fixture fixture = fixture();
        String path = path(fixture);

        mvc.perform(post(path).with(token(fixture.ownerSubject()))
                .contentType("application/json")
                .content(addBody(fixture.managerEmail(), fixture.locationOne(), fixture.locationTwo())))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.email").value(fixture.managerEmail()))
            .andExpect(jsonPath("$.active").value(true))
            .andExpect(jsonPath("$.version").value(0))
            .andExpect(jsonPath("$.locations.length()").value(2));

        UUID membershipId = jdbc.queryForObject("""
            SELECT membership.id
              FROM organization_membership membership
              JOIN account ON account.id = membership.account_id
             WHERE membership.organization_id = ? AND account.id = ?
            """, UUID.class, fixture.organization(), fixture.managerAccount());

        mvc.perform(put(path + "/" + membershipId + "/assignments")
                .with(token(fixture.ownerSubject()))
                .contentType("application/json")
                .content(assignmentBody(0, fixture.locationTwo())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.version").value(1))
            .andExpect(jsonPath("$.locations.length()").value(1))
            .andExpect(jsonPath("$.locations[0].id").value(fixture.locationTwo().toString()));

        mvc.perform(post(path + "/" + membershipId + "/deactivate")
                .with(token(fixture.ownerSubject()))
                .contentType("application/json")
                .content("{\"version\":1}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.active").value(false))
            .andExpect(jsonPath("$.version").value(2));

        mvc.perform(get("/api/v1/staff/context").with(token(fixture.managerSubject())))
            .andExpect(status().isForbidden());

        mvc.perform(post(path).with(token(fixture.ownerSubject()))
                .contentType("application/json")
                .content(addBody(fixture.managerEmail().toUpperCase(), fixture.locationOne())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.active").value(true))
            .andExpect(jsonPath("$.version").value(3))
            .andExpect(jsonPath("$.locations[0].id").value(fixture.locationOne().toString()));

        assertThat(jdbc.queryForObject(
            "SELECT count(*) FROM staff_access_change WHERE membership_id = ?",
            Integer.class,
            membershipId)).isEqualTo(4);
    }

    @Test
    void listIsOwnerOnlyAndNeverReturnsOwnerMemberships() throws Exception {
        Fixture fixture = fixture();
        createManager(fixture);

        mvc.perform(get(path(fixture)).with(token(fixture.ownerSubject())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalItems").value(1))
            .andExpect(jsonPath("$.items[0].email").value(fixture.managerEmail()));

        mvc.perform(get(path(fixture)).with(token(fixture.managerSubject())))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("STAFF_ACCESS_DENIED"));
    }

    @Test
    void invalidAccountsLocationsAndVersionsFailWithoutPartialWrites() throws Exception {
        Fixture fixture = fixture();
        UUID foreignOrganization = UUID.randomUUID();
        UUID foreignLocation = UUID.randomUUID();
        jdbc.update("INSERT INTO organization (id, name) VALUES (?, 'Foreign')", foreignOrganization);
        jdbc.update("""
            INSERT INTO location (id, organization_id, name, timezone, currency_code)
            VALUES (?, ?, 'Foreign', 'UTC', 'SGD')
            """, foreignLocation, foreignOrganization);

        mvc.perform(post(path(fixture)).with(token(fixture.ownerSubject()))
                .contentType("application/json")
                .content(addBody("unknown@example.test", fixture.locationOne())))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("MANAGER_ACCOUNT_NOT_FOUND"));

        mvc.perform(post(path(fixture)).with(token(fixture.ownerSubject()))
                .contentType("application/json")
                .content(addBody(fixture.managerEmail(), foreignLocation)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MANAGER_INVALID"));
        assertThat(jdbc.queryForObject(
            "SELECT count(*) FROM organization_membership WHERE organization_id = ? AND role = 'MANAGER'",
            Integer.class,
            fixture.organization())).isZero();

        UUID membershipId = createManager(fixture);
        mvc.perform(post(path(fixture) + "/" + membershipId + "/deactivate")
                .with(token(fixture.ownerSubject()))
                .contentType("application/json")
                .content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MANAGER_INVALID"));
        mvc.perform(put(path(fixture) + "/" + membershipId + "/assignments")
                .with(token(fixture.ownerSubject()))
                .contentType("application/json")
                .content(assignmentBody(99, fixture.locationTwo())))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MANAGER_VERSION_CONFLICT"));
        assertThat(jdbc.queryForObject(
            "SELECT count(*) FROM location_assignment WHERE membership_id = ? AND location_id = ?",
            Integer.class,
            membershipId,
            fixture.locationOne())).isEqualTo(1);
    }

    @Test
    void staffAccessLedgerIsDatabaseImmutable() {
        Fixture fixture = fixture();
        UUID membershipId = createManagerDirect(fixture);
        jdbc.update("""
            INSERT INTO staff_access_change (organization_id, membership_id, action, actor_account_id)
            VALUES (?, ?, 'CREATE', ?)
            """, fixture.organization(), membershipId, fixture.ownerAccount());
        assertThatThrownBy(() -> jdbc.update(
            "DELETE FROM staff_access_change WHERE membership_id = ?", membershipId))
            .isInstanceOf(DataAccessException.class)
            .hasMessageContaining("staff access changes are immutable");
    }

    private UUID createManager(Fixture fixture) throws Exception {
        mvc.perform(post(path(fixture)).with(token(fixture.ownerSubject()))
                .contentType("application/json")
                .content(addBody(fixture.managerEmail(), fixture.locationOne())))
            .andExpect(status().isCreated());
        return jdbc.queryForObject("""
            SELECT membership.id
              FROM organization_membership membership
              JOIN account ON account.id = membership.account_id
             WHERE membership.organization_id = ? AND account.id = ?
            """, UUID.class, fixture.organization(), fixture.managerAccount());
    }

    private UUID createManagerDirect(Fixture fixture) {
        return jdbc.queryForObject("""
            INSERT INTO organization_membership (organization_id, account_id, role)
            VALUES (?, ?, 'MANAGER') RETURNING id
            """, UUID.class, fixture.organization(), fixture.managerAccount());
    }

    private Fixture fixture() {
        UUID ownerSubject = UUID.randomUUID();
        UUID ownerAccount = UUID.randomUUID();
        UUID managerSubject = UUID.randomUUID();
        UUID managerAccount = UUID.randomUUID();
        UUID organization = UUID.randomUUID();
        UUID locationOne = UUID.randomUUID();
        UUID locationTwo = UUID.randomUUID();
        String suffix = ownerAccount.toString().substring(0, 8);
        String ownerEmail = "owner-" + suffix + "@example.test";
        String managerEmail = "manager-" + suffix + "@example.test";
        jdbc.update("INSERT INTO account (id, auth_subject, email, enabled) VALUES (?, ?, ?, true)",
            ownerAccount, ownerSubject, ownerEmail);
        jdbc.update("INSERT INTO account (id, auth_subject, email, enabled) VALUES (?, ?, ?, true)",
            managerAccount, managerSubject, managerEmail);
        jdbc.update("INSERT INTO organization (id, name) VALUES (?, 'Owner Org')", organization);
        jdbc.update("INSERT INTO organization_membership (organization_id, account_id, role) VALUES (?, ?, 'OWNER')",
            organization, ownerAccount);
        jdbc.update("""
            INSERT INTO location (id, organization_id, name, timezone, currency_code)
            VALUES (?, ?, 'North', 'Asia/Singapore', 'SGD'),
                   (?, ?, 'South', 'Asia/Singapore', 'SGD')
            """, locationOne, organization, locationTwo, organization);
        return new Fixture(ownerSubject, ownerAccount, managerSubject, managerAccount, managerEmail,
            organization, locationOne, locationTwo);
    }

    private String path(Fixture fixture) {
        return "/api/v1/staff/organizations/%s/managers".formatted(fixture.organization());
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor token(UUID subject) {
        return jwt().jwt(value -> value.subject(subject.toString()));
    }

    private String addBody(String email, UUID... locationIds) {
        return "{\"email\":\"%s\",\"locationIds\":%s}".formatted(email, uuidArray(locationIds));
    }

    private String assignmentBody(long version, UUID... locationIds) {
        return "{\"version\":%d,\"locationIds\":%s}".formatted(version, uuidArray(locationIds));
    }

    private String uuidArray(UUID... values) {
        return List.of(values).stream()
            .map(value -> "\"" + value + "\"")
            .collect(java.util.stream.Collectors.joining(",", "[", "]"));
    }

    private record Fixture(
        UUID ownerSubject,
        UUID ownerAccount,
        UUID managerSubject,
        UUID managerAccount,
        String managerEmail,
        UUID organization,
        UUID locationOne,
        UUID locationTwo
    ) { }
}
