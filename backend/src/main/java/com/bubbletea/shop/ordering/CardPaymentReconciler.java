package com.bubbletea.shop.ordering;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration(proxyBeanMethods = false)
@EnableScheduling
@ConditionalOnProperty(name = "app.payments.stripe.enabled", havingValue = "true")
public class CardPaymentReconciler {
    private final CardCheckoutService cards;
    public CardPaymentReconciler(CardCheckoutService cards) { this.cards = cards; }
    @Scheduled(fixedDelay = 15000, initialDelay = 15000)
    public void verifyPendingPayments() { cards.reconcileDue(); }
}
