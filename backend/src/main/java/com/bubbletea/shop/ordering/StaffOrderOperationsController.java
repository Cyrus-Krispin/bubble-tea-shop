package com.bubbletea.shop.ordering;

import com.bubbletea.shop.identity.StaffAccessDeniedException;
import com.bubbletea.shop.identity.StaffAccountDisabledException;
import com.bubbletea.shop.identity.StaffIdentityClaimsException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/staff/organizations/{organizationId}/locations/{locationId}/orders")
@Validated
@Tag(name = "Staff order operations")
@ApiResponses({
    @ApiResponse(responseCode = "400", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "401", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "403", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "404", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "409", ref = "#/components/responses/Problem")
})
public class StaffOrderOperationsController {
    private final StaffOrderOperationsService orders;

    public StaffOrderOperationsController(StaffOrderOperationsService orders) {
        this.orders = orders;
    }

    @GetMapping
    @Operation(operationId = "listStaffOrders", summary = "List location orders",
        security = @SecurityRequirement(name = "bearerAuth"))
    @ApiResponse(responseCode = "200", description = "Order page",
        content = @Content(mediaType = "application/json",
            schema = @Schema(implementation = StaffOrderOperationsService.OrderPage.class)))
    StaffOrderOperationsService.OrderPage list(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @PathVariable UUID locationId,
        @RequestParam(required = false) OrderStatus status,
        @RequestParam(defaultValue = "0") @PositiveOrZero int page,
        @RequestParam(defaultValue = "25") @Min(1) @Max(100) int size
    ) {
        return orders.list(authSubject(jwt), organizationId, locationId, status, page, size);
    }

    @GetMapping("/{orderId}")
    @Operation(operationId = "getStaffOrder", summary = "Get an order with stock requirements",
        security = @SecurityRequirement(name = "bearerAuth"))
    @ApiResponse(responseCode = "200", description = "Order detail",
        content = @Content(mediaType = "application/json",
            schema = @Schema(implementation = StaffOrderOperationsService.OrderDetail.class)))
    StaffOrderOperationsService.OrderDetail get(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @PathVariable UUID locationId,
        @PathVariable UUID orderId
    ) {
        return orders.get(authSubject(jwt), organizationId, locationId, orderId);
    }

    @PostMapping("/{orderId}/completion")
    @Operation(operationId = "completeStaffOrder",
        summary = "Collect cash and complete an order atomically",
        security = @SecurityRequirement(name = "bearerAuth"))
    @ApiResponse(responseCode = "200", description = "Completed or previously completed order",
        content = @Content(mediaType = "application/json",
            schema = @Schema(implementation = StaffOrderOperationsService.OrderDetail.class)))
    StaffOrderOperationsService.OrderDetail complete(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @PathVariable UUID locationId,
        @PathVariable UUID orderId
    ) {
        return orders.complete(authSubject(jwt), organizationId, locationId, orderId);
    }

    private UUID authSubject(Jwt jwt) {
        try {
            return UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new StaffIdentityClaimsException();
        }
    }

    @RestControllerAdvice(assignableTypes = StaffOrderOperationsController.class)
    static class OrderExceptionHandler {
        @ExceptionHandler({HandlerMethodValidationException.class,
            MethodArgumentTypeMismatchException.class,
            jakarta.validation.ConstraintViolationException.class})
        ResponseEntity<ProblemDetail> invalid() {
            return problem(HttpStatus.BAD_REQUEST, "order-invalid", "Invalid order request",
                "Check the order filter, page, and route values and try again.", "ORDER_INVALID");
        }

        @ExceptionHandler(StaffIdentityClaimsException.class)
        ResponseEntity<ProblemDetail> identity() {
            return problem(HttpStatus.UNAUTHORIZED, "staff-identity-invalid", "Invalid staff identity",
                "The authenticated identity cannot be used for order access.", "STAFF_IDENTITY_INVALID");
        }

        @ExceptionHandler(StaffAccessDeniedException.class)
        ResponseEntity<ProblemDetail> denied() {
            return problem(HttpStatus.FORBIDDEN, "staff-access-denied", "Staff access denied",
                "This identity cannot access orders at the requested location.", "STAFF_ACCESS_DENIED");
        }

        @ExceptionHandler(StaffAccountDisabledException.class)
        ResponseEntity<ProblemDetail> disabled() {
            return problem(HttpStatus.FORBIDDEN, "staff-account-disabled", "Staff account unavailable",
                "This staff account is unavailable.", "STAFF_ACCOUNT_DISABLED");
        }

        @ExceptionHandler(OrderNotFoundException.class)
        ResponseEntity<ProblemDetail> notFound() {
            return problem(HttpStatus.NOT_FOUND, "order-not-found", "Order not found",
                "The requested order is unavailable.", "ORDER_NOT_FOUND");
        }

        @ExceptionHandler({InvalidOrderTransitionException.class, InvalidOrderStateException.class})
        ResponseEntity<ProblemDetail> conflict() {
            return problem(HttpStatus.CONFLICT, "order-state-conflict", "Order state conflict",
                "The order cannot be completed from its current order or payment state.",
                "ORDER_STATE_CONFLICT");
        }

        @ExceptionHandler(OrderStockShortageException.class)
        ResponseEntity<ProblemDetail> shortage(OrderStockShortageException exception) {
            ProblemDetail problem = detail(HttpStatus.CONFLICT, "order-insufficient-stock",
                "Insufficient stock", "The order remains pending because one or more ingredients are short.",
                "ORDER_INSUFFICIENT_STOCK");
            problem.setProperty("shortages", exception.shortages());
            return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
        }

        private ResponseEntity<ProblemDetail> problem(
            HttpStatus status, String type, String title, String message, String code
        ) {
            return ResponseEntity.status(status).body(detail(status, type, title, message, code));
        }

        private ProblemDetail detail(
            HttpStatus status, String type, String title, String message, String code
        ) {
            ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, message);
            problem.setType(URI.create("https://bubble-tea.example/problems/" + type));
            problem.setTitle(title);
            problem.setProperty("code", code);
            return problem;
        }
    }
}
