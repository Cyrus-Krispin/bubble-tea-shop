package com.bubbletea.shop.inventory;

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
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/staff/organizations/{organizationId}/locations/{locationId}/inventory")
@Validated
@Tag(name = "Inventory management")
@ApiResponses({
    @ApiResponse(responseCode = "400", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "401", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "403", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "404", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "409", ref = "#/components/responses/Problem")
})
public class InventoryManagementController {
    private static final String QUANTITY_PATTERN = "^-?(0|[0-9]+)(\\.[0-9]{1,6})?$";
    private final InventoryManagementService inventory;

    public InventoryManagementController(InventoryManagementService inventory) {
        this.inventory = inventory;
    }

    @GetMapping("/balances")
    @Operation(operationId = "listInventoryBalances", summary = "List location inventory balances",
        security = @SecurityRequirement(name = "bearerAuth"))
    @ApiResponse(responseCode = "200", description = "Inventory balance page",
        content = @Content(mediaType = "application/json",
            schema = @Schema(implementation = InventoryManagementService.BalancePage.class)))
    InventoryManagementService.BalancePage balances(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @PathVariable UUID locationId,
        @RequestParam(defaultValue = "0") @PositiveOrZero int page,
        @RequestParam(defaultValue = "25") @Min(1) @Max(100) int size,
        @RequestParam(required = false) @Size(max = 160) String query,
        @RequestParam(defaultValue = "false") boolean includeArchived
    ) {
        return inventory.listBalances(authSubject(jwt), organizationId, locationId,
            page, size, query, includeArchived);
    }

    @GetMapping("/movements")
    @Operation(operationId = "listInventoryMovements", summary = "List immutable movement history",
        security = @SecurityRequirement(name = "bearerAuth"))
    @ApiResponse(responseCode = "200", description = "Inventory movement page",
        content = @Content(mediaType = "application/json",
            schema = @Schema(implementation = InventoryManagementService.MovementPage.class)))
    InventoryManagementService.MovementPage movements(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @PathVariable UUID locationId,
        @RequestParam(defaultValue = "0") @PositiveOrZero int page,
        @RequestParam(defaultValue = "25") @Min(1) @Max(100) int size,
        @RequestParam(required = false) UUID ingredientId,
        @RequestParam(required = false) InventoryMovementType movementType
    ) {
        return inventory.listMovements(authSubject(jwt), organizationId, locationId,
            page, size, ingredientId, movementType);
    }

