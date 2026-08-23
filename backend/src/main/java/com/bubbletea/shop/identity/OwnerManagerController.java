package com.bubbletea.shop.identity;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@Validated
@RestController
@RequestMapping("/api/v1/staff/organizations/{organizationId}/managers")
@Tag(name = "Owner manager management")
public class OwnerManagerController {
    private final OwnerManagerService managers;

    public OwnerManagerController(OwnerManagerService managers) {
        this.managers = managers;
    }

    @GetMapping
    @Operation(
        operationId = "listOrganizationManagers",
        summary = "List manager memberships as an owner",
        security = @SecurityRequirement(name = "bearerAuth"))
    OwnerManagerService.ManagerPage list(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @RequestParam(defaultValue = "0") @Min(0) int page,
        @RequestParam(defaultValue = "25") @Min(1) @Max(100) int size
    ) {
        return managers.list(subject(jwt), organizationId, page, size);
    }

    @PostMapping
    @Operation(
        operationId = "addOrReactivateOrganizationManager",
        summary = "Add or reactivate a registered customer as a manager",
        security = @SecurityRequirement(name = "bearerAuth"))
    @ApiResponses({
        @ApiResponse(
            responseCode = "200",
            description = "Manager reactivated",
            content = @Content(schema = @Schema(implementation = OwnerManagerService.ManagerSummary.class))),
        @ApiResponse(
            responseCode = "201",
            description = "Manager created",
            content = @Content(schema = @Schema(implementation = OwnerManagerService.ManagerSummary.class)))
    })
    ResponseEntity<OwnerManagerService.ManagerSummary> add(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @Valid @RequestBody AddManagerRequest request
    ) {
        OwnerManagerService.MutationResult result = managers.addOrReactivate(
            subject(jwt), organizationId, request.email(), request.locationIds());
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK)
            .body(result.manager());
    }

    @PutMapping("/{membershipId}/assignments")
    @Operation(
        operationId = "replaceOrganizationManagerAssignments",
        summary = "Replace an active manager's assigned locations",
        security = @SecurityRequirement(name = "bearerAuth"))
    OwnerManagerService.ManagerSummary assignments(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @PathVariable UUID membershipId,
        @Valid @RequestBody AssignmentRequest request
    ) {
        return managers.replaceAssignments(
            subject(jwt), organizationId, membershipId, request.version(), request.locationIds());
    }

    @PostMapping("/{membershipId}/deactivate")
    @Operation(
        operationId = "deactivateOrganizationManager",
        summary = "Deactivate a manager membership",
        security = @SecurityRequirement(name = "bearerAuth"))
    OwnerManagerService.ManagerSummary deactivate(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @PathVariable UUID membershipId,
        @Valid @RequestBody VersionRequest request
    ) {
        return managers.deactivate(subject(jwt), organizationId, membershipId, request.version());
    }

    private UUID subject(Jwt jwt) {
        try {
            return UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new StaffIdentityClaimsException();
        }
    }

    public record AddManagerRequest(
        @NotBlank @Email @Size(max = 254) String email,
        @NotEmpty @Size(max = 100) List<@NotNull UUID> locationIds
    ) { }

    public record AssignmentRequest(
        @NotNull @Min(0) Long version,
        @NotEmpty @Size(max = 100) List<@NotNull UUID> locationIds
    ) { }

    public record VersionRequest(@NotNull @Min(0) Long version) { }

    @RestControllerAdvice(assignableTypes = OwnerManagerController.class)
    static class OwnerManagerExceptionHandler {
        @ExceptionHandler({
            MethodArgumentNotValidException.class,
            OwnerManagerService.ManagerInvalidException.class
        })
        ResponseEntity<ProblemDetail> invalid() {
            return problem(HttpStatus.BAD_REQUEST, "manager-invalid", "Invalid manager request",
                "Provide a valid registered email and distinct active organization locations.",
                "MANAGER_INVALID");
        }

        @ExceptionHandler(OwnerManagerService.ManagerAccountNotFoundException.class)
        ResponseEntity<ProblemDetail> accountNotFound() {
            return problem(HttpStatus.NOT_FOUND, "manager-account-not-found", "Manager account unavailable",
                "No enabled registered customer account matches that email.",
                "MANAGER_ACCOUNT_NOT_FOUND");
        }

        @ExceptionHandler(OwnerManagerService.ManagerNotFoundException.class)
        ResponseEntity<ProblemDetail> managerNotFound() {
            return problem(HttpStatus.NOT_FOUND, "manager-not-found", "Manager unavailable",
                "The requested manager membership is unavailable.", "MANAGER_NOT_FOUND");
        }

        @ExceptionHandler(OwnerManagerService.ManagerConflictException.class)
        ResponseEntity<ProblemDetail> conflict() {
            return problem(HttpStatus.CONFLICT, "manager-conflict", "Manager state conflict",
                "The account already has access or the manager is not active for this operation.",
                "MANAGER_CONFLICT");
        }

        @ExceptionHandler(OwnerManagerService.ManagerVersionConflictException.class)
        ResponseEntity<ProblemDetail> stale() {
            return problem(HttpStatus.CONFLICT, "manager-version-conflict", "Manager changed",
                "Reload the manager before applying this change.", "MANAGER_VERSION_CONFLICT");
        }

        @ExceptionHandler(StaffIdentityClaimsException.class)
        ResponseEntity<ProblemDetail> invalidIdentity() {
            return problem(HttpStatus.UNAUTHORIZED, "staff-identity-invalid", "Invalid staff identity",
                "The authenticated identity cannot be used for staff access.", "STAFF_IDENTITY_INVALID");
        }

        @ExceptionHandler(StaffAccessDeniedException.class)
        ResponseEntity<ProblemDetail> accessDenied() {
            return problem(HttpStatus.FORBIDDEN, "staff-access-denied", "Staff access denied",
                "This identity does not have owner access to the requested organization.",
                "STAFF_ACCESS_DENIED");
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
