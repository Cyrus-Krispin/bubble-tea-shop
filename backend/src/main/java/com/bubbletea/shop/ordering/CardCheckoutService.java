package com.bubbletea.shop.ordering;

import com.bubbletea.shop.inventory.InventoryReservationService;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;

/** Transactions protect local state; every provider request runs after its transaction has committed. */
@Service
public class CardCheckoutService {
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final GuestOrderPlacementService placement;
    private final InventoryReservationService inventory;
    private final CardPaymentProvider provider;
    private final OrderStaffAccessService staff;
    public CardCheckoutService(JdbcTemplate jdbc, PlatformTransactionManager transactions,
        GuestOrderPlacementService placement, InventoryReservationService inventory,
        CardPaymentProvider provider, OrderStaffAccessService staff) {
        this.jdbc = jdbc; this.tx = new TransactionTemplate(transactions); this.placement = placement;
        this.inventory = inventory; this.provider = provider; this.staff = staff;
    }
    public boolean available() { return provider.available(); }

    public Status create(String slug, UUID key, UUID subject, List<GuestOrderPlacementService.CreateLine> lines) {
        if (!available()) throw new CardPaymentException("CARD_UNAVAILABLE", 503);
        UUID id = tx.execute(ignored -> {
            var order = placement.placeCard(slug, key, subject, lines);
            var existing = jdbc.query("SELECT id FROM card_checkout WHERE customer_order_id = ?", (rs, n) -> rs.getObject(1, UUID.class), order.id());
            if (!existing.isEmpty()) return existing.getFirst();
            if (order.totalMinor() <= 0) throw new CardPaymentException("CARD_AMOUNT_UNSUPPORTED", 400);
            var scope = jdbc.queryForObject("SELECT organization_id, location_id FROM customer_order WHERE id = ? FOR UPDATE",
                (rs, n) -> new UUID[]{rs.getObject(1, UUID.class), rs.getObject(2, UUID.class)}, order.id());
            var demand = new LinkedHashMap<UUID, BigDecimal>();
            jdbc.query("""
                SELECT c.ingredient_id, SUM(c.quantity) AS quantity FROM order_item_consumption c
                JOIN order_item i ON i.id = c.order_item_id WHERE i.customer_order_id = ? GROUP BY c.ingredient_id
                """, (org.springframework.jdbc.core.RowCallbackHandler) rs -> demand.put(rs.getObject(1, UUID.class), rs.getBigDecimal(2)), order.id());
            inventory.reserve(order.id(), scope[0], scope[1], demand);
            UUID checkout = UUID.randomUUID();
            jdbc.update("""
                INSERT INTO card_checkout (id, customer_order_id, organization_id, location_id, expires_at)
                VALUES (?, ?, ?, ?, date_trunc('second', now()) + interval '1 hour')
                """, checkout, order.id(), scope[0], scope[1]);
            return checkout;
        });
        reconcile(id);
        return status(id);
    }

    public Status status(UUID id) {
        return tx.execute(ignored -> {
            Row row = row(id);
            return new Status(id, row.state(), available() && row.state().equals("OPEN") && !row.cancelRequested() ? row.url() : null,
                row.expiresAt(), row.cancelRequested(), available() ? row.error() : "CARD_UNAVAILABLE", refunded(row.orderId()), placement.loadOrder(row.orderId(), true));
        });
    }
    public Status refresh(UUID id) { row(id); reconcile(id); return status(id); }
    public Status cancelGuest(UUID id) { cancel(id, null); reconcile(id); return status(id); }
    public Status staffRefresh(UUID subject, UUID org, UUID location, UUID orderId, boolean cancel) {
        UUID actor = staff.authorize(subject, org, location);
        UUID id = jdbc.query("SELECT id FROM card_checkout WHERE customer_order_id = ? AND organization_id = ? AND location_id = ?",
            (rs, n) -> rs.getObject(1, UUID.class), orderId, org, location).stream().findFirst().orElseThrow(() -> new OrderNotFoundException(orderId));
        if (cancel) cancel(id, actor);
        reconcile(id); return status(id);
    }
    private void cancel(UUID id, UUID actor) {
        tx.executeWithoutResult(ignored -> {
            Row row = lock(id);
            if (row.orderStatus().equals("CANCELLED")) return;
            if (!row.orderStatus().equals("PENDING") || (actor == null && hasRecordedPayment(row.orderId()))) {
                throw new CardPaymentException("CARD_CANNOT_CANCEL", 409);
            }
            jdbc.update("""
                UPDATE card_checkout SET cancel_requested = true, state = CASE WHEN state = 'PAID' THEN 'REFUND_PENDING' ELSE state END, cancel_actor_id = COALESCE(cancel_actor_id, ?),
                    reconcile_requested = true, reconcile_version = reconcile_version + 1, updated_at = now() WHERE id = ?
                """, actor, id);
        });
    }

