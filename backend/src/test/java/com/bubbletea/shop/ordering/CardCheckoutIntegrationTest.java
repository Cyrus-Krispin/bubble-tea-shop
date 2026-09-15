package com.bubbletea.shop.ordering;

import com.bubbletea.shop.inventory.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@Testcontainers
@SpringBootTest(properties = {"app.security.supabase.enabled=true", "app.security.supabase.issuer=http://localhost:8000/auth/v1", "app.security.supabase.jwk-set-uri=http://localhost:8000/auth/v1/.well-known/jwks.json"})
@org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
class CardCheckoutIntegrationTest {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:18.4-alpine");
    @DynamicPropertySource static void database(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", POSTGRES::getJdbcUrl); r.add("spring.datasource.username", POSTGRES::getUsername); r.add("spring.datasource.password", POSTGRES::getPassword);
    }
    static final UUID ORG = UUID.fromString("10000000-0000-0000-0000-000000000001");
    static final UUID SOURCE = UUID.fromString("20000000-0000-0000-0000-000000000001");
    static final UUID VARIANT = UUID.fromString("50000000-0000-0000-0000-000000000002");
    @Autowired JdbcTemplate jdbc;
    @Autowired org.springframework.test.web.servlet.MockMvc mvc;
    @MockitoBean org.springframework.security.oauth2.jwt.JwtDecoder decoder;
    @Autowired CardCheckoutService cards;
    @Autowired GuestOrderPlacementService orders;
    @Autowired OrderCompletionService completion;
    @Autowired InventoryLedgerService ledger;
    @Autowired CashFlowService cashFlow;
    @MockitoBean CardPaymentProvider provider;
    UUID location, actor, subject;
    String slug;
    final Map<String, CardPaymentProvider.Session> sessions = new ConcurrentHashMap<>();
    final Map<String, CardPaymentProvider.Payment> payments = new ConcurrentHashMap<>();
    final List<GuestOrderPlacementService.CreateLine> lines = List.of(new GuestOrderPlacementService.CreateLine(VARIANT, 1, List.of(
        UUID.fromString("71000000-0000-0000-0000-000000000003"), UUID.fromString("71000000-0000-0000-0000-000000000007"))));

