package com.bubbletea.shop.identity;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/staff/context")
public class StaffContextController {
    private final StaffContextService staffContext;

    public StaffContextController(StaffContextService staffContext) {
        this.staffContext = staffContext;
    }

    @GetMapping
    StaffContextService.StaffContext get(@AuthenticationPrincipal Jwt jwt) {
        return staffContext.resolve(authSubject(jwt));
    }

    private UUID authSubject(Jwt jwt) {
        try {
            return UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new StaffIdentityClaimsException();
        }
    }

    @RestControllerAdvice(assignableTypes = StaffContextController.class)
    static class StaffContextExceptionHandler {
        @ExceptionHandler(StaffIdentityClaimsException.class)
        ResponseEntity<ProblemDetail> invalidIdentity() {
            return problem(
                HttpStatus.UNAUTHORIZED,
                "https://bubble-tea.example/problems/staff-identity-invalid",
                "Invalid staff identity",
                "The authenticated identity cannot be used for staff access.",
                "STAFF_IDENTITY_INVALID");
        }

        @ExceptionHandler(StaffAccessDeniedException.class)
        ResponseEntity<ProblemDetail> accessDenied() {
            return problem(
                HttpStatus.FORBIDDEN,
                "https://bubble-tea.example/problems/staff-access-denied",
                "Staff access denied",
                "This identity does not have active staff access.",
                "STAFF_ACCESS_DENIED");
        }

        @ExceptionHandler(StaffAccountDisabledException.class)
        ResponseEntity<ProblemDetail> disabledAccount() {
            return problem(
                HttpStatus.FORBIDDEN,
                "https://bubble-tea.example/problems/staff-account-disabled",
                "Staff account unavailable",
                "This staff account is unavailable.",
                "STAFF_ACCOUNT_DISABLED");
        }

        private ResponseEntity<ProblemDetail> problem(
            HttpStatus status,
            String type,
            String title,
            String detail,
            String code
        ) {
            ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
            problem.setType(URI.create(type));
            problem.setTitle(title);
            problem.setProperty("code", code);
            return ResponseEntity.status(status).body(problem);
        }
    }
}
