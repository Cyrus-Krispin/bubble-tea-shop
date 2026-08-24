package com.bubbletea.shop.ordering;

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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.net.URI;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/customer/orders")
@Validated
@Tag(name = "Customer order history")
@ApiResponses({
    @ApiResponse(responseCode = "400", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "401", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "403", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "404", ref = "#/components/responses/Problem")
})
public class CustomerOrderHistoryController {
    private final CustomerOrderHistoryService history;
    private final CustomerReorderSuggestionService reorderSuggestions;

    public CustomerOrderHistoryController(
        CustomerOrderHistoryService history,
        CustomerReorderSuggestionService reorderSuggestions
    ) {
        this.history = history;
        this.reorderSuggestions = reorderSuggestions;
    }

    @GetMapping
    @Operation(operationId = "listCustomerOrders", summary = "List the current customer's orders",
        security = @SecurityRequirement(name = "bearerAuth"))
    @ApiResponse(responseCode = "200", description = "Customer order page",
        content = @Content(mediaType = "application/json",
            schema = @Schema(implementation = CustomerOrderHistoryService.CustomerOrderPage.class)))
    CustomerOrderHistoryService.CustomerOrderPage list(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(defaultValue = "0") @PositiveOrZero int page,
        @RequestParam(defaultValue = "10") @Min(1) @Max(20) int size
    ) {
        return history.list(authSubject(jwt), page, size);
    }

    @GetMapping("/latest-reorder")
    @Operation(operationId = "getLatestCustomerReorder",
        summary = "Get the newest currently fulfillable order configuration",
        security = @SecurityRequirement(name = "bearerAuth"))
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Current reorder configuration",
            content = @Content(mediaType = "application/json", schema = @Schema(
                implementation = CustomerReorderSuggestionService.CustomerReorderSuggestion.class))),
        @ApiResponse(responseCode = "204", description = "No fully fulfillable latest order")
    })
    ResponseEntity<CustomerReorderSuggestionService.CustomerReorderSuggestion> latestReorder(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam String locationSlug
    ) {
        Optional<CustomerReorderSuggestionService.CustomerReorderSuggestion> suggestion =
            reorderSuggestions.latest(authSubject(jwt), locationSlug);
        return suggestion.map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/{orderId}")
    @Operation(operationId = "getCustomerOrder", summary = "Get an owned customer order receipt",
        security = @SecurityRequirement(name = "bearerAuth"))
    @ApiResponse(responseCode = "200", description = "Customer order receipt",
        content = @Content(mediaType = "application/json",
            schema = @Schema(implementation = CustomerOrderHistoryService.CustomerOrderDetail.class)))
    CustomerOrderHistoryService.CustomerOrderDetail get(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID orderId
    ) {
        return history.get(authSubject(jwt), orderId);
    }

    private UUID authSubject(Jwt jwt) {
        try {
            return UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new CustomerIdentityInvalidException();
        }
    }

    @RestControllerAdvice(assignableTypes = CustomerOrderHistoryController.class)
    static class Advice {
        @ExceptionHandler({
            HandlerMethodValidationException.class,
            MethodArgumentTypeMismatchException.class,
            jakarta.validation.ConstraintViolationException.class
        })
        ResponseEntity<ProblemDetail> invalid() {
            return problem(HttpStatus.BAD_REQUEST, "customer-order-history-invalid",
                "Invalid order history request", "Check the page or order identifier and try again.",
                "CUSTOMER_ORDER_HISTORY_INVALID");
        }

        @ExceptionHandler(CustomerIdentityInvalidException.class)
        ResponseEntity<ProblemDetail> identity() {
            return problem(HttpStatus.UNAUTHORIZED, "customer-identity-invalid",
                "Invalid customer identity", "The authenticated customer identity is unavailable.",
                "CUSTOMER_IDENTITY_INVALID");
        }

        @ExceptionHandler(CustomerAccountUnavailableException.class)
        ResponseEntity<ProblemDetail> unavailableAccount() {
            return problem(HttpStatus.FORBIDDEN, "customer-account-unavailable",
                "Customer account unavailable", "This customer account cannot access order history.",
                "CUSTOMER_ACCOUNT_UNAVAILABLE");
        }

        @ExceptionHandler(CustomerOrderNotFoundException.class)
        ResponseEntity<ProblemDetail> notFound() {
            return problem(HttpStatus.NOT_FOUND, "customer-order-not-found",
                "Customer order not found", "The requested order is unavailable.",
                "CUSTOMER_ORDER_NOT_FOUND");
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

    private static final class CustomerIdentityInvalidException extends RuntimeException { }
}