    @BeforeEach void setup() {
        location = UUID.randomUUID(); actor = UUID.randomUUID(); subject = UUID.randomUUID(); slug = "card-" + location;
        jdbc.update("INSERT INTO account (id, auth_subject, enabled) VALUES (?, ?, true)", actor, subject);
        jdbc.update("INSERT INTO organization_membership (organization_id, account_id, role) VALUES (?, ?, 'OWNER')", ORG, actor);
        jdbc.update("INSERT INTO location (id, organization_id, name, public_slug, timezone, currency_code) VALUES (?, ?, ?, ?, 'Asia/Singapore', 'SGD')", location, ORG, slug, slug);
        jdbc.update("""
            INSERT INTO menu_variant_offering (organization_id, location_id, menu_variant_id, recipe_version_id, price_minor, currency_code)
            SELECT organization_id, ?, menu_variant_id, recipe_version_id, price_minor, currency_code
              FROM menu_variant_offering WHERE location_id = ? AND menu_variant_id = ?
            """, location, SOURCE, VARIANT);
        jdbc.update("INSERT INTO inventory_balance (organization_id, location_id, ingredient_id, quantity) SELECT ?, ?, id, 10000 FROM ingredient WHERE organization_id = ?", ORG, location, ORG);
        when(provider.available()).thenReturn(true);
        when(provider.create(any())).thenAnswer(call -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            CardPaymentProvider.Checkout input = call.getArgument(0);
            var session = new CardPaymentProvider.Session("cs_" + input.id().toString().replace("-", ""), input.id(), "open", false,
                input.amountMinor(), input.currency(), null, "https://checkout.stripe.com/c/pay/test", input.expiresAt());
            sessions.put(session.id(), session); return session;
        });
        when(provider.retrieve(anyString())).thenAnswer(call -> { assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse(); return sessions.get(call.getArgument(0)); });
        when(provider.payment(anyString())).thenAnswer(call -> { assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse(); return payments.get(call.getArgument(0)); });
        when(provider.expire(anyString())).thenAnswer(call -> {
            String id = call.getArgument(0); var session = sessions.get(id);
            if (session.paid()) throw new CardPaymentException("CARD_PROVIDER_REJECTED", 503);
            var expired = new CardPaymentProvider.Session(id, session.checkoutId(), "expired", false, session.amountMinor(), session.currency(), null, null, session.expiresAt());
            sessions.put(id, expired); return expired;
        });
        when(provider.refund(anyString(), any())).thenAnswer(call -> {
            String intent = call.getArgument(0); var payment = payments.get(intent);
            var refund = new CardPaymentProvider.Refund("re_" + intent, intent, payment.amountMinor(), payment.currency(), "succeeded", Instant.now().minusSeconds(1));
            payments.put(intent, new CardPaymentProvider.Payment(intent, payment.amountMinor(), payment.currency(), true, payment.paidAt(), List.of(refund)));
            return refund;
        });
    }
    CardCheckoutService.Status create(UUID key) { return cards.create(slug, key, null, lines); }
    String sessionId(UUID checkout) { return jdbc.queryForObject("SELECT provider_session_id FROM card_checkout WHERE id = ?", String.class, checkout); }
    CardPaymentProvider.Payment pay(UUID checkout) {
        String id = sessionId(checkout); var session = sessions.get(id); String intent = "pi_" + checkout.toString().replace("-", "");
        var payment = new CardPaymentProvider.Payment(intent, session.amountMinor(), session.currency(), true, Instant.now().minusSeconds(2).truncatedTo(java.time.temporal.ChronoUnit.SECONDS), List.of());
        payments.put(intent, payment);
        sessions.put(id, new CardPaymentProvider.Session(id, checkout, "complete", true, session.amountMinor(), session.currency(), intent, null, session.expiresAt()));
        return payment;
    }
    @Test void reservesStockAndCompletesAPaidCardExactlyOnceWithoutRecollectingCash() {
        UUID key = UUID.randomUUID(); var checkout = create(key);
        assertThat(checkout.state()).isEqualTo("OPEN");
        assertThat(create(key).id()).isEqualTo(checkout.id());
        assertThatThrownBy(() -> orders.place(slug, key, null, lines)).isInstanceOf(GuestOrderIdempotencyConflictException.class);
        assertThatThrownBy(() -> completion.complete(checkout.order().id(), actor)).isInstanceOf(InvalidOrderStateException.class);
        jdbc.update("""
            UPDATE inventory_balance b SET quantity = r.quantity FROM inventory_reservation r
            WHERE r.customer_order_id = ? AND b.location_id = r.location_id AND b.ingredient_id = r.ingredient_id
            """, checkout.order().id());
        var cash = orders.place(slug, UUID.randomUUID(), null, lines);
        assertThatThrownBy(() -> completion.complete(cash.id(), actor)).isInstanceOf(InsufficientStockException.class);
        UUID ingredient = jdbc.queryForObject("SELECT ingredient_id FROM inventory_reservation WHERE customer_order_id = ? LIMIT 1", UUID.class, checkout.order().id());
        assertThatThrownBy(() -> ledger.recordManualMovement(new InventoryLedgerService.ManualMovement(ORG, location, ingredient,
            InventoryMovementType.ADJUSTMENT, BigDecimal.ONE.negate(), actor, null, "Count", null, null))).isInstanceOf(InsufficientStockException.class);
        var payment = pay(checkout.id());
        assertThat(cards.refresh(checkout.id()).state()).isEqualTo("PAID");
        assertThat(completion.complete(checkout.order().id(), actor).alreadyCompleted()).isFalse();
        assertThat(completion.complete(checkout.order().id(), actor).alreadyCompleted()).isTrue();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM inventory_reservation WHERE customer_order_id = ? AND active", Integer.class, checkout.order().id())).isZero();
        assertThat(jdbc.queryForObject("SELECT quantity FROM inventory_balance WHERE location_id = ? AND ingredient_id = ?", BigDecimal.class, location, ingredient)).isEqualByComparingTo("0");
        assertThat(jdbc.queryForObject("SELECT paid_at FROM payment WHERE customer_order_id = ?", java.sql.Timestamp.class, checkout.order().id()).toInstant())
            .isEqualTo(payment.paidAt().truncatedTo(java.time.temporal.ChronoUnit.MICROS));
    }
    @Test void verifiesExpiryBeforeReleasingReservationsAndCancelling() {
        var checkout = create(UUID.randomUUID());
        assertThat(cards.cancelGuest(checkout.id()).state()).isEqualTo("EXPIRED");
        assertThat(cards.status(checkout.id()).order().status()).isEqualTo("CANCELLED");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM inventory_reservation WHERE customer_order_id = ? AND active", Integer.class, checkout.order().id())).isZero();
        verify(provider).expire(sessionId(checkout.id()));
    }
    @Test void recordsARefundAsOutflowWithoutErasingIncomeOrRestockingACompletedDrink() {
        var checkout = create(UUID.randomUUID()); pay(checkout.id()); cards.refresh(checkout.id());
        completion.complete(checkout.order().id(), actor);
        provider.refund(payments.values().stream().filter(p -> p.id().endsWith(checkout.id().toString().replace("-", ""))).findFirst().orElseThrow().id(), checkout.id());
        assertThat(cards.refresh(checkout.id()).state()).isEqualTo("REFUNDED");
        assertThat(cards.status(checkout.id()).order().status()).isEqualTo("COMPLETED");
        assertThat(completion.complete(checkout.order().id(), actor).alreadyCompleted()).isTrue();
        long movements = jdbc.queryForObject("SELECT count(*) FROM inventory_movement WHERE customer_order_id = ?", Long.class, checkout.order().id());
        cards.refresh(checkout.id());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM inventory_movement WHERE customer_order_id = ?", Long.class, checkout.order().id())).isEqualTo(movements);
        var total = cashFlow.report(subject, ORG, location, 1, 0).totals().getFirst();
        assertThat(total.incomeMinor()).isEqualTo(checkout.order().totalMinor());
        assertThat(total.outflowMinor()).isEqualTo(checkout.order().totalMinor());
        assertThat(total.netMinor()).isZero();
    }
    @Test void staffCancellationRefundsPaidPendingOrdersBeforeReleasingStock() {
        var checkout = create(UUID.randomUUID()); pay(checkout.id()); cards.refresh(checkout.id());
        assertThatThrownBy(() -> cards.cancelGuest(checkout.id())).isInstanceOf(CardPaymentException.class);
        var cancelled = cards.staffRefresh(subject, ORG, location, checkout.order().id(), true);
        assertThat(cancelled.state()).isEqualTo("REFUNDED"); assertThat(cancelled.order().status()).isEqualTo("CANCELLED");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM inventory_movement WHERE customer_order_id = ?", Integer.class, checkout.order().id())).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM inventory_reservation WHERE customer_order_id = ? AND active", Integer.class, checkout.order().id())).isZero();
    }
    @Test void rejectsProviderAmountMismatchesWithoutMarkingPaidOrReleasingStock() {
        var checkout = create(UUID.randomUUID()); var payment = pay(checkout.id());
        payments.put(payment.id(), new CardPaymentProvider.Payment(payment.id(), payment.amountMinor() + 1, payment.currency(), true, payment.paidAt(), List.of()));
        assertThat(cards.refresh(checkout.id()).state()).isEqualTo("REVIEW_REQUIRED");
        assertThat(jdbc.queryForObject("SELECT status FROM payment WHERE customer_order_id = ?", String.class, checkout.order().id())).isEqualTo("PENDING");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM inventory_reservation WHERE customer_order_id = ? AND active", Integer.class, checkout.order().id())).isPositive();
    }
    @Test void rejectedCreationNeverReopensACancelledOrder() {
        doThrow(new CardPaymentException("CARD_PROVIDER_REJECTED", 503)).when(provider).create(any());
        UUID key = UUID.randomUUID(); var checkout = create(key);
        assertThat(checkout.state()).isEqualTo("FAILED");
        assertThat(create(key).state()).isEqualTo("FAILED");
        cards.reconcileDue();
        verify(provider, times(1)).create(any());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM inventory_reservation WHERE customer_order_id = ? AND active", Integer.class, checkout.order().id())).isZero();
    }
    @Test void disabledProviderHidesExistingHostedPaymentLink() {
        var checkout = create(UUID.randomUUID());
        when(provider.available()).thenReturn(false);
        assertThat(cards.status(checkout.id()).checkoutUrl()).isNull();
        assertThat(cards.status(checkout.id()).recoveryCode()).isEqualTo("CARD_UNAVAILABLE");
    }
    @Test void ambiguousProviderFailureRetainsTheSameOrderAndStockReservation() {
        doThrow(new CardPaymentException("CARD_PROVIDER_UNAVAILABLE", 503)).when(provider).create(any());
        UUID key = UUID.randomUUID(); var checkout = create(key);
        assertThat(checkout.state()).isEqualTo("CREATING");
        assertThat(create(key).id()).isEqualTo(checkout.id());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM inventory_reservation WHERE customer_order_id = ? AND active", Integer.class, checkout.order().id())).isPositive();
        assertThat(checkout.order().status()).isEqualTo("PENDING");
    }
    @Test void failedRefundKeepsStockAndPreventsCompletionUntilRecovery() {
        var checkout = create(UUID.randomUUID()); pay(checkout.id()); cards.refresh(checkout.id());
        doThrow(new CardPaymentException("CARD_PROVIDER_UNAVAILABLE", 503)).when(provider).refund(anyString(), any());
        var result = cards.staffRefresh(subject, ORG, location, checkout.order().id(), true);
        assertThat(result.cancellationRequested()).isTrue();
        assertThat(result.order().status()).isEqualTo("PENDING");
        assertThatThrownBy(() -> completion.complete(checkout.order().id(), actor)).isInstanceOf(InvalidOrderStateException.class);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM inventory_reservation WHERE customer_order_id = ? AND active", Integer.class, checkout.order().id())).isPositive();
    }
    @Test void failedRefundNeedsReviewAndDoesNotIssueAReplacementRefund() {
        var checkout = create(UUID.randomUUID()); var payment = pay(checkout.id()); cards.refresh(checkout.id());
        var failed = new CardPaymentProvider.Refund("re_failed", payment.id(), payment.amountMinor(), payment.currency(), "failed", Instant.now());
        payments.put(payment.id(), new CardPaymentProvider.Payment(payment.id(), payment.amountMinor(), payment.currency(), true, payment.paidAt(), List.of(failed)));
        assertThat(cards.staffRefresh(subject, ORG, location, checkout.order().id(), true).state()).isEqualTo("REVIEW_REQUIRED");
        assertThat(cards.refresh(checkout.id()).state()).isEqualTo("REVIEW_REQUIRED");
        verify(provider, never()).refund(anyString(), any());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM inventory_reservation WHERE customer_order_id = ? AND active", Integer.class, checkout.order().id())).isPositive();
    }
    @Test void recoversAHiddenSessionAfterItsCreationExpiryWindowCloses() {
        var checkout = create(UUID.randomUUID()); var session = sessions.get(sessionId(checkout.id()));
        Instant expiry = Instant.now().plusSeconds(1200).truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
        var hidden = new CardPaymentProvider.Session(session.id(), session.checkoutId(), "open", false, session.amountMinor(), session.currency(), null, session.url(), expiry);
        sessions.put(hidden.id(), hidden);
        jdbc.update("UPDATE card_checkout SET provider_session_id = NULL, expires_at = ?, created_at = now() - interval '40 minutes' WHERE id = ?", java.sql.Timestamp.from(expiry), checkout.id());
        when(provider.findCheckout(eq(checkout.id()), any())).thenReturn(hidden);
        assertThat(cards.refresh(checkout.id()).state()).isEqualTo("OPEN");
        assertThat(sessionId(checkout.id())).isEqualTo(hidden.id());
        verify(provider, times(1)).create(any());
    }
    @Test void concurrentCardsCannotReserveTheSameLastDrink() throws Exception {
        var first = create(UUID.randomUUID());
        jdbc.update("UPDATE inventory_balance b SET quantity = r.quantity FROM inventory_reservation r WHERE r.customer_order_id = ? AND b.location_id = r.location_id AND b.ingredient_id = r.ingredient_id", first.order().id());
        cards.cancelGuest(first.id());
        var start = new java.util.concurrent.CountDownLatch(1);
        try (var pool = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
            java.util.concurrent.Callable<Boolean> place = () -> { start.await(); try { create(UUID.randomUUID()); return true; } catch (InsufficientStockException expected) { return false; } };
            var a = pool.submit(place); var b = pool.submit(place); start.countDown();
            assertThat(List.of(a.get(), b.get())).containsExactlyInAnyOrder(true, false);
        }
    }
    @Test void apiKeepsGuestRecoveryPublicAndStaffMutationsScoped() throws Exception {
        var checkout = create(UUID.randomUUID());
        String base = "/api/v1/staff/organizations/" + ORG + "/locations/" + location + "/orders/" + checkout.order().id() + "/card-payment/refresh";
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/guest/payment-methods"))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.card").value(true));
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/guest/card-checkouts/" + checkout.id()))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(base))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isUnauthorized());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(base)
            .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt().jwt(t -> t.subject(subject.toString()))))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(base.replace(location.toString(), SOURCE.toString()))
            .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt().jwt(t -> t.subject(subject.toString()))))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isNotFound());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/payments/stripe/webhook").content("{}"))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/payments/stripe/webhook").content(new byte[1_048_577]))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isPayloadTooLarge());
    }
    @Test void duplicateWebhookEventsOnlyScheduleServerVerification() {
        var checkout = create(UUID.randomUUID()); pay(checkout.id());
        when(provider.verifySignature(any(), eq("valid"))).thenReturn(true);
        when(provider.event(any())).thenReturn(new CardPaymentProvider.Event(sessionId(checkout.id()), null, checkout.id()));
        cards.webhook(new byte[]{1}, "valid"); cards.webhook(new byte[]{1}, "valid");
        assertThat(cards.status(checkout.id()).state()).isEqualTo("OPEN");
        cards.reconcileDue();
        assertThat(cards.status(checkout.id()).state()).isEqualTo("PAID");
        assertThatThrownBy(() -> cards.webhook(new byte[]{1}, "invalid")).isInstanceOf(CardPaymentException.class);
    }
}
