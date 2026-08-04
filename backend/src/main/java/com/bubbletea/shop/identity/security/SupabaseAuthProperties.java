package com.bubbletea.shop.identity.security;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.net.URI;

@Validated
@ConfigurationProperties("app.security.supabase")
public record SupabaseAuthProperties(
    @NotNull URI issuer,
    @NotNull URI jwkSetUri,
    @NotBlank String audience
) {
    @AssertTrue(message = "local Supabase Auth endpoints must use internal HTTP URLs")
    public boolean isLocalHttpEndpoints() {
        return usesHttp(issuer) && usesHttp(jwkSetUri);
    }

    private static boolean usesHttp(URI uri) {
        return uri != null && "http".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null;
    }
}
