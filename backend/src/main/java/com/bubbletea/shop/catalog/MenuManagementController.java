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
@Tag(name = "Menu management")
@SecurityRequirement(name = "bearerAuth")
@ApiResponses({
    @ApiResponse(responseCode = "400", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "401", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "403", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "404", ref = "#/components/responses/Problem"),
    @ApiResponse(responseCode = "409", ref = "#/components/responses/Problem")
})
public class MenuManagementController {
    private static final String PROBLEM_RESPONSE = "#/components/responses/Problem";
    private static final String KEBAB = "^[a-z0-9]+(?:-[a-z0-9]+)*$";
    private final MenuManagementService menus;

    public MenuManagementController(MenuManagementService menus) {
        this.menus = menus;
    }

    @GetMapping("/menu-products")
    @Operation(operationId = "listMenuProducts", summary = "List organization menu products")
    @ApiResponses({@ApiResponse(responseCode = "200", description = "Product page"),
        @ApiResponse(responseCode = "400", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "401", ref = PROBLEM_RESPONSE),
        @ApiResponse(responseCode = "403", ref = PROBLEM_RESPONSE)})
    MenuManagementService.ProductPage listProducts(
        @AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
        @RequestParam(defaultValue = "0") @PositiveOrZero int page,
        @RequestParam(defaultValue = "25") @Min(1) @Max(100) int size,
        @RequestParam(required = false) @Size(max = 160) String query,
        @RequestParam(defaultValue = "false") boolean includeArchived
    ) {
        return menus.list(subject(jwt), organizationId, page, size, query, includeArchived);
    }

    @PostMapping("/menu-products")
    @Operation(operationId = "createMenuProduct", summary = "Create a menu product")
    @ApiResponse(responseCode = "201", description = "Product created")
    ResponseEntity<MenuManagementService.ProductDetail> createProduct(
        @AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
        @Valid @RequestBody ProductRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(menus.create(subject(jwt), organizationId,
            request.toInput(0)));
    }

    @GetMapping("/menu-products/{productId}")
    @Operation(operationId = "getMenuProduct", summary = "Get a menu product workspace")
    @ApiResponse(responseCode = "200", description = "Product detail")
    MenuManagementService.ProductDetail product(
        @AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
        @PathVariable UUID productId
    ) {
        return menus.detail(subject(jwt), organizationId, productId);
    }

    @PutMapping("/menu-products/{productId}")
    @Operation(operationId = "updateMenuProduct", summary = "Update active product metadata")
    @ApiResponse(responseCode = "200", description = "Product updated")
    MenuManagementService.ProductDetail updateProduct(
        @AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
        @PathVariable UUID productId, @Valid @RequestBody UpdateProductRequest request
    ) {
        return menus.update(subject(jwt), organizationId, productId, request.toInput());
    }

    @PostMapping("/menu-products/{productId}/archive")
    @Operation(operationId = "archiveMenuProduct", summary = "Archive an unused menu product")
    @ApiResponse(responseCode = "200", description = "Product archived or already archived")
    MenuManagementService.ProductDetail archiveProduct(
        @AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
        @PathVariable UUID productId, @Valid @RequestBody VersionRequest request
    ) {
        return menus.archive(subject(jwt), organizationId, productId, request.version());
    }

    @PostMapping("/menu-products/{productId}/variants")
    @Operation(operationId = "createMenuVariant", summary = "Create a product variant")
    @ApiResponse(responseCode = "201", description = "Variant created")
    ResponseEntity<MenuManagementService.ProductDetail> createVariant(
        @AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
        @PathVariable UUID productId, @Valid @RequestBody CreateVariantRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(menus.createVariant(
            subject(jwt), organizationId, productId, request.toInput(0)));
    }

    @PutMapping("/menu-products/{productId}/variants/{variantId}")
    @Operation(operationId = "updateMenuVariant", summary = "Update an active product variant")
    @ApiResponse(responseCode = "200", description = "Variant updated")
    MenuManagementService.ProductDetail updateVariant(
        @AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
        @PathVariable UUID productId, @PathVariable UUID variantId,
        @Valid @RequestBody UpdateVariantRequest request
    ) {
        return menus.updateVariant(subject(jwt), organizationId, productId, variantId,
            request.toInput());
    }

    @PostMapping("/menu-products/{productId}/variants/{variantId}/archive")
    @Operation(operationId = "archiveMenuVariant", summary = "Archive an unused product variant")
    @ApiResponse(responseCode = "200", description = "Variant archived or already archived")
    MenuManagementService.ProductDetail archiveVariant(
        @AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
        @PathVariable UUID productId, @PathVariable UUID variantId,
        @Valid @RequestBody VersionRequest request
    ) {
        return menus.archiveVariant(subject(jwt), organizationId, productId, variantId,
            request.version());
    }

    @GetMapping("/locations/{locationId}/offerings")
    @Operation(operationId = "listMenuOfferings", summary = "List offerings at an assigned location")
    @ApiResponse(responseCode = "200", description = "Location offerings")
    List<MenuManagementService.Offering> listOfferings(
        @AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
        @PathVariable UUID locationId, @RequestParam(required = false) UUID variantId
    ) {
        return menus.listOfferings(subject(jwt), organizationId, locationId, variantId);
    }

