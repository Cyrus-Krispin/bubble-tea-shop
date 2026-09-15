package com.bubbletea.shop.ordering;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/customer/locations/{locationSlug}")
@SecurityRequirement(name = "bearerAuth")
@ApiResponses({@ApiResponse(responseCode = "400", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "401", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "403", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "404", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "409", ref = "#/components/responses/Problem")})
public class CustomerFavoriteController {
    private final CustomerFavoriteService favorites;
    private final GuestOrderPlacementService orders;
    CustomerFavoriteController(CustomerFavoriteService favorites, GuestOrderPlacementService orders) { this.favorites = favorites; this.orders = orders; }
    @GetMapping("/favorite")
    @Operation(operationId = "getCustomerFavorite", summary = "Read the customer's organization favorite and available recipes")
    @ApiResponse(responseCode = "200", description = "Favorite selection", content = @Content(mediaType = "application/json", schema = @Schema(implementation = CustomerFavoriteService.FavoriteState.class)))
    CustomerFavoriteService.FavoriteState get(@AuthenticationPrincipal Jwt jwt, @PathVariable String locationSlug) { return favorites.get(subject(jwt), locationSlug); }
    @PutMapping("/favorite")
    @Operation(operationId = "setCustomerFavorite", summary = "Choose a favorite recipe from this shop menu")
    @ApiResponse(responseCode = "200", description = "Favorite saved", content = @Content(mediaType = "application/json", schema = @Schema(implementation = CustomerFavoriteService.FavoriteState.class)))
    CustomerFavoriteService.FavoriteState set(@AuthenticationPrincipal Jwt jwt, @PathVariable String locationSlug, @Valid @RequestBody FavoriteRequest input) {
        return favorites.set(subject(jwt), locationSlug, input.recipeId());
    }
    @DeleteMapping("/favorite")
    @Operation(operationId = "clearCustomerFavorite", summary = "Remove the favorite preference while preserving order history")
    @ApiResponse(responseCode = "200", description = "Favorite removed", content = @Content(mediaType = "application/json", schema = @Schema(implementation = CustomerFavoriteService.FavoriteState.class)))
    CustomerFavoriteService.FavoriteState clear(@AuthenticationPrincipal Jwt jwt, @PathVariable String locationSlug) { return favorites.clear(subject(jwt), locationSlug); }
    @PostMapping("/order-quote")
    @Operation(operationId = "quoteCustomerOrder", summary = "Estimate server prices and the customer's favorite discount")
    @ApiResponse(responseCode = "200", description = "Current checkout estimate", content = @Content(mediaType = "application/json", schema = @Schema(implementation = GuestOrderPlacementService.OrderQuote.class)))
    GuestOrderPlacementService.OrderQuote quote(@AuthenticationPrincipal Jwt jwt, @PathVariable String locationSlug,
        @Valid @RequestBody GuestOrderPlacementController.CreateOrderRequest input) {
        return orders.quote(locationSlug, subject(jwt), input.items().stream().map(item -> new GuestOrderPlacementService.CreateLine(item.variantId(), item.quantity(), item.optionChoiceIds())).toList());
    }
    private UUID subject(Jwt jwt) {
        try { return UUID.fromString(jwt.getSubject()); }
        catch (IllegalArgumentException | NullPointerException exception) { throw new FavoriteIdentityException(); }
    }
    public record FavoriteRequest(@NotNull UUID recipeId) {}
    @RestControllerAdvice(assignableTypes = CustomerFavoriteController.class)
    static class Errors {
        @ExceptionHandler(FavoriteIdentityException.class)
        ResponseEntity<ProblemDetail> identity() {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, "Invalid customer identity."));
        }
        @ExceptionHandler(FavoriteUnavailableException.class)
        ResponseEntity<ProblemDetail> unavailable() {
            var problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "The requested favorite or shop is unavailable.");
            problem.setProperty("code", "FAVORITE_UNAVAILABLE"); return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
        }
    }
}

class FavoriteIdentityException extends RuntimeException {}
