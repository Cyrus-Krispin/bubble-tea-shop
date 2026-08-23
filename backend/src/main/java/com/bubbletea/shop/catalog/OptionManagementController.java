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
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
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

@RestController
@RequestMapping("/api/v1/staff/organizations/{organizationId}")
@Validated
@Tag(name = "Option management")
@SecurityRequirement(name = "bearerAuth")
@ApiResponses({
    @ApiResponse(responseCode = "400", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "401", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "403", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "404", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "409", ref = "#/components/responses/Problem")
})
public class OptionManagementController {
    private static final String PROBLEM_RESPONSE = "#/components/responses/Problem";
    private static final String SIGNED_QUANTITY = "^-?[0-9]+(?:\\.[0-9]{1,6})?$";
    private final OptionManagementService options;

    public OptionManagementController(OptionManagementService options) {
        this.options = options;
    }

    @GetMapping("/option-groups")
    @Operation(operationId = "listOptionGroups", summary = "List organization option groups")
    @ApiResponses({@ApiResponse(responseCode = "200", description = "Option group page"),
        @ApiResponse(responseCode = "400", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "401", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "403", ref = PROBLEM_RESPONSE)})
    OptionManagementService.GroupPage list(
        @AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
        @RequestParam(defaultValue = "0") @PositiveOrZero int page,
        @RequestParam(defaultValue = "25") @Min(1) @Max(100) int size,
        @RequestParam(required = false) @Size(max = 120) String query,
        @RequestParam(defaultValue = "false") boolean includeArchived
    ) {
        return options.list(subject(jwt), organizationId, page, size, query, includeArchived);
    }

    @PostMapping("/option-groups")
    @Operation(operationId = "createOptionGroup", summary = "Create an option group")
    @ApiResponse(responseCode = "201", description = "Option group created")
    ResponseEntity<OptionManagementService.GroupDetail> createGroup(
        @AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
        @Valid @RequestBody GroupRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(options.createGroup(
            subject(jwt), organizationId, request.toInput(0)));
    }

    @GetMapping("/option-groups/{groupId}")
    @Operation(operationId = "getOptionGroup", summary = "Get an option group and choices")
    @ApiResponse(responseCode = "200", description = "Option group detail")
    OptionManagementService.GroupDetail detail(
        @AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
        @PathVariable UUID groupId,
        @RequestParam(defaultValue = "false") boolean includeArchivedChoices
    ) {
        return options.detail(subject(jwt), organizationId, groupId, includeArchivedChoices);
    }

    @PutMapping("/option-groups/{groupId}")
    @Operation(operationId = "updateOptionGroup", summary = "Update an active option group")
    @ApiResponse(responseCode = "200", description = "Option group updated")
    OptionManagementService.GroupDetail updateGroup(
        @AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
        @PathVariable UUID groupId, @Valid @RequestBody UpdateGroupRequest request
    ) {
        return options.updateGroup(subject(jwt), organizationId, groupId, request.toInput());
    }

    @PostMapping("/option-groups/{groupId}/archive")
    @Operation(operationId = "archiveOptionGroup", summary = "Archive an unused option group")
    @ApiResponse(responseCode = "200", description = "Option group archived or already archived")
    OptionManagementService.GroupDetail archiveGroup(
        @AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
        @PathVariable UUID groupId, @Valid @RequestBody VersionRequest request
    ) {
        return options.archiveGroup(subject(jwt), organizationId, groupId, request.version());
    }

    @PostMapping("/option-groups/{groupId}/choices")
    @Operation(operationId = "createOptionChoice", summary = "Create an option choice")
    @ApiResponse(responseCode = "201", description = "Option choice created")
    ResponseEntity<OptionManagementService.GroupDetail> createChoice(
        @AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
        @PathVariable UUID groupId, @Valid @RequestBody ChoiceRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(options.createChoice(
            subject(jwt), organizationId, groupId, request.toInput(0)));
    }

    @PutMapping("/option-groups/{groupId}/choices/{choiceId}")
    @Operation(operationId = "updateOptionChoice", summary = "Update an active option choice")
    @ApiResponse(responseCode = "200", description = "Option choice updated")
    OptionManagementService.GroupDetail updateChoice(
        @AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
        @PathVariable UUID groupId, @PathVariable UUID choiceId,
        @Valid @RequestBody UpdateChoiceRequest request
    ) {
        return options.updateChoice(subject(jwt), organizationId, groupId, choiceId,
            request.toInput());
    }

    @PostMapping("/option-groups/{groupId}/choices/{choiceId}/archive")
    @Operation(operationId = "archiveOptionChoice", summary = "Archive an unused option choice")
    @ApiResponse(responseCode = "200", description = "Option choice archived or already archived")
    OptionManagementService.GroupDetail archiveChoice(
        @AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
        @PathVariable UUID groupId, @PathVariable UUID choiceId,
        @Valid @RequestBody VersionRequest request
    ) {
        return options.archiveChoice(subject(jwt), organizationId, groupId, choiceId,
            request.version());
    }

