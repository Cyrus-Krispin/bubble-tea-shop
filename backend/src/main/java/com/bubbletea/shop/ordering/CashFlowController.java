package com.bubbletea.shop.ordering;

import com.bubbletea.shop.identity.StaffIdentityClaimsException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/staff/organizations/{organizationId}/locations/{locationId}/cash-flow")
@SecurityRequirement(name = "bearerAuth")
@ApiResponses({
    @ApiResponse(responseCode = "400", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "401", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "403", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "404", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "409", ref = "#/components/responses/Problem")
})
public class CashFlowController {
    private final CashFlowService service;
    CashFlowController(CashFlowService service) { this.service = service; }
    @GetMapping
    @Operation(operationId = "getCashFlow", summary = "Summarize collected payments and recorded expenses")
    @ApiResponse(responseCode = "200", description = "Cash flow report", content = @Content(mediaType = "application/json", schema = @Schema(implementation = CashFlowService.Report.class)))
    CashFlowService.Report report(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
        @PathVariable UUID locationId, @RequestParam(defaultValue = "7") int days, @RequestParam(defaultValue = "0") int page) {
        return service.report(subject(jwt), organizationId, locationId, days, page);
    }
    @PostMapping("/expenses")
    @Operation(operationId = "recordPaidExpense", summary = "Record an expense paid now in the shop currency")
    @ApiResponse(responseCode = "201", description = "Expense recorded", content = @Content(mediaType = "application/json", schema = @Schema(implementation = CashFlowService.Expense.class)))
    @ApiResponse(responseCode = "200", description = "Matching expense replayed", content = @Content(mediaType = "application/json", schema = @Schema(implementation = CashFlowService.Expense.class)))
    ResponseEntity<CashFlowService.Expense> record(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
        @PathVariable UUID locationId, @RequestHeader("Idempotency-Key") UUID key, @Valid @RequestBody ExpenseRequest input) {
        var expense = service.record(subject(jwt), organizationId, locationId, key, input.amountMinor(), input.description());
        return ResponseEntity.status(expense.replayed() ? HttpStatus.OK : HttpStatus.CREATED).body(expense);
    }
    @PostMapping("/expenses/{expenseId}/void")
    @Operation(operationId = "voidPaidExpense", summary = "Correct a mistaken expense without deleting its history")
    @ApiResponse(responseCode = "200", description = "Expense correction", content = @Content(mediaType = "application/json", schema = @Schema(implementation = CashFlowService.Expense.class)))
    CashFlowService.Expense voidExpense(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
        @PathVariable UUID locationId, @PathVariable UUID expenseId, @Valid @RequestBody VoidRequest input) {
        return service.voidExpense(subject(jwt), organizationId, locationId, expenseId, input.reason());
    }
    private UUID subject(Jwt jwt) {
        try { return UUID.fromString(jwt.getSubject()); }
        catch (IllegalArgumentException | NullPointerException exception) { throw new StaffIdentityClaimsException(); }
    }
    public record ExpenseRequest(@Positive @Max(100000000) long amountMinor, @NotBlank @Size(max = 240) String description) {}
    public record VoidRequest(@NotBlank @Size(max = 240) String reason) {}
    @RestControllerAdvice(assignableTypes = CashFlowController.class)
    static class Errors {
        @ExceptionHandler({InvalidCashFlowException.class, MethodArgumentNotValidException.class})
        ResponseEntity<ProblemDetail> invalid() { return problem(HttpStatus.BAD_REQUEST, "Check the reporting period, expense amount, and description.", "CASH_FLOW_INVALID"); }
        @ExceptionHandler(CashFlowConflictException.class)
        ResponseEntity<ProblemDetail> conflict() { return problem(HttpStatus.CONFLICT, "This request key belongs to a different expense.", "CASH_FLOW_CONFLICT"); }
        @ExceptionHandler(CashFlowNotFoundException.class)
        ResponseEntity<ProblemDetail> missing() { return problem(HttpStatus.NOT_FOUND, "This expense is unavailable.", "CASH_FLOW_NOT_FOUND"); }
        private ResponseEntity<ProblemDetail> problem(HttpStatus status, String message, String code) {
            var detail = ProblemDetail.forStatusAndDetail(status, message); detail.setProperty("code", code);
            return ResponseEntity.status(status).body(detail);
        }
    }
}
