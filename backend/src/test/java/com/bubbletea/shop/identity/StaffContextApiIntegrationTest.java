package com.bubbletea.shop.identity;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Testcontainers
@SpringBootTest(properties = {
    "app.security.supabase.enabled=true",
    "app.security.supabase.issuer=http://localhost:8000/auth/v1",
    "app.security.supabase.jwk-set-uri=http://localhost:8000/auth/v1/.well-known/jwks.json"
})
@AutoConfigureMockMvc
class StaffContextApiIntegrationTest {
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
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @MockitoBean
    JwtDecoder jwtDecoder;

    @Test
    void returnsCurrentServerOwnedStaffContextForVerifiedSubject() throws Exception {
        UUID authSubject = UUID.randomUUID();
        UUID accountId = account(authSubject, true);
        UUID organizationId = organization("Bubble Tea Operations");
        membership(organizationId, accountId, "OWNER", true);
        UUID locationId = location(organizationId, "Orchard Central", true);

        mvc.perform(get("/api/v1/staff/context")
                .with(jwt().jwt(token -> token.subject(authSubject.toString()))))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith("application/json"))
            .andExpect(jsonPath("$.accountId").value(accountId.toString()))
            .andExpect(jsonPath("$.memberships.length()").value(1))
            .andExpect(jsonPath("$.memberships[0].organizationId")
                .value(organizationId.toString()))
            .andExpect(jsonPath("$.memberships[0].organizationName")
                .value("Bubble Tea Operations"))
            .andExpect(jsonPath("$.memberships[0].role").value("OWNER"))
            .andExpect(jsonPath("$.memberships[0].locations[0].id")
                .value(locationId.toString()))
            .andExpect(jsonPath("$.memberships[0].locations[0].timezone")
                .value("Asia/Singapore"))
            .andExpect(jsonPath("$.memberships[0].locations[0].defaultLocale")
                .value("en-SG"))
            .andExpect(jsonPath("$.memberships[0].locations[0].currencyCode")
                .value("SGD"));
    }

    @Test
    void rejectsAnonymousAndInvalidIdentitySubjects() throws Exception {
        mvc.perform(get("/api/v1/staff/context"))
            .andExpect(status().isUnauthorized());

        mvc.perform(get("/api/v1/staff/context")
                .with(jwt().jwt(token -> token.subject("not-a-uuid"))))
            .andExpect(status().isUnauthorized())
            .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
            .andExpect(jsonPath("$.code").value("STAFF_IDENTITY_INVALID"));
        mvc.perform(get("/api/v1/staff/context")
                .with(jwt().jwt(token -> token.claims(claims -> claims.remove("sub")))))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("STAFF_IDENTITY_INVALID"));
    }

    @Test
    void deniesUnmappedAndCustomerOnlyIdentitiesWithoutRevealingWhichConditionFailed()
        throws Exception {
        UUID customerOnly = UUID.randomUUID();
        account(customerOnly, true);

        mvc.perform(get("/api/v1/staff/context")
                .with(jwt().jwt(token -> token.subject(UUID.randomUUID().toString()))))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("STAFF_ACCESS_DENIED"));
        mvc.perform(get("/api/v1/staff/context")
                .with(jwt().jwt(token -> token.subject(customerOnly.toString()))))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("STAFF_ACCESS_DENIED"));
    }

    @Test
    void reportsDisabledMappedAccountWithStableProblemCode() throws Exception {
        UUID disabled = UUID.randomUUID();
        account(disabled, false);

        mvc.perform(get("/api/v1/staff/context")
                .with(jwt().jwt(token -> token.subject(disabled.toString()))))
            .andExpect(status().isForbidden())
            .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
            .andExpect(jsonPath("$.code").value("STAFF_ACCOUNT_DISABLED"));
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

    private void membership(UUID organizationId, UUID accountId, String role, boolean active) {
        jdbc.update("""
            INSERT INTO organization_membership (
                id, organization_id, account_id, role, active
            ) VALUES (?, ?, ?, ?, ?)
            """, UUID.randomUUID(), organizationId, accountId, role, active);
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
}