    @PostMapping("/locations/{locationId}/offerings")
    @Operation(operationId = "createMenuOffering", summary = "Create a location offering")
    @ApiResponse(responseCode = "201", description = "Offering created")
    ResponseEntity<MenuManagementService.Offering> createOffering(
        @AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
        @PathVariable UUID locationId, @Valid @RequestBody CreateOfferingRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(menus.createOffering(
            subject(jwt), organizationId, locationId, new MenuManagementService.OfferingInput(
                request.variantId(), request.recipeVersionId(), request.priceMinor(), request.available())));
    }

    @PutMapping("/locations/{locationId}/offerings/{offeringId}")
    @Operation(operationId = "updateMenuOffering", summary = "Update a location offering")
    @ApiResponse(responseCode = "200", description = "Offering updated")
    MenuManagementService.Offering updateOffering(
        @AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
        @PathVariable UUID locationId, @PathVariable UUID offeringId,
        @Valid @RequestBody UpdateOfferingRequest request
    ) {
        return menus.updateOffering(subject(jwt), organizationId, locationId, offeringId,
            new MenuManagementService.OfferingUpdate(request.recipeVersionId(), request.priceMinor(),
                request.available(), request.version()));
    }

    private UUID subject(Jwt jwt) {
        try {
            return UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new StaffIdentityClaimsException();
        }
    }

    record ProductRequest(
        @NotBlank @Size(max = 120) @Pattern(regexp = KEBAB) String publicSlug,
        @NotBlank @Size(max = 160) String name,
        @Schema(nullable = true) @Size(max = 4000) String description,
        @Schema(nullable = true) @Size(max = 2048) String imageUrl,
        @Schema(nullable = true) @Size(max = 80) String category,
        @Schema(nullable = true) @Size(max = 40) @Pattern(regexp = KEBAB) String artworkKey,
        @PositiveOrZero int displayOrder
    ) {
        MenuManagementService.ProductInput toInput(long version) {
            return new MenuManagementService.ProductInput(publicSlug, name, description, imageUrl,
                category, artworkKey, displayOrder, version);
        }
    }

    record UpdateProductRequest(
        @NotBlank @Size(max = 120) @Pattern(regexp = KEBAB) String publicSlug,
        @NotBlank @Size(max = 160) String name,
        @Schema(nullable = true) @Size(max = 4000) String description,
        @Schema(nullable = true) @Size(max = 2048) String imageUrl,
        @Schema(nullable = true) @Size(max = 80) String category,
        @Schema(nullable = true) @Size(max = 40) @Pattern(regexp = KEBAB) String artworkKey,
        @PositiveOrZero int displayOrder,
        @NotNull @PositiveOrZero Long version
    ) {
        MenuManagementService.ProductInput toInput() {
            return new MenuManagementService.ProductInput(publicSlug, name, description, imageUrl,
                category, artworkKey, displayOrder, version);
        }
    }

    record CreateVariantRequest(
        @NotBlank @Size(max = 100) String name,
        @PositiveOrZero int displayOrder,
        boolean defaultVariant
    ) {
        MenuManagementService.VariantInput toInput(long version) {
            return new MenuManagementService.VariantInput(name, displayOrder, defaultVariant, version);
        }
    }

    record UpdateVariantRequest(
        @NotBlank @Size(max = 100) String name,
        @PositiveOrZero int displayOrder,
        boolean defaultVariant,
        @NotNull @PositiveOrZero Long version
    ) {
        MenuManagementService.VariantInput toInput() {
            return new MenuManagementService.VariantInput(name, displayOrder, defaultVariant, version);
        }
    }

    record CreateOfferingRequest(@NotNull UUID variantId, @NotNull UUID recipeVersionId,
                                 @PositiveOrZero long priceMinor, boolean available) { }
    record UpdateOfferingRequest(@NotNull UUID recipeVersionId, @PositiveOrZero long priceMinor,
                                 boolean available, @NotNull @PositiveOrZero Long version) { }
    record VersionRequest(@NotNull @PositiveOrZero Long version) { }

    @RestControllerAdvice(assignableTypes = MenuManagementController.class)
    static class MenuExceptionHandler {
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

        @ExceptionHandler({InvalidMenuException.class,
            org.springframework.web.bind.MethodArgumentNotValidException.class,
            jakarta.validation.ConstraintViolationException.class,
            HttpMessageNotReadableException.class})
        ResponseEntity<ProblemDetail> invalid() {
            return problem(HttpStatus.BAD_REQUEST, "MENU_INVALID", "Invalid menu");
        }

        @ExceptionHandler({DataIntegrityViolationException.class, MenuConflictException.class})
        ResponseEntity<ProblemDetail> conflict() {
            return problem(HttpStatus.CONFLICT, "MENU_CONFLICT", "Menu conflict");
        }

        @ExceptionHandler(MenuVersionConflictException.class)
        ResponseEntity<ProblemDetail> versionConflict() {
            return problem(HttpStatus.CONFLICT, "MENU_VERSION_CONFLICT", "Menu changed");
        }

        @ExceptionHandler(MenuStateConflictException.class)
        ResponseEntity<ProblemDetail> stateConflict() {
            return problem(HttpStatus.CONFLICT, "MENU_STATE_CONFLICT", "Menu state conflict");
        }

        @ExceptionHandler(MenuNotFoundException.class)
        ResponseEntity<ProblemDetail> notFound() {
            return problem(HttpStatus.NOT_FOUND, "MENU_NOT_FOUND", "Menu resource not found");
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