    /** A signed event only schedules verification. It cannot mark an order paid. */
    public void webhook(byte[] body, String signature) {
        if (!provider.verifySignature(body, signature)) throw new CardPaymentException("CARD_WEBHOOK_INVALID", 400);
        var event = provider.event(body);
        if (event.checkoutId() != null) {
            jdbc.update("""
                UPDATE card_checkout SET provider_session_hint = COALESCE(provider_session_hint, ?),
                    reconcile_requested = true, reconcile_version = reconcile_version + 1
                WHERE id = ? AND (provider_session_id IS NULL OR provider_session_id = ?)
                """, event.sessionId(), event.checkoutId(), event.sessionId());
        } else if (event.paymentIntentId() != null) {
            jdbc.update("""
                UPDATE card_checkout SET reconcile_requested = true, reconcile_version = reconcile_version + 1
                WHERE provider_payment_intent_id = ?
                """, event.paymentIntentId());
        }
    }

    public void reconcileDue() {
        if (!available()) return;
        var due = jdbc.query("""
            SELECT c.id FROM card_checkout c JOIN customer_order o ON o.id = c.customer_order_id
            WHERE (c.lease_until IS NULL OR c.lease_until < now())
              AND (c.reconcile_requested OR c.state IN ('CREATING','OPEN','REFUND_PENDING','REVIEW_REQUIRED')
                   OR (c.state = 'PAID' AND o.status = 'PENDING'))
            ORDER BY c.last_checked_at NULLS FIRST LIMIT 25
            """, (rs, n) -> rs.getObject(1, UUID.class));
        for (UUID id : due) reconcile(id);
    }
    void reconcile(UUID id) {
        if (!available()) return;
        UUID token = UUID.randomUUID();
        Row claim = tx.execute(ignored -> {
            int claimed = jdbc.update("""
                UPDATE card_checkout SET lease_until = now() + interval '3 minutes', lease_token = ?,
                    creation_attempts = creation_attempts + CASE WHEN provider_session_id IS NULL AND provider_session_hint IS NULL THEN 1 ELSE 0 END
                WHERE id = ? AND (lease_until IS NULL OR lease_until < now())
                  AND NOT (state IN ('FAILED','EXPIRED','REFUNDED') AND provider_session_id IS NULL AND provider_session_hint IS NULL)
                """, token, id);
            return claimed == 1 ? row(id) : null;
        });
        if (claim == null) return;
        try {
            String sessionId = claim.sessionId() == null ? claim.sessionHint() : claim.sessionId();
            if (sessionId == null) {
                CardPaymentProvider.Session created;
                if (claim.expiresAt().isBefore(Instant.now().plusSeconds(31 * 60))) {
                    // Validation may run before provider idempotency replay. Retrieve a hidden session
                    // instead of retrying creation with an expiry that is now too close or already past.
                    created = provider.findCheckout(id, claim.createdAt());
                    if (created == null) throw new CardPaymentException("CARD_REVIEW_REQUIRED", 503);
                } else {
                    created = provider.create(new CardPaymentProvider.Checkout(id, claim.orderId(), claim.number(), claim.amount(), claim.currency(), claim.expiresAt()));
                }
                validate(claim, created);
                tx.executeWithoutResult(ignored -> {
                    lock(id);
                    jdbc.update("UPDATE card_checkout SET provider_session_id = ? WHERE id = ? AND provider_session_id IS NULL", created.id(), id);
                });
                sessionId = created.id();
            }
            var session = provider.retrieve(sessionId);
            validate(claim, session);
            if ((claim.cancelRequested() || claim.orderStatus().equals("CANCELLED")) && session.status().equals("open")) {
                try { session = provider.expire(sessionId); }
                catch (CardPaymentException error) {
                    if (!error.code().equals("CARD_PROVIDER_REJECTED")) throw error;
                    session = provider.retrieve(sessionId); // Expiry can race a completed payment.
                }
                validate(claim, session);
            }
            CardPaymentProvider.Payment payment = session.paid() ? provider.payment(session.paymentIntentId()) : null;
            if (payment != null && (claim.cancelRequested() && claim.orderStatus().equals("PENDING") || claim.orderStatus().equals("CANCELLED"))) {
                validate(claim, session, payment);
                long returned = payment.refunds().stream().filter(r -> r.status().equals("succeeded")).mapToLong(CardPaymentProvider.Refund::amountMinor).sum();
                if (returned < claim.amount() && payment.refunds().stream().allMatch(r -> r.status().equals("succeeded"))) provider.refund(payment.id(), id);
                payment = provider.payment(payment.id());
            }
            var finalSession = session; var finalPayment = payment;
            tx.executeWithoutResult(ignored -> apply(lock(id), finalSession, finalPayment));
            finish(id, token, claim.generation(), null);
        } catch (CardPaymentException error) {
            tx.executeWithoutResult(ignored -> {
                Row latest = lock(id);
                boolean firstRejection = error.code().equals("CARD_PROVIDER_REJECTED") && claim.attempts() == 1
                    && latest.sessionId() == null && latest.sessionHint() == null && latest.state().equals("CREATING");
                if (firstRejection) {
                    cancelOrder(latest); jdbc.update("UPDATE payment SET status = 'FAILED', updated_at = now() WHERE customer_order_id = ? AND status = 'PENDING'", latest.orderId());
                    jdbc.update("UPDATE card_checkout SET state = 'FAILED' WHERE id = ?", id);
                } else if (error.code().equals("CARD_PROVIDER_MISMATCH") || error.code().equals("CARD_REVIEW_REQUIRED")) {
                    jdbc.update("UPDATE card_checkout SET state = 'REVIEW_REQUIRED' WHERE id = ? AND state NOT IN ('REFUNDED','EXPIRED','FAILED')", id);
                }
            });
            finish(id, token, claim.generation(), error.code());
        } catch (RuntimeException error) {
            // Keep durable work queued after a database/process failure. Do not expose SQL/provider data.
            finish(id, token, claim.generation(), "CARD_RECONCILIATION_PENDING");
        }
    }

