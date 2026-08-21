package com.bubbletea.shop.identity;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/customer/account")
@Tag(name = "Customer account")
public class CustomerAccountController {
    private final CustomerAccountService accounts;

    public CustomerAccountController(CustomerAccountService accounts) {
        this.accounts = accounts;
    }

    @PostMapping
    @Operation(
        operationId = "provisionCustomerAccount",
        summary = "Provision the authenticated customer account",
        security = @SecurityRequirement(name = "bearerAuth"))
    @ApiResponses({
        @ApiResponse(
            responseCode = "200",
            description = "Existing customer account",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = CustomerAccountDto.class))),
        @ApiResponse(
            responseCode = "201",
            description = "Customer account created",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = CustomerAccountDto.class))),
        @ApiResponse(
            responseCode = "401",
            description = "Invalid authenticated identity",
            content = @Content(
                mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(
            responseCode = "403",
            description = "Customer account disabled",
            content = @Content(
                mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class)))
    })
    ResponseEntity<CustomerAccountDto> provision(@AuthenticationPrincipal Jwt jwt) {
        UUID authSubject = authSubject(jwt);
        String email = email(jwt);
        CustomerAccountService.ProvisioningResult result = accounts.provision(authSubject, email);
        CustomerAccountDto body = new CustomerAccountDto(result.id(), email, result.createdAt());

        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK)
            .body(body);
    }

    private UUID authSubject(Jwt jwt) {
        try {
            return UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new CustomerIdentityClaimsException();
        }
    }

    private String email(Jwt jwt) {
        String email = jwt.getClaimAsString("email");
        if (email == null || email.isBlank() || email.length() > 254 || !email.contains("@")) {
            throw new CustomerIdentityClaimsException();
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }

    record CustomerAccountDto(UUID id, String email, Instant createdAt) {
    }

    @RestControllerAdvice(assignableTypes = CustomerAccountController.class)
    static class CustomerAccountExceptionHandler {
        @ExceptionHandler(CustomerIdentityClaimsException.class)
        ResponseEntity<ProblemDetail> invalidIdentity() {
            ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.UNAUTHORIZED,
                "The authenticated identity cannot be used for a customer account.");
            problem.setType(URI.create("https://bubble-tea.example/problems/customer-identity-invalid"));
            problem.setTitle("Invalid customer identity");
            problem.setProperty("code", "CUSTOMER_IDENTITY_INVALID");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(problem);
        }

        @ExceptionHandler(CustomerAccountDisabledException.class)
        ResponseEntity<ProblemDetail> disabledAccount() {
            ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.FORBIDDEN,
                "This customer account is unavailable.");
            problem.setType(URI.create("https://bubble-tea.example/problems/customer-account-disabled"));
            problem.setTitle("Customer account unavailable");
            problem.setProperty("code", "CUSTOMER_ACCOUNT_DISABLED");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(problem);
        }
    }
}
