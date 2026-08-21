package com.bubbletea.shop.catalog;

import com.bubbletea.shop.identity.StaffAccessDeniedException;
import com.bubbletea.shop.identity.StaffAccountDisabledException;
import com.bubbletea.shop.identity.StaffIdentityClaimsException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.GetMapping;
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

@RestController
@RequestMapping("/api/v1/staff/organizations/{organizationId}/recipes")
@Validated
@Tag(name = "Recipe management")
@SecurityRequirement(name = "bearerAuth")
public class RecipeManagementController {
    private static final String PROBLEM_RESPONSE = "#/components/responses/Problem";
    private static final String POSITIVE_QUANTITY = "^[0-9]+(\\.[0-9]{1,6})?$";
    private final RecipeManagementService recipes;

    public RecipeManagementController(RecipeManagementService recipes) {
        this.recipes = recipes;
    }

    @GetMapping
    @Operation(operationId = "listRecipes", summary = "List recipes in an authorized organization")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Recipe page"),
        @ApiResponse(responseCode = "400", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "401", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "403", ref = PROBLEM_RESPONSE)
    })
    RecipeManagementService.RecipePage list(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @RequestParam(defaultValue = "0") @PositiveOrZero int page,
        @RequestParam(defaultValue = "25") @Min(1) @Max(100) int size,
        @RequestParam(required = false) @Size(max = 160) String query,
        @RequestParam(defaultValue = "false") boolean includeArchived
    ) {
        return recipes.list(authSubject(jwt), organizationId, page, size, query, includeArchived);
    }

    @PostMapping
    @Operation(operationId = "createRecipe", summary = "Create a recipe with an empty draft")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Recipe created"),
        @ApiResponse(responseCode = "400", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "401", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "403", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "409", ref = PROBLEM_RESPONSE)
    })
    ResponseEntity<RecipeManagementService.RecipeDetail> create(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @Valid @RequestBody CreateRecipeRequest request
    ) {
        RecipeManagementService.RecipeDetail created = recipes.create(authSubject(jwt), organizationId,
            new RecipeManagementService.CreateRecipe(request.name(), request.description()));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/{recipeId}")
    @Operation(operationId = "getRecipe", summary = "Get recipe metadata and version history")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Recipe detail"),
        @ApiResponse(responseCode = "401", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "403", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "404", ref = PROBLEM_RESPONSE)
    })
    RecipeManagementService.RecipeDetail detail(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @PathVariable UUID recipeId
    ) {
        return recipes.detail(authSubject(jwt), organizationId, recipeId);
    }

    @PutMapping("/{recipeId}")
    @Operation(operationId = "updateRecipe", summary = "Update active recipe metadata")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Recipe updated"),
        @ApiResponse(responseCode = "400", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "401", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "403", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "404", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "409", ref = PROBLEM_RESPONSE)
    })
    RecipeManagementService.RecipeDetail update(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @PathVariable UUID recipeId,
        @Valid @RequestBody UpdateRecipeRequest request
    ) {
        return recipes.update(authSubject(jwt), organizationId, recipeId,
            new RecipeManagementService.UpdateRecipe(
                request.name(), request.description(), request.version()));
    }

    @PostMapping("/{recipeId}/archive")
    @Operation(operationId = "archiveRecipe", summary = "Archive an unused recipe")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Recipe archived or already archived"),
        @ApiResponse(responseCode = "400", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "401", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "403", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "404", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "409", ref = PROBLEM_RESPONSE)
    })
    RecipeManagementService.RecipeDetail archive(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @PathVariable UUID recipeId,
        @Valid @RequestBody VersionRequest request
    ) {
        return recipes.archive(authSubject(jwt), organizationId, recipeId, request.version());
    }

    @PostMapping("/{recipeId}/versions")
    @Operation(operationId = "createRecipeVersion", summary = "Create the next recipe draft")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Draft version created"),
        @ApiResponse(responseCode = "400", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "401", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "403", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "404", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "409", ref = PROBLEM_RESPONSE)
    })
    ResponseEntity<RecipeManagementService.RecipeVersion> createVersion(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @PathVariable UUID recipeId,
        @Valid @RequestBody CreateVersionRequest request
    ) {
        RecipeManagementService.RecipeVersion created = recipes.createVersion(
            authSubject(jwt), organizationId, recipeId,
            new RecipeManagementService.CreateVersion(request.version(), request.sourceVersionId()));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{recipeId}/versions/{versionId}/draft")
    @Operation(operationId = "replaceRecipeDraft", summary = "Replace a draft formula atomically")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Draft formula replaced"),
        @ApiResponse(responseCode = "400", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "401", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "403", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "404", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "409", ref = PROBLEM_RESPONSE)
    })
    RecipeManagementService.RecipeVersion replaceDraft(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @PathVariable UUID recipeId,
        @PathVariable UUID versionId,
        @Valid @RequestBody UpdateDraftRequest request
    ) {
        return recipes.replaceDraft(authSubject(jwt), organizationId, recipeId, versionId,
            new RecipeManagementService.UpdateDraft(request.version(), request.components().stream()
                .map(component -> new RecipeManagementService.ComponentInput(
                    component.ingredientId(), component.quantity()))
                .toList()));
    }

    @PostMapping("/{recipeId}/versions/{versionId}/publish")
    @Operation(operationId = "publishRecipeVersion", summary = "Publish and freeze a recipe draft")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Recipe version published"),
        @ApiResponse(responseCode = "400", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "401", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "403", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "404", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "409", ref = PROBLEM_RESPONSE)
    })
    RecipeManagementService.RecipeVersion publish(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @PathVariable UUID recipeId,
        @PathVariable UUID versionId,
        @Valid @RequestBody VersionRequest request
    ) {
        return recipes.publish(authSubject(jwt), organizationId, recipeId, versionId,
            request.version());
    }

    @PostMapping("/{recipeId}/versions/{versionId}/retire")
    @Operation(operationId = "retireRecipeVersion", summary = "Retire an unused published version")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Recipe version retired"),
        @ApiResponse(responseCode = "400", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "401", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "403", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "404", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "409", ref = PROBLEM_RESPONSE)
    })
    RecipeManagementService.RecipeVersion retire(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID organizationId,
        @PathVariable UUID recipeId,
        @PathVariable UUID versionId,
        @Valid @RequestBody VersionRequest request
    ) {
        return recipes.retire(authSubject(jwt), organizationId, recipeId, versionId,
            request.version());
    }

    private UUID authSubject(Jwt jwt) {
        try {
            return UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new StaffIdentityClaimsException();
        }
    }

    record CreateRecipeRequest(
        @NotBlank @Size(max = 160) String name,
        @Schema(nullable = true) @Size(max = 4000) String description
    ) { }

    record UpdateDraftRequest(
        @NotNull @PositiveOrZero Long version,
        @NotNull @Size(max = 100) List<@Valid ComponentRequest> components
    ) { }

    record UpdateRecipeRequest(
        @NotBlank @Size(max = 160) String name,
        @Schema(nullable = true) @Size(max = 4000) String description,
        @NotNull @PositiveOrZero Long version
    ) { }

    record CreateVersionRequest(
        @NotNull @PositiveOrZero Long version,
        @Schema(nullable = true) UUID sourceVersionId
    ) { }

    record ComponentRequest(
        @NotNull UUID ingredientId,
        @NotBlank @Pattern(regexp = POSITIVE_QUANTITY) String quantity
    ) { }

    record VersionRequest(@NotNull @PositiveOrZero Long version) { }

    @RestControllerAdvice(assignableTypes = RecipeManagementController.class)
    static class RecipeExceptionHandler {
        @ExceptionHandler(StaffAccessDeniedException.class)
        ResponseEntity<ProblemDetail> denied() {
            return problem(HttpStatus.FORBIDDEN, "STAFF_ACCESS_DENIED", "Staff access denied");
        }

        @ExceptionHandler(StaffAccountDisabledException.class)
        ResponseEntity<ProblemDetail> disabled() {
            return problem(HttpStatus.FORBIDDEN, "STAFF_ACCOUNT_DISABLED", "Staff account unavailable");
        }

        @ExceptionHandler(StaffIdentityClaimsException.class)
        ResponseEntity<ProblemDetail> identity() {
            return problem(HttpStatus.UNAUTHORIZED, "STAFF_IDENTITY_INVALID", "Invalid staff identity");
        }

        @ExceptionHandler({InvalidRecipeException.class,
            org.springframework.web.bind.MethodArgumentNotValidException.class,
            jakarta.validation.ConstraintViolationException.class,
            HttpMessageNotReadableException.class})
        ResponseEntity<ProblemDetail> invalid() {
            return problem(HttpStatus.BAD_REQUEST, "RECIPE_INVALID", "Invalid recipe");
        }

        @ExceptionHandler(DataIntegrityViolationException.class)
        ResponseEntity<ProblemDetail> conflict() {
            return problem(HttpStatus.CONFLICT, "RECIPE_CONFLICT", "Recipe conflict");
        }

        @ExceptionHandler(RecipeVersionConflictException.class)
        ResponseEntity<ProblemDetail> versionConflict() {
            return problem(HttpStatus.CONFLICT, "RECIPE_VERSION_CONFLICT", "Recipe changed");
        }

        @ExceptionHandler(RecipeStateConflictException.class)
        ResponseEntity<ProblemDetail> stateConflict() {
            return problem(HttpStatus.CONFLICT, "RECIPE_STATE_CONFLICT", "Recipe state conflict");
        }

        @ExceptionHandler(RecipeNotFoundException.class)
        ResponseEntity<ProblemDetail> notFound() {
            return problem(HttpStatus.NOT_FOUND, "RECIPE_NOT_FOUND", "Recipe not found");
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
