package com.bubbletea.shop.ordering;

import org.junit.jupiter.api.Test;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class StripeCardPaymentProviderTest {
    StripeCardPaymentProvider provider() { return new StripeCardPaymentProvider("test-key", "test-webhook", "https://shop.example", true); }
    String sign(byte[] body, long timestamp) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec("test-webhook".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        mac.update((timestamp + ".").getBytes(StandardCharsets.UTF_8));
        return "t=" + timestamp + ",v1=" + HexFormat.of().formatHex(mac.doFinal(body));
    }
    @Test void verifiesRawBytesRotationAndTimestampWithoutAcceptingAlteredPayloads() throws Exception {
        byte[] body = "{\"type\":\"ignored\"}".getBytes(StandardCharsets.UTF_8);
        long now = Instant.now().getEpochSecond();
        String signature = sign(body, now);
        assertThat(provider().verifySignature(body, signature)).isTrue();
        assertThat(provider().verifySignature(body, signature + ",v1=bad-rotation-signature")).isTrue();
        assertThat(provider().verifySignature("{}".getBytes(), signature)).isFalse();
        assertThat(provider().verifySignature(body, sign(body, now - 301))).isFalse();
        assertThat(provider().verifySignature(body, sign(body, now + 301))).isFalse();
        assertThat(provider().verifySignature(body, signature + ",t=" + now)).isFalse();
        assertThat(provider().verifySignature(body, null)).isFalse();
        assertThat(provider().verifySignature(new byte[1_048_577], signature)).isFalse();
    }
    @Test void validatesConfigurationAndIgnoresUnrelatedSignedEvents() {
        assertThatThrownBy(() -> new StripeCardPaymentProvider("", "secret", "https://shop.example", true)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new StripeCardPaymentProvider("key", "secret", "http://shop.example", true)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new StripeCardPaymentProvider("key", "secret", "https://shop.example/path", true)).isInstanceOf(IllegalStateException.class);
        assertThat(new StripeCardPaymentProvider("", "", "", false).available()).isFalse();
        assertThat(provider().event("{\"type\":\"checkout.session.completed\",\"data\":{\"object\":{\"client_reference_id\":\"another-app\"}}}".getBytes()).checkoutId()).isNull();
    }
    @SuppressWarnings("unchecked")
    @Test void pinsVersionAndRejectsUntrustedHostedUrls() throws Exception {
        HttpClient http = mock(HttpClient.class);
        HttpResponse<byte[]> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        UUID id = UUID.randomUUID();
        String json = """
            {"id":"cs_test","mode":"payment","payment_method_types":["card"],"client_reference_id":"%s",
             "status":"open","payment_status":"unpaid","amount_total":660,"currency":"sgd","expires_at":2000000000,"url":"%s"}
            """;
        when(response.body()).thenReturn(json.formatted(id, "https://checkout.stripe.com/c/pay/test").getBytes());
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);
        var adapter = new StripeCardPaymentProvider("test-key", "test-webhook", "https://shop.example", true, http);
        assertThat(adapter.create(new CardPaymentProvider.Checkout(id, UUID.randomUUID(), "ABC", 660, "SGD", Instant.ofEpochSecond(2000000000))).checkoutId()).isEqualTo(id);
        var captor = org.mockito.ArgumentCaptor.forClass(HttpRequest.class);
        verify(http).send(captor.capture(), any(HttpResponse.BodyHandler.class));
        assertThat(captor.getValue().headers().firstValue("Stripe-Version")).contains(StripeCardPaymentProvider.API_VERSION);
        assertThat(captor.getValue().headers().firstValue("Idempotency-Key")).contains("checkout:" + id);
        assertThat(captor.getValue().uri().getHost()).isEqualTo("api.stripe.com");
        when(response.body()).thenReturn(json.formatted(id, "https://checkout.stripe.com.attacker.example/pay").getBytes());
        assertThatThrownBy(() -> adapter.retrieve("cs_test")).isInstanceOf(CardPaymentException.class);
        assertThatThrownBy(() -> adapter.retrieve("../secrets")).isInstanceOf(CardPaymentException.class);
    }
}
