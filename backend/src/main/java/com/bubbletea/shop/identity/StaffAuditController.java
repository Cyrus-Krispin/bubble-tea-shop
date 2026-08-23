package com.bubbletea.shop.identity;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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

import java.net.URI;
import java.util.UUID;

@Validated
@RestController
@RequestMapping("/api/v1/staff/organizations/{organizationId}/audit-events")
@Tag(name = "Staff audit")
public class StaffAuditController {
    private final StaffAuditService audit;

    public StaffAuditController(StaffAuditService audit) {
        this.audit = audit;
    }

    @GetMapping
    @Operation(
        operationId = "listStaffAuditEvents",
        summary = "List the caller's authorized audit timeline",
        security = @SecurityRequirement(name = "bearerAuth"))
    @ApiResponse(
        responseCode = "200",
        description = "Newest-first audit events",
        content = @Content(schema = @Schema(implementation = StaffAuditService.AuditPage.class)))
    StaffAuditService.AuditPage list(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @RequestParam(required = false) StaffAuditService.AuditCategory category,
        @RequestParam(defaultValue = "0") @Min(0) int page,
        @RequestParam(defaultValue = "50") @Min(1) @Max(100) int size
    ) {
        return audit.list(authSubject(jwt), organizationId, category, page, size);
    }

    private UUID authSubject(Jwt jwt) {
        try {
            return UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new StaffIdentityClaimsException();
        }
    }

    @RestControllerAdvice(assignableTypes = StaffAuditController.class)
    static class StaffAuditExceptionHandler {
        @ExceptionHandler(StaffIdentityClaimsException.class)
        ResponseEntity<ProblemDetail> invalidIdentity() {
            return problem(HttpStatus.UNAUTHORIZED, "staff-identity-invalid", "Invalid staff identity",
                "The authenticated identity cannot be used for staff access.", "STAFF_IDENTITY_INVALID");
        }

        @ExceptionHandler(StaffAccessDeniedException.class)
        ResponseEntity<ProblemDetail> accessDenied() {
            return problem(HttpStatus.FORBIDDEN, "staff-access-denied", "Staff access denied",
                "This identity does not have access to the requested organization.", "STAFF_ACCESS_DENIED");
        }

        @ExceptionHandler(StaffAccountDisabledException.class)
        ResponseEntity<ProblemDetail> disabledAccount() {
            return problem(HttpStatus.FORBIDDEN, "staff-account-disabled", "Staff account unavailable",
                "This staff account is unavailable.", "STAFF_ACCOUNT_DISABLED");
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