    @PutMapping("/menu-products/{productId}/variants/{variantId}/choices/{choiceId}")
    @Operation(operationId = "configureVariantOptionChoice",
        summary = "Replace a variant choice price and ingredient effects")
    @ApiResponse(responseCode = "200", description = "Variant choice configured")
    MenuManagementService.VariantChoice configure(
        @AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
        @PathVariable UUID productId, @PathVariable UUID variantId, @PathVariable UUID choiceId,
        @Valid @RequestBody ConfigurationRequest request
    ) {
        return options.configure(subject(jwt), organizationId, productId, variantId, choiceId,
            new OptionManagementService.ConfigurationInput(request.enabled(),
                request.priceDeltaMinor(), request.version(), request.ingredientEffects().stream()
                    .map(effect -> new OptionManagementService.EffectInput(
                        effect.ingredientId(), effect.quantityDelta())).toList()));
    }

    private UUID subject(Jwt jwt) {
        try {
            return UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new StaffIdentityClaimsException();
        }
    }

    record GroupRequest(@NotBlank @Size(max = 120) String name,
                        @PositiveOrZero int minimumSelections,
                        @Min(1) int maximumSelections,
                        @PositiveOrZero int displayOrder) {
        OptionManagementService.GroupInput toInput(long version) {
            return new OptionManagementService.GroupInput(name, minimumSelections,
                maximumSelections, displayOrder, version);
        }
    }
    record UpdateGroupRequest(@NotBlank @Size(max = 120) String name,
                              @PositiveOrZero int minimumSelections,
                              @Min(1) int maximumSelections,
                              @PositiveOrZero int displayOrder,
                              @NotNull @PositiveOrZero Long version) {
        OptionManagementService.GroupInput toInput() {
            return new OptionManagementService.GroupInput(name, minimumSelections,
                maximumSelections, displayOrder, version);
        }
    }
    record ChoiceRequest(@NotBlank @Size(max = 120) String name,
                         @PositiveOrZero int displayOrder, boolean defaultChoice) {
        OptionManagementService.ChoiceInput toInput(long version) {
            return new OptionManagementService.ChoiceInput(name, displayOrder, defaultChoice, version);
        }
    }
    record UpdateChoiceRequest(@NotBlank @Size(max = 120) String name,
                               @PositiveOrZero int displayOrder, boolean defaultChoice,
                               @NotNull @PositiveOrZero Long version) {
        OptionManagementService.ChoiceInput toInput() {
            return new OptionManagementService.ChoiceInput(name, displayOrder, defaultChoice, version);
        }
    }
    record ConfigurationRequest(boolean enabled, long priceDeltaMinor,
                                @Schema(nullable = true) @PositiveOrZero Long version,
                                @NotNull @Size(max = 100)
                                List<@Valid IngredientEffectRequest> ingredientEffects) { }
    record IngredientEffectRequest(@NotNull UUID ingredientId,
                                   @NotBlank @Pattern(regexp = SIGNED_QUANTITY)
                                   String quantityDelta) { }
    record VersionRequest(@NotNull @PositiveOrZero Long version) { }

    @RestControllerAdvice(assignableTypes = OptionManagementController.class)
    static class OptionExceptionHandler {
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

        @ExceptionHandler({InvalidOptionException.class,
            org.springframework.web.bind.MethodArgumentNotValidException.class,
            jakarta.validation.ConstraintViolationException.class,
            HttpMessageNotReadableException.class})
        ResponseEntity<ProblemDetail> invalid() {
            return problem(HttpStatus.BAD_REQUEST, "OPTION_INVALID", "Invalid option");
        }

        @ExceptionHandler(DataIntegrityViolationException.class)
        ResponseEntity<ProblemDetail> conflict() {
            return problem(HttpStatus.CONFLICT, "OPTION_CONFLICT", "Option conflict");
        }

        @ExceptionHandler(OptionVersionConflictException.class)
        ResponseEntity<ProblemDetail> versionConflict() {
            return problem(HttpStatus.CONFLICT, "OPTION_VERSION_CONFLICT", "Option changed");
        }

        @ExceptionHandler(OptionStateConflictException.class)
        ResponseEntity<ProblemDetail> stateConflict() {
            return problem(HttpStatus.CONFLICT, "OPTION_STATE_CONFLICT", "Option state conflict");
        }

        @ExceptionHandler(OptionNotFoundException.class)
        ResponseEntity<ProblemDetail> notFound() {
            return problem(HttpStatus.NOT_FOUND, "OPTION_NOT_FOUND", "Option not found");
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
