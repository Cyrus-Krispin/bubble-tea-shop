package com.bubbletea.shop.ordering;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

@Component
public class StripeCardPaymentProvider implements CardPaymentProvider {
    public static final String API_VERSION = "2026-08-26.dahlia";
    private final String secret;
    private final String webhookSecret;
    private final String origin;
    private final boolean enabled;
    private final HttpClient http;
    private final ObjectMapper json = new ObjectMapper();

    @org.springframework.beans.factory.annotation.Autowired
    public StripeCardPaymentProvider(@Value("${app.payments.stripe.secret-key:}") String secret,
        @Value("${app.payments.stripe.webhook-secret:}") String webhookSecret,
        @Value("${app.payments.public-origin:}") String origin,
        @Value("${app.payments.stripe.enabled:false}") boolean enabled) {
        this(secret, webhookSecret, origin, enabled, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER).build());
    }
    StripeCardPaymentProvider(String secret, String webhookSecret, String origin, boolean enabled, HttpClient http) {
        this.http = http;
        this.secret = secret; this.webhookSecret = webhookSecret;
        this.origin = origin.replaceAll("/+$", ""); this.enabled = enabled;
        if (enabled) {
            URI uri;
            try { uri = URI.create(this.origin); } catch (IllegalArgumentException error) { throw new IllegalStateException("Invalid payment public origin"); }
            boolean secure = "https".equals(uri.getScheme());
            boolean local = "http".equals(uri.getScheme()) && ("localhost".equals(uri.getHost()) || "127.0.0.1".equals(uri.getHost()));
            if (secret.isBlank() || webhookSecret.isBlank() || (!secure && !local) || uri.getHost() == null
                || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null || !uri.getPath().isEmpty()) {
                throw new IllegalStateException("Payment credentials and a valid public origin are required when card checkout is enabled");
            }
        }
    }
    @Override public boolean available() { return enabled; }

    @Override public Session create(Checkout checkout) {
        Map<String, String> body = new LinkedHashMap<>();
        body.put("mode", "payment"); body.put("payment_method_types[0]", "card");
        body.put("client_reference_id", checkout.id().toString());
        body.put("metadata[checkout_id]", checkout.id().toString());
        body.put("payment_intent_data[metadata][checkout_id]", checkout.id().toString());
        body.put("line_items[0][quantity]", "1");
        body.put("line_items[0][price_data][currency]", checkout.currency().toLowerCase(java.util.Locale.ROOT));
        body.put("line_items[0][price_data][unit_amount]", Long.toString(checkout.amountMinor()));
        body.put("line_items[0][price_data][product_data][name]", "Drink order " + checkout.orderNumber());
        body.put("expires_at", Long.toString(checkout.expiresAt().getEpochSecond()));
        body.put("adaptive_pricing[enabled]", "false");
        String returnUrl = origin + "/card-checkout/" + checkout.id();
        body.put("success_url", returnUrl); body.put("cancel_url", returnUrl);
        return session(request("POST", "/checkout/sessions", body, "checkout:" + checkout.id()));
    }
    @Override public Session retrieve(String sessionId) {
        return session(request("GET", "/checkout/sessions/" + identifier(sessionId), null, null));
    }
    @Override public Session findCheckout(UUID checkoutId, Instant createdAt) {
        String cursor = "";
        for (int page = 0; page < 10; page++) {
            JsonNode batch = request("GET", "/checkout/sessions?limit=100&created[gte]=" + (createdAt.getEpochSecond() - 60)
                + "&created[lte]=" + (createdAt.getEpochSecond() + 3600) + cursor, null, null);
            JsonNode items = batch.path("data");
            if (!items.isArray()) throw invalid();
            for (JsonNode item : items) if (checkoutId.toString().equals(item.path("client_reference_id").asText())) return session(item);
            if (!batch.path("has_more").asBoolean()) return null;
            if (items.isEmpty()) throw invalid();
            cursor = "&starting_after=" + identifier(text(items.get(items.size() - 1), "id"));
        }
        // A bounded scan is not evidence of absence. Keep reservations for operator reconciliation.
        throw new CardPaymentException("CARD_REVIEW_REQUIRED", 503);
    }
    @Override public Session expire(String sessionId) {
        return session(request("POST", "/checkout/sessions/" + identifier(sessionId) + "/expire", Map.of(), "expire:" + sessionId));
    }
    @Override public Refund refund(String intentId, UUID checkoutId) {
        return refund(request("POST", "/refunds", Map.of("payment_intent", identifier(intentId)), "refund:" + checkoutId));
    }
    @Override public Payment payment(String intentId) {
        JsonNode node = request("GET", "/payment_intents/" + identifier(intentId) + "?expand[]=latest_charge", null, null);
        JsonNode charge = node.path("latest_charge");
        boolean paid = node.path("status").asText().equals("succeeded") && charge.path("paid").asBoolean();
        var refunds = new ArrayList<Refund>();
        String cursor = "";
        for (int page = 0; page < 10; page++) {
            JsonNode batch = request("GET", "/refunds?limit=100&payment_intent=" + identifier(intentId) + cursor, null, null);
            if (!batch.path("data").isArray()) throw invalid();
            for (JsonNode item : batch.path("data")) refunds.add(refund(item));
            if (!batch.path("has_more").asBoolean()) {
                return new Payment(text(node, "id"), number(node, "amount_received"), text(node, "currency").toUpperCase(java.util.Locale.ROOT), paid,
                    paid ? Instant.ofEpochSecond(number(charge, "created")) : null, java.util.List.copyOf(refunds));
            }
            if (batch.path("data").isEmpty()) throw invalid();
            cursor = "&starting_after=" + identifier(text(batch.path("data").get(batch.path("data").size() - 1), "id"));
        }
        throw invalid();
    }

    @Override public boolean verifySignature(byte[] body, String signature) {
        if (!enabled || signature == null || signature.length() > 4096 || body.length > 1_048_576) return false;
        try {
            Long timestamp = null;
            var signatures = new ArrayList<String>();
            for (String part : signature.split(",")) {
                if (part.startsWith("t=")) { if (timestamp != null) return false; timestamp = Long.parseLong(part.substring(2)); }
                if (part.startsWith("v1=")) signatures.add(part.substring(3));
            }
            if (timestamp == null || timestamp < Instant.now().getEpochSecond() - 300 || timestamp > Instant.now().getEpochSecond() + 300) return false;
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(webhookSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            mac.update((timestamp + ".").getBytes(StandardCharsets.UTF_8));
            byte[] expected = mac.doFinal(body);
            for (String candidate : signatures) {
                try { if (MessageDigest.isEqual(expected, HexFormat.of().parseHex(candidate))) return true; }
                catch (IllegalArgumentException ignored) { /* Other rotation signatures may still be valid. */ }
            }
            return false;
        } catch (Exception error) { return false; }
    }
    @Override public Event event(byte[] body) {
        try {
            JsonNode event = json.readTree(body), object = event.path("data").path("object");
            String type = event.path("type").asText();
            if (type.startsWith("checkout.session.")) {
                UUID checkout;
                try { checkout = UUID.fromString(object.path("client_reference_id").asText()); }
                catch (IllegalArgumentException ignored) { return new Event(null, null, null); }
                return new Event(text(object, "id"), null, checkout);
            }
            if (type.equals("charge.refunded") || type.startsWith("refund.")) return new Event(null, text(object, "payment_intent"), null);
            if (type.equals("payment_intent.succeeded")) return new Event(null, text(object, "id"), null);
            return new Event(null, null, null);
        } catch (Exception error) { throw new CardPaymentException("CARD_WEBHOOK_INVALID", 400); }
    }

    private Session session(JsonNode node) {
        try {
            if (!text(node, "mode").equals("payment") || !node.path("payment_method_types").isArray()
                || node.path("payment_method_types").size() != 1 || !node.path("payment_method_types").get(0).asText().equals("card")) throw invalid();
            String url = node.path("url").isTextual() ? node.path("url").asText() : null;
            if (url != null) {
                URI uri = URI.create(url);
                if (!"https".equals(uri.getScheme()) || !"checkout.stripe.com".equals(uri.getHost()) || uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443)) throw invalid();
            }
            return new Session(text(node, "id"), UUID.fromString(text(node, "client_reference_id")), text(node, "status"),
                text(node, "payment_status").equals("paid"), number(node, "amount_total"), text(node, "currency").toUpperCase(java.util.Locale.ROOT),
                node.path("payment_intent").isTextual() ? node.path("payment_intent").asText() : null,
                url, Instant.ofEpochSecond(number(node, "expires_at")));
        } catch (IllegalArgumentException error) { throw invalid(); }
    }
    private Refund refund(JsonNode node) {
        return new Refund(text(node, "id"), text(node, "payment_intent"), number(node, "amount"),
            text(node, "currency").toUpperCase(java.util.Locale.ROOT), text(node, "status"), Instant.ofEpochSecond(number(node, "created")));
    }
    private JsonNode request(String method, String path, Map<String, String> body, String key) {
        if (!available()) throw new CardPaymentException("CARD_UNAVAILABLE", 503);
        var request = HttpRequest.newBuilder(URI.create("https://api.stripe.com/v1" + path))
            .timeout(Duration.ofSeconds(10)).header("Authorization", "Bearer " + secret).header("Stripe-Version", API_VERSION);
        if (key != null) request.header("Idempotency-Key", key);
        if (body == null) request.GET(); else request.header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(body.entrySet().stream().map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue())).collect(java.util.stream.Collectors.joining("&"))));
        try {
            var response = http.send(request.build(), HttpResponse.BodyHandlers.ofByteArray());
            byte[] bytes = response.body();
            if (bytes.length > 1_048_576) throw invalid();
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new CardPaymentException(response.statusCode() == 400 ? "CARD_PROVIDER_REJECTED" : "CARD_PROVIDER_UNAVAILABLE", 503);
            }
            return json.readTree(bytes);
        } catch (CardPaymentException error) { throw error; }
        catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new CardPaymentException("CARD_PROVIDER_UNAVAILABLE", 503); }
        catch (Exception error) { throw new CardPaymentException("CARD_PROVIDER_UNAVAILABLE", 503); }
    }
    private static String identifier(String value) {
        if (value == null || !value.matches("[a-zA-Z0-9_]{1,255}")) throw invalid();
        return value;
    }
    private static String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
    private static String text(JsonNode node, String key) {
        if (!node.path(key).isTextual() || node.path(key).asText().isBlank()) throw invalid();
        return node.path(key).asText();
    }
    private static long number(JsonNode node, String key) {
        if (!node.path(key).isIntegralNumber() || !node.path(key).canConvertToLong() || node.path(key).asLong() < 0) throw invalid();
        return node.path(key).asLong();
    }
    private static CardPaymentException invalid() { return new CardPaymentException("CARD_PROVIDER_MISMATCH", 503); }
}
