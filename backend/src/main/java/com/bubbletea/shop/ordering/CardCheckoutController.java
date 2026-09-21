package com.bubbletea.shop.ordering;

import com.bubbletea.shop.inventory.InsufficientStockException;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.io.IOException;
import java.util.UUID;

@RestController
public class CardCheckoutController {
    private final CardCheckoutService cards;
    public CardCheckoutController(CardCheckoutService cards) { this.cards = cards; }

    @GetMapping("/api/v1/guest/payment-methods")
    @Operation(operationId = "getGuestPaymentMethods", summary = "Read configured payment methods")
    PaymentMethods methods() { return new PaymentMethods(true, cards.available()); }

    @PostMapping("/api/v1/guest/locations/{slug}/card-checkouts")
    @Operation(operationId = "createCardCheckout", summary = "Reserve stock and start an idempotent hosted card checkout")
    CardCheckoutService.Status create(@PathVariable String slug, @RequestHeader("Idempotency-Key") UUID key,
        @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody GuestOrderPlacementController.CreateOrderRequest request) {
        UUID subject = null;
        if (jwt != null) {
            try { subject = UUID.fromString(jwt.getSubject()); } catch (IllegalArgumentException error) { throw new InvalidGuestOrderException(); }
        }
        return cards.create(slug, key, subject, request.items().stream().map(line ->
            new GuestOrderPlacementService.CreateLine(line.variantId(), line.quantity(), line.optionChoiceIds())).toList());
    }
    @GetMapping("/api/v1/guest/card-checkouts/{id}")
    @Operation(operationId = "getCardCheckout", summary = "Read a card checkout using its private recovery identifier")
    CardCheckoutService.Status status(@PathVariable UUID id) { return cards.status(id); }

    @PostMapping("/api/v1/guest/card-checkouts/{id}/refresh")
    @Operation(operationId = "refreshCardCheckout", summary = "Verify the latest hosted payment status")
    CardCheckoutService.Status refresh(@PathVariable UUID id) { return cards.refresh(id); }

    @PostMapping("/api/v1/guest/card-checkouts/{id}/cancel")
    @Operation(operationId = "cancelUnpaidCardCheckout", summary = "Cancel an unpaid hosted checkout before releasing stock")
    CardCheckoutService.Status cancel(@PathVariable UUID id) { return cards.cancelGuest(id); }

    @PostMapping("/api/v1/staff/organizations/{org}/locations/{location}/orders/{order}/card-payment/refresh")
    @Operation(operationId = "refreshStaffCardPayment", summary = "Verify a scoped order payment and refunds")
    CardCheckoutService.Status staffRefresh(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID org, @PathVariable UUID location, @PathVariable UUID order) {
        return cards.staffRefresh(subject(jwt), org, location, order, false);
    }
    @PostMapping("/api/v1/staff/organizations/{org}/locations/{location}/orders/{order}/card-payment/cancel")
    @Operation(operationId = "cancelStaffCardOrder", summary = "Cancel an unfulfilled card order and refund any collected payment")
    CardCheckoutService.Status staffCancel(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID org, @PathVariable UUID location, @PathVariable UUID order) {
        return cards.staffRefresh(subject(jwt), org, location, order, true);
    }
    private UUID subject(Jwt jwt) {
        try { return UUID.fromString(jwt.getSubject()); }
        catch (IllegalArgumentException | NullPointerException error) { throw new com.bubbletea.shop.identity.StaffIdentityClaimsException(); }
    }

    @PostMapping("/api/v1/payments/stripe/webhook")
    @Operation(hidden = true)
    ResponseEntity<Void> webhook(HttpServletRequest request, @RequestHeader(value = "Stripe-Signature", required = false) String signature) throws IOException {
        byte[] body = request.getInputStream().readNBytes(1_048_577);
        if (body.length > 1_048_576) return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).build();
        cards.webhook(body, signature);
        return ResponseEntity.ok().build();
    }
    public record PaymentMethods(boolean cash, boolean card) {}

    @RestControllerAdvice(assignableTypes = CardCheckoutController.class)
    static class Advice {
        @ExceptionHandler(CardPaymentException.class)
        ResponseEntity<ProblemDetail> card(CardPaymentException error) {
            var detail = ProblemDetail.forStatusAndDetail(org.springframework.http.HttpStatusCode.valueOf(error.status()), switch (error.code()) {
                case "CARD_NOT_FOUND" -> "This checkout is unavailable.";
                case "CARD_CANNOT_CANCEL" -> "This order cannot be cancelled here. Ask the shop for help.";
                case "CARD_INSUFFICIENT_STOCK" -> "There are not enough available ingredients for this order. Review your drinks or ask the shop.";
                case "CARD_AMOUNT_UNSUPPORTED" -> "Choose cash for this order total.";
                default -> "The card payment could not be confirmed. Retry the same checkout or ask the shop for help.";
            });
            detail.setProperty("code", error.code());
            return ResponseEntity.status(error.status()).body(detail);
        }
        @ExceptionHandler(InsufficientStockException.class)
        ResponseEntity<ProblemDetail> stock() {
            return card(new CardPaymentException("CARD_INSUFFICIENT_STOCK", 409));
        }
    }
}
