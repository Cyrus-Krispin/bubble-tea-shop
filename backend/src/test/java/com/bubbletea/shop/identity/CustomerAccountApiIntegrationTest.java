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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Testcontainers
@SpringBootTest(properties = {
    "app.security.supabase.enabled=true",
    "app.security.supabase.issuer=http://localhost:8000/auth/v1",
    "app.security.supabase.jwk-set-uri=http://localhost:8000/auth/v1/.well-known/jwks.json"
})
@AutoConfigureMockMvc
class CustomerAccountApiIntegrationTest {
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
    void verifiedCustomerIdentityCreatesOneApplicationAccountWithoutMembership() throws Exception {
        UUID authSubject = UUID.randomUUID();

        mvc.perform(post("/api/v1/customer/account")
                .with(jwt().jwt(token -> token
                    .subject(authSubject.toString())
                    .claim("email", "customer@example.test"))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").isNotEmpty())
            .andExpect(jsonPath("$.email").value("customer@example.test"));

        mvc.perform(post("/api/v1/customer/account")
                .with(jwt().jwt(token -> token
                    .subject(authSubject.toString())
                    .claim("email", "customer@example.test"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value("customer@example.test"));

        assertThat(jdbc.queryForObject(
            "SELECT count(*) FROM account WHERE auth_subject = ?",
            Integer.class,
            authSubject)).isEqualTo(1);
        assertThat(jdbc.queryForObject(
            "SELECT email FROM account WHERE auth_subject = ?",
            String.class,
            authSubject)).isEqualTo("customer@example.test");
        assertThat(jdbc.queryForObject(
            "SELECT count(*) FROM organization_membership membership "
                + "JOIN account ON account.id = membership.account_id "
                + "WHERE account.auth_subject = ?",
            Integer.class,
            authSubject)).isZero();
    }

    @Test
    void anonymousCustomerCannotProvisionAnAccount() throws Exception {
        mvc.perform(post("/api/v1/customer/account"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void apiDocumentationIsDisabledByDefault() throws Exception {
        mvc.perform(get("/v3/api-docs"))
            .andExpect(status().isNotFound());
        mvc.perform(get("/swagger-ui.html"))
            .andExpect(status().isNotFound());
    }
}
