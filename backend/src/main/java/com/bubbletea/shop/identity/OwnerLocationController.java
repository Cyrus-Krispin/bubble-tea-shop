package com.bubbletea.shop.identity;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.http.HttpStatus;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/staff/organizations/{organizationId}/locations")
@SecurityRequirement(name = "bearerAuth")
public class OwnerLocationController {
    private final OwnerLocationService locations;
    OwnerLocationController(OwnerLocationService locations) { this.locations = locations; }
    private UUID subject(Jwt jwt) { try { return UUID.fromString(jwt.getSubject()); } catch (RuntimeException e) { throw new StaffIdentityClaimsException(); } }
    @GetMapping @Operation(operationId = "listOwnerLocations")
    List<OwnerLocationService.ShopLocation> list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId) { return locations.list(subject(jwt), organizationId); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) @Operation(operationId = "createOwnerLocation")
    OwnerLocationService.ShopLocation create(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId, @Valid @RequestBody CreateLocation request) {
        return locations.create(subject(jwt), organizationId, request.name(), request.slug(), request.currencyCode(), request.timezone(), request.defaultLocale());
    }
    record CreateLocation(@NotBlank @Size(max=160) String name, @NotBlank @Size(max=120) @Pattern(regexp="[a-z0-9]+(?:-[a-z0-9]+)*") String slug,
        @NotBlank String currencyCode, @NotBlank @Size(max=64) String timezone, @NotBlank String defaultLocale) {}
}
