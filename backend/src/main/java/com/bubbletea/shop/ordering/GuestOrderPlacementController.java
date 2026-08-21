package com.bubbletea.shop.ordering;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.dao.DataAccessException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/guest/orders")
@Tag(name = "Guest ordering")
public class GuestOrderPlacementController {
    private final GuestOrderPlacementService placement;

    public GuestOrderPlacementController(GuestOrderPlacementService placement) {
        this.placement = placement;
    }

    @PostMapping
    @Operation(operationId = "placeGuestOrder", summary = "Place an idempotent pending cash order")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Existing order replayed",
            content = @Content(mediaType = "application/json",
                schema = @Schema(implementation = GuestOrderPlacementService.PlacedOrder.class))),
        @ApiResponse(responseCode = "201", description = "Order placed",
            content = @Content(mediaType = "application/json",
                schema = @Schema(implementation = GuestOrderPlacementService.PlacedOrder.class))),
        @ApiResponse(responseCode = "400", ref = "#/components/responses/Problem"),
        @ApiResponse(responseCode = "401", ref = "#/components/responses/Problem"),
        @ApiResponse(responseCode = "403", ref = "#/components/responses/Problem"),
        @ApiResponse(responseCode = "409", ref = "#/components/responses/Problem"),
        @ApiResponse(responseCode = "503", ref = "#/components/responses/Problem")
    })
    ResponseEntity<GuestOrderPlacementService.PlacedOrder> place(
        @RequestHeader("Idempotency-Key") UUID idempotencyKey,
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody CreateOrderRequest request
    ) {
        UUID authSubject = null;
        if (jwt != null) {
            try {
                authSubject = UUID.fromString(jwt.getSubject());
            } catch (IllegalArgumentException | NullPointerException exception) {
                throw new InvalidGuestOrderException();
            }
        }
        GuestOrderPlacementService.PlacedOrder result = placement.place(
            idempotencyKey,
            authSubject,
            request.items().stream().map(item -> new GuestOrderPlacementService.CreateLine(
                item.variantId(), item.quantity(), item.optionChoiceIds())).toList());
        return ResponseEntity.status(result.replayed() ? HttpStatus.OK : HttpStatus.CREATED).body(result);
    }

    @Schema(name = "CreateGuestOrderRequest")
    public record CreateOrderRequest(
        @NotEmpty @Size(max = 25) List<@Valid CreateOrderLineRequest> items
    ) {
        @JsonAnySetter
        public void rejectUnknown(String field, Object value) {
            throw new InvalidGuestOrderException();
        }
    }

    @Schema(name = "CreateGuestOrderLineRequest")
    public record CreateOrderLineRequest(
        @NotNull UUID variantId,
        @Min(1) @Max(20) int quantity,
        @NotNull @Size(max = 30) List<@NotNull UUID> optionChoiceIds
    ) {
        @JsonAnySetter
        public void rejectUnknown(String field, Object value) {
            throw new InvalidGuestOrderException();
        }
    }

    @RestControllerAdvice(assignableTypes = GuestOrderPlacementController.class)
    static class Advice {
        @ExceptionHandler({
            InvalidGuestOrderException.class,
            HandlerMethodValidationException.class,
            HttpMessageNotReadableException.class,
            MissingRequestHeaderException.class,
            MethodArgumentTypeMismatchException.class
        })
        ResponseEntity<ProblemDetail> invalid(Exception exception) {
            return problem(HttpStatus.BAD_REQUEST, "order-invalid", "Invalid order",
                "Check the order items and try again.", "ORDER_INVALID");
        }

        @ExceptionHandler(GuestOrderCatalogChangedException.class)
        ResponseEntity<ProblemDetail> catalogChanged() {
            return problem(HttpStatus.CONFLICT, "order-catalog-changed", "Menu changed",
                "One or more selections are no longer available. Review the current menu.",
                "ORDER_CATALOG_CHANGED");
        }

        @ExceptionHandler(GuestOrderIdempotencyConflictException.class)
        ResponseEntity<ProblemDetail> idempotencyConflict() {
            return problem(HttpStatus.CONFLICT, "order-idempotency-conflict",
                "Checkout retry conflict",
                "This checkout key was already used for a different order.",
                "ORDER_IDEMPOTENCY_CONFLICT");
        }

        @ExceptionHandler(CustomerAccountDisabledException.class)
        ResponseEntity<ProblemDetail> accountDisabled() {
            return problem(HttpStatus.FORBIDDEN, "customer-account-disabled",
                "Customer account unavailable",
                "The signed-in customer account is not available.",
                "CUSTOMER_ACCOUNT_DISABLED");
        }

        @ExceptionHandler(GuestOrderUnavailableException.class)
        ResponseEntity<ProblemDetail> unavailable() {
            return problem(HttpStatus.SERVICE_UNAVAILABLE, "order-unavailable",
                "Ordering unavailable",
                "The order could not be completed safely. Try again.",
                "ORDER_UNAVAILABLE");
        }

        @ExceptionHandler(DataAccessException.class)
        ResponseEntity<ProblemDetail> databaseUnavailable() {
            return unavailable();
        }

        private ResponseEntity<ProblemDetail> problem(
            HttpStatus status,
            String type,
            String title,
            String detail,
            String code
        ) {
            ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
            problem.setType(URI.create("https://bubble-tea.example/problems/" + type));
            problem.setTitle(title);
            problem.setProperty("code", code);
            return ResponseEntity.status(status).body(problem);
        }
    }
}
