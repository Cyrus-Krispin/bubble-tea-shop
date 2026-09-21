package com.bubbletea.shop.catalog;

import com.bubbletea.shop.identity.StaffIdentityClaimsException;
import com.bubbletea.shop.catalog.CurrencyPriceService.PriceInput;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/staff/organizations/{organizationId}/variants/{variantId}/currency-prices/{currency}")
@SecurityRequirement(name="bearerAuth")
public class CurrencyPriceController {
    private final CurrencyPriceService prices;
    CurrencyPriceController(CurrencyPriceService prices) { this.prices = prices; }
    private UUID subject(Jwt jwt) { try { return UUID.fromString(jwt.getSubject()); } catch (RuntimeException e) { throw new StaffIdentityClaimsException(); } }
    @GetMapping @Operation(operationId="getVariantCurrencyPrices")
    CurrencyPriceService.PriceSet get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId, @PathVariable UUID variantId, @PathVariable String currency) { return prices.get(subject(jwt), organizationId, variantId, currency); }
    @PutMapping @Operation(operationId="setVariantCurrencyPrices")
    CurrencyPriceService.PriceSet set(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId, @PathVariable UUID variantId, @PathVariable String currency, @Valid @RequestBody ReplacePrices request) { return prices.set(subject(jwt), organizationId, variantId, currency, request.version(), request.prices()); }
    record ReplacePrices(@NotNull @PositiveOrZero Long version, @NotNull @Size(max=1000) List<@NotNull @Valid PriceInput> prices) {}
}
