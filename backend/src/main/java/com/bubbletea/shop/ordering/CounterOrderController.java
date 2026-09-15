package com.bubbletea.shop.ordering;

import com.bubbletea.shop.identity.StaffIdentityClaimsException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/staff/organizations/{organizationId}/locations/{locationId}/counter-orders")
public class CounterOrderController {
    private final GuestOrderPlacementService placement;

    CounterOrderController(GuestOrderPlacementService placement) { this.placement = placement; }

    @PostMapping
    @Operation(operationId = "placeCounterOrder", summary = "Record an attributed pending cash counter order",
        security = @SecurityRequirement(name = "bearerAuth"))
    @ApiResponse(responseCode = "201", description = "Counter order placed",
        content = @Content(mediaType = "application/json", schema = @Schema(implementation = GuestOrderPlacementService.PlacedOrder.class)))
    @ApiResponse(responseCode = "200", description = "Matching counter order replayed",
        content = @Content(mediaType = "application/json", schema = @Schema(implementation = GuestOrderPlacementService.PlacedOrder.class)))
    @ApiResponse(responseCode = "400", ref = "#/components/responses/Problem")
    @ApiResponse(responseCode = "401", ref = "#/components/responses/Problem")
    @ApiResponse(responseCode = "403", ref = "#/components/responses/Problem")
    @ApiResponse(responseCode = "409", ref = "#/components/responses/Problem")
    ResponseEntity<GuestOrderPlacementService.PlacedOrder> place(@AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId, @PathVariable UUID locationId,
        @RequestHeader("Idempotency-Key") UUID key,
        @Valid @RequestBody GuestOrderPlacementController.CreateOrderRequest request) {
        UUID subject;
        try { subject = UUID.fromString(jwt.getSubject()); }
        catch (IllegalArgumentException | NullPointerException exception) { throw new StaffIdentityClaimsException(); }
        var order = placement.placeCounter(subject, organizationId, locationId, key,
            request.items().stream().map(item -> new GuestOrderPlacementService.CreateLine(
                item.variantId(), item.quantity(), item.optionChoiceIds())).toList());
        return ResponseEntity.status(order.replayed() ? HttpStatus.OK : HttpStatus.CREATED).body(order);
    }
}