    @PostMapping("/movements")
    @Operation(operationId = "createInventoryMovement", summary = "Record a manual stock movement",
        security = @SecurityRequirement(name = "bearerAuth"))
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Inventory movement recorded",
            content = @Content(mediaType = "application/json",
                schema = @Schema(implementation = InventoryManagementService.Movement.class))),
        @ApiResponse(responseCode = "400", ref = "#/components/responses/Problem"),
        @ApiResponse(responseCode = "401", ref = "#/components/responses/Problem"),
        @ApiResponse(responseCode = "403", ref = "#/components/responses/Problem"),
        @ApiResponse(responseCode = "404", ref = "#/components/responses/Problem"),
        @ApiResponse(responseCode = "409", ref = "#/components/responses/Problem")
    })
    ResponseEntity<InventoryManagementService.Movement> record(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @PathVariable UUID locationId,
        @Valid @RequestBody MovementRequest request
    ) {
        InventoryManagementService.Movement created = inventory.record(
            authSubject(jwt), organizationId, locationId,
            new InventoryManagementService.CreateMovement(request.ingredientId(),
                request.movementType(), request.quantityDelta(), request.sourceReference(),
                request.note(), request.totalCostMinor()));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    private UUID authSubject(Jwt jwt) {
        try {
            return UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new StaffIdentityClaimsException();
        }
    }

    @Schema(name = "CreateInventoryMovementRequest")
    public record MovementRequest(
        @NotNull UUID ingredientId,
        @NotNull InventoryManagementService.ManualMovementType movementType,
        @NotNull @Pattern(regexp = QUANTITY_PATTERN) String quantityDelta,
        @Size(max = 120) String sourceReference,
        @Size(max = 4000) String note,
        @PositiveOrZero Long totalCostMinor
    ) { }

    @RestControllerAdvice(assignableTypes = InventoryManagementController.class)
    static class InventoryExceptionHandler {
        @ExceptionHandler({InvalidInventoryException.class, MethodArgumentNotValidException.class,
            HttpMessageNotReadableException.class})
        ResponseEntity<ProblemDetail> invalid() {
            return problem(HttpStatus.BAD_REQUEST, "inventory-invalid", "Invalid inventory request",
                "Check the stock movement or filter values and try again.", "INVENTORY_INVALID");
        }

        @ExceptionHandler(StaffIdentityClaimsException.class)
        ResponseEntity<ProblemDetail> invalidIdentity() {
            return problem(HttpStatus.UNAUTHORIZED, "staff-identity-invalid", "Invalid staff identity",
                "The authenticated identity cannot be used for inventory access.",
                "STAFF_IDENTITY_INVALID");
        }

        @ExceptionHandler(StaffAccessDeniedException.class)
        ResponseEntity<ProblemDetail> accessDenied() {
            return problem(HttpStatus.FORBIDDEN, "staff-access-denied", "Staff access denied",
                "This identity cannot access inventory at the requested location.",
                "STAFF_ACCESS_DENIED");
        }

        @ExceptionHandler(StaffAccountDisabledException.class)
        ResponseEntity<ProblemDetail> disabled() {
            return problem(HttpStatus.FORBIDDEN, "staff-account-disabled", "Staff account unavailable",
                "This staff account is unavailable.", "STAFF_ACCOUNT_DISABLED");
        }

        @ExceptionHandler(InventoryNotFoundException.class)
        ResponseEntity<ProblemDetail> notFound() {
            return problem(HttpStatus.NOT_FOUND, "inventory-not-found", "Inventory resource not found",
                "The requested inventory resource is unavailable.", "INVENTORY_NOT_FOUND");
        }

        @ExceptionHandler(InventoryStateConflictException.class)
        ResponseEntity<ProblemDetail> stateConflict() {
            return problem(HttpStatus.CONFLICT, "inventory-state-conflict", "Inventory state conflict",
                "The stock movement conflicts with current inventory history.",
                "INVENTORY_STATE_CONFLICT");
        }

        @ExceptionHandler(InsufficientStockException.class)
        ResponseEntity<ProblemDetail> insufficient(InsufficientStockException exception) {
            ProblemDetail detail = problemDetail(HttpStatus.CONFLICT,
                "inventory-insufficient-stock", "Insufficient stock",
                "This movement would make one or more inventory balances negative.",
                "INVENTORY_INSUFFICIENT_STOCK");
            Map<String, Map<String, String>> shortages = new LinkedHashMap<>();
            exception.shortages().forEach((ingredientId, shortage) -> shortages.put(
                ingredientId.toString(), Map.of(
                    "requested", shortage.required().toPlainString(),
                    "available", shortage.available().toPlainString())));
            detail.setProperty("shortages", shortages);
            return ResponseEntity.status(HttpStatus.CONFLICT).body(detail);
        }

        private ResponseEntity<ProblemDetail> problem(
            HttpStatus status, String type, String title, String detail, String code
        ) {
            return ResponseEntity.status(status).body(problemDetail(status, type, title, detail, code));
        }

        private ProblemDetail problemDetail(
            HttpStatus status, String type, String title, String detail, String code
        ) {
            ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
            problem.setType(URI.create("https://bubble-tea.example/problems/" + type));
            problem.setTitle(title);
            problem.setProperty("code", code);
            return problem;
        }
    }
}
