package com.bubbletea.shop.ordering;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** The provider boundary carries server-priced snapshots and verified provider facts only. */
public interface CardPaymentProvider {
    boolean available();
    Session create(Checkout checkout);
    Session retrieve(String sessionId);
    Session findCheckout(UUID checkoutId, Instant createdAt);
    Session expire(String sessionId);
    Payment payment(String paymentIntentId);
    Refund refund(String paymentIntentId, UUID checkoutId);
    boolean verifySignature(byte[] body, String signature);
    Event event(byte[] body);

    record Checkout(UUID id, UUID orderId, String orderNumber, long amountMinor,
                    String currency, Instant expiresAt) {}
    record Session(String id, UUID checkoutId, String status, boolean paid, long amountMinor,
                   String currency, String paymentIntentId, String url, Instant expiresAt) {}
    record Payment(String id, long amountMinor, String currency, boolean paid, Instant paidAt,
                   List<Refund> refunds) {}
    record Refund(String id, String paymentIntentId, long amountMinor, String currency,
                  String status, Instant createdAt) {}
    record Event(String sessionId, String paymentIntentId, UUID checkoutId) {}
}
