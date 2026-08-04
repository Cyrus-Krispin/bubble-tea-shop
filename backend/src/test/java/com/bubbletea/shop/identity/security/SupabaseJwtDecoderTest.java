package com.bubbletea.shop.identity.security;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.ECDSASigner;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.Curve;
import com.nimbusds.jose.jwk.ECKey;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.ECKeyGenerator;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;
import jakarta.validation.Validation;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SupabaseJwtDecoderTest {
    private static final String ISSUER = "http://localhost:8000/auth/v1";
    private static final String AUDIENCE = "authenticated";

    private static HttpServer jwksServer;
    private static RSAKey signingKey;
    private static ECKey ecSigningKey;
    private static JwtDecoder decoder;

    @BeforeAll
    static void configureDecoder() throws Exception {
        signingKey = new RSAKeyGenerator(2048)
            .keyID("test-signing-key")
            .algorithm(JWSAlgorithm.RS256)
            .generate();
        ecSigningKey = new ECKeyGenerator(Curve.P_256)
            .keyID("local-es256-signing-key")
            .algorithm(JWSAlgorithm.ES256)
            .generate();

        jwksServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        jwksServer.createContext("/.well-known/jwks.json", exchange -> {
            byte[] body = ("{\"keys\":[" + signingKey.toPublicJWK() + ","
                + ecSigningKey.toPublicJWK() + "]}")
                .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        jwksServer.start();

        URI jwkSetUri = URI.create(
            "http://127.0.0.1:" + jwksServer.getAddress().getPort() + "/.well-known/jwks.json");
        decoder = new SupabaseAuthSecurityConfiguration().supabaseJwtDecoder(
            new SupabaseAuthProperties(URI.create(ISSUER), jwkSetUri, AUDIENCE));
    }

    @AfterAll
    static void stopJwksServer() {
        jwksServer.stop(0);
    }

    @Test
    void acceptsAValidSupabaseAccessToken() throws Exception {
        String subject = UUID.randomUUID().toString();

        assertThat(decoder.decode(token(ISSUER, AUDIENCE, Instant.now().plusSeconds(300), subject)))
            .satisfies(jwt -> {
                assertThat(jwt.getSubject()).isEqualTo(subject);
                assertThat(jwt.getAudience()).containsExactly(AUDIENCE);
            });
    }

    @Test
    void acceptsTheEs256TokensUsedByTheLocalSupabaseStack() throws Exception {
        String subject = UUID.randomUUID().toString();

        assertThat(decoder.decode(ecToken(Instant.now().plusSeconds(300), subject)).getSubject())
            .isEqualTo(subject);
    }

    @Test
    void rejectsAnExpiredToken() throws Exception {
        assertRejected(token(
            ISSUER,
            AUDIENCE,
            Instant.now().minusSeconds(120),
            UUID.randomUUID().toString()));
    }

    @Test
    void rejectsATokenFromAnotherIssuer() throws Exception {
        assertRejected(token(
            "http://another-local-issuer:8000/auth/v1",
            AUDIENCE,
            Instant.now().plusSeconds(300),
            UUID.randomUUID().toString()));
    }

    @Test
    void rejectsATokenForAnotherAudience() throws Exception {
        assertRejected(token(
            ISSUER,
            "anon",
            Instant.now().plusSeconds(300),
            UUID.randomUUID().toString()));
    }

    @Test
    void rejectsATokenWithAnUntrustedSignature() throws Exception {
        RSAKey untrustedKey = new RSAKeyGenerator(2048)
            .keyID(signingKey.getKeyID())
            .algorithm(JWSAlgorithm.RS256)
            .generate();

        assertRejected(token(
            ISSUER,
            AUDIENCE,
            Instant.now().plusSeconds(300),
            UUID.randomUUID().toString(),
            untrustedKey));
    }

    @Test
    void rejectsHostedOrHttpsAuthConfiguration() {
        SupabaseAuthProperties hosted = new SupabaseAuthProperties(
            URI.create("https://project-ref.supabase.co/auth/v1"),
            URI.create("https://project-ref.supabase.co/auth/v1/.well-known/jwks.json"),
            AUDIENCE);

        try (var factory = Validation.buildDefaultValidatorFactory()) {
            assertThat(factory.getValidator().validate(hosted))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("localHttpEndpoints");
        }
    }

    private static void assertRejected(String token) {
        assertThatThrownBy(() -> decoder.decode(token)).isInstanceOf(JwtException.class);
    }

    private static String token(String issuer, String audience, Instant expiresAt, String subject)
        throws Exception {
        return token(issuer, audience, expiresAt, subject, signingKey);
    }

    private static String token(
        String issuer,
        String audience,
        Instant expiresAt,
        String subject,
        RSAKey key
    ) throws Exception {
        Instant now = Instant.now();
        Instant issuedAt = expiresAt.isBefore(now)
            ? expiresAt.minusSeconds(300)
            : now.minusSeconds(30);
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
            .issuer(issuer)
            .audience(List.of(audience))
            .subject(subject)
            .issueTime(Date.from(issuedAt))
            .expirationTime(Date.from(expiresAt))
            .claim("role", audience)
            .claim("session_id", UUID.randomUUID().toString())
            .build();
        SignedJWT jwt = new SignedJWT(
            new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build(),
            claims);
        jwt.sign(new RSASSASigner(key));
        return jwt.serialize();
    }

    private static String ecToken(Instant expiresAt, String subject) throws Exception {
        Instant issuedAt = Instant.now().minusSeconds(30);
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
            .issuer(ISSUER)
            .audience(List.of(AUDIENCE))
            .subject(subject)
            .issueTime(Date.from(issuedAt))
            .expirationTime(Date.from(expiresAt))
            .claim("role", AUDIENCE)
            .claim("session_id", UUID.randomUUID().toString())
            .build();
        SignedJWT jwt = new SignedJWT(
            new JWSHeader.Builder(JWSAlgorithm.ES256).keyID(ecSigningKey.getKeyID()).build(),
            claims);
        jwt.sign(new ECDSASigner(ecSigningKey));
        return jwt.serialize();
    }
}
