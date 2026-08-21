package com.bubbletea.shop.catalog;

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
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.dao.DataIntegrityViolationException;
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.http.converter.HttpMessageNotReadableException;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/staff/organizations/{organizationId}/ingredients")
@Validated
@Tag(name = "Ingredient management")
public class IngredientManagementController {
    private static final String QUANTITY_PATTERN = "^(0|[0-9]+)(\\.[0-9]{1,6})?$";
    private final IngredientManagementService ingredients;

    public IngredientManagementController(IngredientManagementService ingredients) {
        this.ingredients = ingredients;
    }

    @GetMapping
    @Operation(
        operationId = "listIngredients",
        summary = "List ingredients in an authorized organization",
        security = @SecurityRequirement(name = "bearerAuth"))
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Ingredient page",
            content = @Content(mediaType = "application/json",
                schema = @Schema(implementation = IngredientManagementService.IngredientPage.class))),
        @ApiResponse(responseCode = "400", description = "Invalid pagination or search input",
            content = @Content(mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "401", description = "Missing or invalid authenticated identity",
            content = @Content(mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "403", description = "No active catalog access",
            content = @Content(mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class)))
    })
    IngredientManagementService.IngredientPage list(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @RequestParam(defaultValue = "0") @PositiveOrZero int page,
        @RequestParam(defaultValue = "25") @jakarta.validation.constraints.Min(1)
        @jakarta.validation.constraints.Max(100) int size,
        @RequestParam(required = false) @Size(max = 160) String query,
        @RequestParam(defaultValue = "false") boolean includeArchived
    ) {
        return ingredients.list(authSubject(jwt), organizationId, page, size, query, includeArchived);
    }

    @PostMapping
    @Operation(
        operationId = "createIngredient",
        summary = "Create an ingredient",
        security = @SecurityRequirement(name = "bearerAuth"))
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Ingredient created",
            content = @Content(mediaType = "application/json",
                schema = @Schema(implementation = IngredientManagementService.Ingredient.class))),
        @ApiResponse(responseCode = "400", description = "Invalid ingredient input",
            content = @Content(mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "401", description = "Missing or invalid authenticated identity",
            content = @Content(mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "403", description = "No active catalog access",
            content = @Content(mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "409", description = "Ingredient name or SKU already exists",
            content = @Content(mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class)))
    })
    ResponseEntity<IngredientManagementService.Ingredient> create(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @Valid @RequestBody CreateIngredientRequest request
    ) {
        IngredientManagementService.Ingredient created = ingredients.create(
            authSubject(jwt), organizationId,
            new IngredientManagementService.CreateIngredient(
                request.name(), request.sku(), request.baseUnit(), request.reorderThreshold()));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{ingredientId}")
    @Operation(
        operationId = "updateIngredient",
        summary = "Update an active ingredient",
        security = @SecurityRequirement(name = "bearerAuth"))
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Ingredient updated",
            content = @Content(mediaType = "application/json",
                schema = @Schema(implementation = IngredientManagementService.Ingredient.class))),
        @ApiResponse(responseCode = "400", description = "Invalid ingredient input",
            content = @Content(mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "401", description = "Missing or invalid authenticated identity",
            content = @Content(mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "403", description = "No active catalog access",
            content = @Content(mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "Ingredient not found in this organization",
            content = @Content(mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "409", description = "Ingredient conflict or stale version",
            content = @Content(mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class)))
    })
    IngredientManagementService.Ingredient update(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @PathVariable UUID ingredientId,
        @Valid @RequestBody UpdateIngredientRequest request
    ) {
        return ingredients.update(authSubject(jwt), organizationId, ingredientId,
            new IngredientManagementService.UpdateIngredient(
                request.name(), request.sku(), request.reorderThreshold(), request.version()));
    }

    @PostMapping("/{ingredientId}/archive")
    @Operation(
        operationId = "archiveIngredient",
        summary = "Archive an ingredient",
        security = @SecurityRequirement(name = "bearerAuth"))
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Ingredient archived or already archived",
            content = @Content(mediaType = "application/json",
                schema = @Schema(implementation = IngredientManagementService.Ingredient.class))),
        @ApiResponse(responseCode = "400", description = "Invalid version",
            content = @Content(mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "401", description = "Missing or invalid authenticated identity",
            content = @Content(mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "403", description = "No active catalog access",
            content = @Content(mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "Ingredient not found in this organization",
            content = @Content(mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "409", description = "Ingredient version is stale",
            content = @Content(mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class)))
    })
    IngredientManagementService.Ingredient archive(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @PathVariable UUID ingredientId,
        @Valid @RequestBody ArchiveIngredientRequest request
    ) {
        return ingredients.archive(authSubject(jwt), organizationId, ingredientId, request.version());
    }

    private UUID authSubject(Jwt jwt) {
        try {
            return UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new StaffIdentityClaimsException();
        }
    }

    record CreateIngredientRequest(
        @NotBlank @Size(max = 160) String name,
        @Schema(nullable = true) @Size(max = 80) String sku,
        @NotNull BaseUnit baseUnit,
        @Schema(nullable = true) @Pattern(regexp = QUANTITY_PATTERN) String reorderThreshold
    ) {
    }

    record UpdateIngredientRequest(
        @NotBlank @Size(max = 160) String name,
        @Schema(nullable = true) @Size(max = 80) String sku,
        @Schema(nullable = true) @Pattern(regexp = QUANTITY_PATTERN) String reorderThreshold,
        @NotNull @PositiveOrZero Long version
    ) {
    }

    record ArchiveIngredientRequest(@NotNull @PositiveOrZero Long version) {
    }

    @RestControllerAdvice(assignableTypes = IngredientManagementController.class)
    static class IngredientExceptionHandler {
        @ExceptionHandler(StaffAccessDeniedException.class)
        ResponseEntity<ProblemDetail> denied() {
            return problem(HttpStatus.FORBIDDEN, "STAFF_ACCESS_DENIED", "Staff access denied");
        }

        @ExceptionHandler(StaffAccountDisabledException.class)
        ResponseEntity<ProblemDetail> disabled() {
            return problem(HttpStatus.FORBIDDEN, "STAFF_ACCOUNT_DISABLED", "Staff account unavailable");
        }

        @ExceptionHandler(StaffIdentityClaimsException.class)
        ResponseEntity<ProblemDetail> invalidIdentity() {
            return problem(HttpStatus.UNAUTHORIZED, "STAFF_IDENTITY_INVALID", "Invalid staff identity");
        }

        @ExceptionHandler({InvalidIngredientException.class, IllegalArgumentException.class,
            org.springframework.web.bind.MethodArgumentNotValidException.class,
            jakarta.validation.ConstraintViolationException.class,
            HttpMessageNotReadableException.class})
        ResponseEntity<ProblemDetail> invalid() {
            return problem(HttpStatus.BAD_REQUEST, "INGREDIENT_INVALID", "Invalid ingredient");
        }

        @ExceptionHandler(DataIntegrityViolationException.class)
        ResponseEntity<ProblemDetail> conflict() {
            return problem(HttpStatus.CONFLICT, "INGREDIENT_CONFLICT", "Ingredient conflict");
        }

        @ExceptionHandler(IngredientVersionConflictException.class)
        ResponseEntity<ProblemDetail> versionConflict() {
            return problem(HttpStatus.CONFLICT, "INGREDIENT_VERSION_CONFLICT", "Ingredient changed");
        }

        @ExceptionHandler(IngredientNotFoundException.class)
        ResponseEntity<ProblemDetail> notFound() {
            return problem(HttpStatus.NOT_FOUND, "INGREDIENT_NOT_FOUND", "Ingredient not found");
        }

        private ResponseEntity<ProblemDetail> problem(HttpStatus status, String code, String title) {
            ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, title);
            problem.setType(URI.create(
                "https://bubble-tea.example/problems/" + code.toLowerCase().replace('_', '-')));
            problem.setTitle(title);
            problem.setProperty("code", code);
            return ResponseEntity.status(status).body(problem);
        }
    }
}
