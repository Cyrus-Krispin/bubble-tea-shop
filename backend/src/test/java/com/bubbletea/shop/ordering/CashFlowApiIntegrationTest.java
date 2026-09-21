package com.bubbletea.shop.ordering;

import org.junit.jupiter.api.BeforeEach;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Testcontainers
@SpringBootTest(properties = {"app.security.supabase.enabled=true", "app.security.supabase.issuer=http://localhost:8000/auth/v1", "app.security.supabase.jwk-set-uri=http://localhost:8000/auth/v1/.well-known/jwks.json"})
@AutoConfigureMockMvc
class CashFlowApiIntegrationTest {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:18.4-alpine");
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean JwtDecoder decoder;
    UUID org, loc, actor, subject;
    String path;
    @BeforeEach void scope() {
        org = UUID.randomUUID(); loc = UUID.randomUUID(); actor = UUID.randomUUID(); subject = UUID.randomUUID();
        jdbc.update("INSERT INTO organization (id, name) VALUES (?, 'Cash flow test')", org);
        jdbc.update("INSERT INTO location (id, organization_id, name, timezone, currency_code) VALUES (?, ?, 'Shop', 'Asia/Singapore', 'SGD')", loc, org);
        jdbc.update("INSERT INTO account (id, auth_subject, enabled) VALUES (?, ?, true)", actor, subject);
        jdbc.update("INSERT INTO organization_membership (organization_id, account_id, role) VALUES (?, ?, 'OWNER')", org, actor);
        path = "/api/v1/staff/organizations/" + org + "/locations/" + loc + "/cash-flow";
    }
    @Test void recordsReplaysVoidsAndPreservesImmutableExpenses() throws Exception {
        UUID key = UUID.randomUUID();
        String body = "{\"amountMinor\":1200,\"description\":\"Tea delivery paid\"}";
        mvc.perform(post(path + "/expenses").with(jwt().jwt(t -> t.subject(subject.toString())))
            .header("Idempotency-Key", key).contentType("application/json").content(body))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.amountMinor").value(1200));
        mvc.perform(post(path + "/expenses").with(jwt().jwt(t -> t.subject(subject.toString())))
            .header("Idempotency-Key", key).contentType("application/json").content(body))
            .andExpect(status().isOk()).andExpect(jsonPath("$.replayed").value(true));
        mvc.perform(post(path + "/expenses").with(jwt().jwt(t -> t.subject(subject.toString())))
            .header("Idempotency-Key", key).contentType("application/json").content(body.replace("1200", "1300")))
            .andExpect(status().isConflict());
        mvc.perform(get(path).with(jwt().jwt(t -> t.subject(subject.toString()))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totals[0].outflowMinor").value(1200))
            .andExpect(jsonPath("$.totals[0].netMinor").value(-1200)).andExpect(jsonPath("$.daily.length()").value(7));
        UUID expense = jdbc.queryForObject("SELECT id FROM cash_expense WHERE request_key = ?", UUID.class, key);
        assertThat(jdbc.queryForObject("SELECT recorded_by_account_id FROM cash_expense WHERE id = ?", UUID.class, expense)).isEqualTo(actor);
        for (int i = 0; i < 2; i++) mvc.perform(post(path + "/expenses/" + expense + "/void")
            .with(jwt().jwt(t -> t.subject(subject.toString()))).contentType("application/json").content("{\"reason\":\"Duplicate paper entry\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.voided").value(true));
        mvc.perform(get(path).with(jwt().jwt(t -> t.subject(subject.toString()))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totals[0].outflowMinor").value(0))
            .andExpect(jsonPath("$.expenses[0].voided").value(true));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM cash_expense_void WHERE expense_id = ?", Integer.class, expense)).isEqualTo(1);
        assertThatThrownBy(() -> jdbc.update("UPDATE cash_expense SET amount_minor = 1 WHERE id = ?", expense)).isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("DELETE FROM cash_expense_void WHERE expense_id = ?", expense)).isInstanceOf(org.springframework.dao.DataAccessException.class);
    }
    @Test void rejectsInvalidAndUnscopedRequests() throws Exception {
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        mvc.perform(get(path).with(jwt().jwt(t -> t.subject(UUID.randomUUID().toString())))).andExpect(status().isForbidden());
        mvc.perform(get(path).param("days", "2").with(jwt().jwt(t -> t.subject(subject.toString())))).andExpect(status().isBadRequest());
        mvc.perform(post(path + "/expenses").with(jwt().jwt(t -> t.subject(subject.toString())))
            .header("Idempotency-Key", UUID.randomUUID()).contentType("application/json").content("{\"amountMinor\":-1,\"description\":\"Bad\"}"))
            .andExpect(status().isBadRequest());
    }
    @Test void countsOnlyPaidPaymentsInLocalCalendarWindowsAndSeparatesCurrencies() throws Exception {
        payment(500, "SGD", 0, true); payment(900, "SGD", 1, true);
        payment(700, "MYR", 0, true); payment(4000, "SGD", 0, false); payment(9900, "SGD", 30, true);
        mvc.perform(get(path).param("days", "1").with(jwt().jwt(t -> t.subject(subject.toString()))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totals[?(@.currencyCode == 'SGD')].incomeMinor").value(500))
            .andExpect(jsonPath("$.totals[?(@.currencyCode == 'MYR')].incomeMinor").value(700)).andExpect(jsonPath("$.daily.length()").value(2));
        for (String days : new String[]{"7", "30"}) mvc.perform(get(path).param("days", days).with(jwt().jwt(t -> t.subject(subject.toString()))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totals[?(@.currencyCode == 'SGD')].incomeMinor").value(1400));
    }
    private void payment(int amount, String currency, int daysAgo, boolean paid) {
        UUID order = UUID.randomUUID();
        jdbc.update("INSERT INTO customer_order (id, organization_id, location_id, public_order_number, status, payment_method, currency_code, subtotal_minor, total_minor) VALUES (?, ?, ?, ?, 'PENDING', 'CASH', ?, ?, ?)", order, org, loc, order.toString().substring(0, 12), currency, amount, amount);
        jdbc.update("INSERT INTO payment (organization_id, customer_order_id, method, status, amount_minor, currency_code, paid_at, recorded_by_account_id) VALUES (?, ?, 'CASH', ?, ?, ?, CASE WHEN ? THEN (date_trunc('day', now() AT TIME ZONE 'Asia/Singapore') - (? * interval '1 day')) AT TIME ZONE 'Asia/Singapore' ELSE NULL END, ?)", org, order, paid ? "PAID" : "PENDING", amount, currency, paid, daysAgo, paid ? actor : null);
    }
}
