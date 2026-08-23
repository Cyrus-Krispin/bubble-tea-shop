package com.bubbletea.shop.identity.security;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration(proxyBeanMethods = false)
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@ConditionalOnProperty(
    name = "app.security.supabase.enabled",
    havingValue = "false",
    matchIfMissing = true)
public class UnconfiguredApiSecurityConfiguration {

    @Bean
    SecurityFilterChain unconfiguredApiSecurityFilterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(authorize -> authorize
                .requestMatchers(HttpMethod.GET, "/api/v1/guest/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/guest/orders").permitAll()
                .requestMatchers("/api/**").denyAll()
                .anyRequest().permitAll())
            .build();
    }
}