    private void apply(Row row, CardPaymentProvider.Session session, CardPaymentProvider.Payment payment) {
        validate(row, session);
        jdbc.update("""
            UPDATE card_checkout SET provider_session_id = ?, provider_payment_intent_id = COALESCE(provider_payment_intent_id, ?),
                checkout_url = ?, updated_at = now() WHERE id = ?
            """, session.id(), session.paymentIntentId(), session.url(), row.id());
        if (session.paid()) {
            validate(row, session, payment);
            int changed = jdbc.update("""
                UPDATE payment SET status = CASE WHEN status = 'REFUNDED' THEN status ELSE 'PAID' END,
                    paid_at = COALESCE(paid_at, ?), updated_at = now()
                WHERE customer_order_id = ? AND method = 'CARD' AND amount_minor = ? AND currency_code = ?
                """, Timestamp.from(payment.paidAt()), row.orderId(), row.amount(), row.currency());
            if (changed != 1) throw new CardPaymentException("CARD_PROVIDER_MISMATCH", 503);
            for (var refund : payment.refunds()) {
                if (!refund.paymentIntentId().equals(payment.id()) || !refund.currency().equals(row.currency()) || refund.amountMinor() <= 0 || refund.amountMinor() > row.amount()) {
                    throw new CardPaymentException("CARD_PROVIDER_MISMATCH", 503);
                }
                if (!refund.status().equals("succeeded")) continue;
                jdbc.update("""
                    INSERT INTO card_refund (provider_refund_id, customer_order_id, organization_id, location_id, currency_code, amount_minor, refunded_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (provider_refund_id) DO NOTHING
                    """, refund.id(), row.orderId(), row.org(), row.location(), row.currency(), refund.amountMinor(), Timestamp.from(refund.createdAt()));
                if (!Boolean.TRUE.equals(jdbc.queryForObject("""
                    SELECT EXISTS(SELECT 1 FROM card_refund WHERE provider_refund_id = ? AND customer_order_id = ?
                      AND currency_code = ? AND amount_minor = ? AND refunded_at = ?)
                    """, Boolean.class, refund.id(), row.orderId(), row.currency(), refund.amountMinor(), Timestamp.from(refund.createdAt())))) {
                    throw new CardPaymentException("CARD_PROVIDER_MISMATCH", 503);
                }
            }
            long refunded = refunded(row.orderId());
            if (refunded > row.amount()) throw new CardPaymentException("CARD_PROVIDER_MISMATCH", 503);
            String state;
            if (refunded == row.amount()) {
                state = "REFUNDED";
                jdbc.update("UPDATE payment SET status = 'REFUNDED', updated_at = now() WHERE customer_order_id = ?", row.orderId());
                if (row.orderStatus().equals("PENDING")) cancelOrder(row);
            } else if ((row.cancelRequested() || row.orderStatus().equals("CANCELLED"))
                && payment.refunds().stream().anyMatch(r -> List.of("failed", "canceled").contains(r.status()))) state = "REVIEW_REQUIRED";
            else if (row.cancelRequested() || row.orderStatus().equals("CANCELLED")) state = "REFUND_PENDING";
            else if (refunded > 0 && row.orderStatus().equals("PENDING")) state = "REVIEW_REQUIRED";
            else state = "PAID";
            jdbc.update("UPDATE card_checkout SET state = ? WHERE id = ?", state, row.id());
        } else if (session.status().equals("expired")) {
            if (hasRecordedPayment(row.orderId())) return;
            cancelOrder(row);
            jdbc.update("UPDATE payment SET status = 'FAILED', updated_at = now() WHERE customer_order_id = ? AND status = 'PENDING'", row.orderId());
            jdbc.update("UPDATE card_checkout SET state = 'EXPIRED' WHERE id = ?", row.id());
        } else if (session.status().equals("open") && !hasRecordedPayment(row.orderId()) && row.orderStatus().equals("PENDING")) {
            jdbc.update("UPDATE card_checkout SET state = 'OPEN' WHERE id = ?", row.id());
        }
    }
    private void cancelOrder(Row row) {
        if (!row.orderStatus().equals("PENDING")) return;
        inventory.release(row.orderId());
        jdbc.update("UPDATE customer_order SET status = 'CANCELLED', cancelled_at = now(), updated_at = now() WHERE id = ? AND status = 'PENDING'", row.orderId());
        jdbc.update("""
            INSERT INTO order_status_history (id, organization_id, customer_order_id, from_status, to_status, changed_by_account_id)
            VALUES (?, ?, ?, 'PENDING', 'CANCELLED', ?)
            """, UUID.randomUUID(), row.org(), row.orderId(), row.cancelActor());
    }
    private void finish(UUID id, UUID token, long generation, String error) {
        jdbc.update("""
            UPDATE card_checkout SET lease_until = NULL, lease_token = NULL, last_checked_at = now(), last_error_code = ?,
                reconcile_requested = (reconcile_version <> ? OR CAST(? AS text) IS NOT NULL), updated_at = now()
            WHERE id = ? AND lease_token = ?
            """, error, generation, error, id, token);
    }
    private void validate(Row row, CardPaymentProvider.Session session) {
        if (!session.checkoutId().equals(row.id()) || session.amountMinor() != row.amount() || !session.currency().equals(row.currency())
            || !session.expiresAt().equals(row.expiresAt()) || (row.sessionId() != null && !row.sessionId().equals(session.id()))
            || (row.intentId() != null && !row.intentId().equals(session.paymentIntentId()))) throw new CardPaymentException("CARD_PROVIDER_MISMATCH", 503);
    }
    private void validate(Row row, CardPaymentProvider.Session session, CardPaymentProvider.Payment payment) {
        if (payment == null || !payment.paid() || payment.paidAt() == null || !payment.id().equals(session.paymentIntentId())
            || payment.amountMinor() != row.amount() || !payment.currency().equals(row.currency())) throw new CardPaymentException("CARD_PROVIDER_MISMATCH", 503);
    }
    private boolean hasRecordedPayment(UUID order) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM payment WHERE customer_order_id = ? AND paid_at IS NOT NULL)", Boolean.class, order));
    }
    private long refunded(UUID order) {
        return jdbc.queryForObject("SELECT COALESCE(SUM(amount_minor),0) FROM card_refund WHERE customer_order_id = ?", Long.class, order);
    }
    private Row lock(UUID id) {
        Row prior = row(id);
        jdbc.queryForObject("SELECT id FROM customer_order WHERE id = ? FOR UPDATE", UUID.class, prior.orderId());
        jdbc.queryForObject("SELECT id FROM card_checkout WHERE id = ? FOR UPDATE", UUID.class, id);
        return row(id);
    }
    private Row row(UUID id) {
        return jdbc.query("""
            SELECT c.*, o.public_order_number, o.total_minor, o.currency_code, o.status AS order_status
            FROM card_checkout c JOIN customer_order o ON o.id = c.customer_order_id WHERE c.id = ?
            """, (rs, n) -> new Row(id, rs.getObject("customer_order_id", UUID.class), rs.getObject("organization_id", UUID.class),
                rs.getObject("location_id", UUID.class), rs.getString("public_order_number"), rs.getLong("total_minor"), rs.getString("currency_code"),
                rs.getString("order_status"), rs.getString("state"), rs.getString("provider_session_id"), rs.getString("provider_session_hint"),
                rs.getString("provider_payment_intent_id"), rs.getString("checkout_url"), rs.getTimestamp("expires_at").toInstant(),
                rs.getTimestamp("created_at").toInstant(), rs.getBoolean("cancel_requested"), rs.getObject("cancel_actor_id", UUID.class),
                rs.getInt("creation_attempts"), rs.getLong("reconcile_version"), rs.getString("last_error_code")), id)
            .stream().findFirst().orElseThrow(() -> new CardPaymentException("CARD_NOT_FOUND", 404));
    }
    private record Row(UUID id, UUID orderId, UUID org, UUID location, String number, long amount, String currency,
        String orderStatus, String state, String sessionId, String sessionHint, String intentId, String url, Instant expiresAt,
        Instant createdAt, boolean cancelRequested, UUID cancelActor, int attempts, long generation, String error) {}
    @Schema(name = "CardCheckoutStatus")
    public record Status(UUID id, String state, @Schema(nullable = true) String checkoutUrl, Instant expiresAt,
        boolean cancellationRequested, @Schema(nullable = true) String recoveryCode, long refundedMinor,
        GuestOrderPlacementService.PlacedOrder order) {}
}
