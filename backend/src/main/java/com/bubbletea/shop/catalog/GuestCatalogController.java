package com.bubbletea.shop.catalog;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;

@RestController
@RequestMapping("/api/v1/guest")
@EnableConfigurationProperties(GuestCatalogProperties.class)
@Tag(name = "Guest catalog")
public class GuestCatalogController {
    private final GuestCatalogService catalog;
    private final GuestCatalogProperties properties;

    public GuestCatalogController(
        GuestCatalogService catalog,
        GuestCatalogProperties properties
    ) {
        this.catalog = catalog;
        this.properties = properties;
    }

    @GetMapping("/menu")
    @Operation(operationId = "getCurrentGuestMenu", summary = "Load the configured guest menu")
    @ApiResponses({
        @ApiResponse(
            responseCode = "200",
            description = "Current guest menu",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = GuestCatalogDto.Menu.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Configured catalog resource unavailable",
            content = @Content(
                mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class)))
    })
    GuestCatalogDto.Menu currentMenu() {
        return catalog.loadMenu(properties.guestLocationSlug());
    }

    @GetMapping("/menu/products/{productSlug}")
    @Operation(
        operationId = "getCurrentGuestProduct",
        summary = "Load a product from the configured guest menu")
    @ApiResponses({
        @ApiResponse(
            responseCode = "200",
            description = "Guest product configuration",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = GuestCatalogDto.Product.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Catalog product unavailable",
            content = @Content(
                mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class)))
    })
    GuestCatalogDto.Product currentProduct(@PathVariable String productSlug) {
        return catalog.loadProduct(properties.guestLocationSlug(), productSlug);
    }

    @GetMapping("/locations/{locationSlug}/menu")
    @Operation(operationId = "getGuestLocationMenu", summary = "Load a guest menu by location")
    @ApiResponses({
        @ApiResponse(
            responseCode = "200",
            description = "Guest location menu",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = GuestCatalogDto.Menu.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Catalog location unavailable",
            content = @Content(
                mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class)))
    })
    GuestCatalogDto.Menu menu(@PathVariable String locationSlug) {
        return catalog.loadMenu(locationSlug);
    }

    @GetMapping("/locations/{locationSlug}/menu/products/{productSlug}")
    @Operation(
        operationId = "getGuestLocationProduct",
        summary = "Load a guest product by location")
    @ApiResponses({
        @ApiResponse(
            responseCode = "200",
            description = "Guest product configuration",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = GuestCatalogDto.Product.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Catalog product unavailable",
            content = @Content(
                mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class)))
    })
    GuestCatalogDto.Product product(
        @PathVariable String locationSlug,
        @PathVariable String productSlug
    ) {
        return catalog.loadProduct(locationSlug, productSlug);
    }

    @RestControllerAdvice(assignableTypes = GuestCatalogController.class)
    static class GuestCatalogExceptionHandler {
        @ExceptionHandler(GuestCatalogNotFoundException.class)
        @ResponseStatus(HttpStatus.NOT_FOUND)
        ProblemDetail notFound(GuestCatalogNotFoundException exception) {
            ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.NOT_FOUND,
                exception.getMessage());
            problem.setType(URI.create("https://bubble-tea.example/problems/catalog-not-found"));
            problem.setTitle("Catalog resource not found");
            problem.setProperty("code", exception.code());
            return problem;
        }
    }
}
