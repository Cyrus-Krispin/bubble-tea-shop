package com.bubbletea.shop.catalog;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;

@RestController
@RequestMapping("/api/v1/guest/locations/{locationSlug}/menu")
public class GuestCatalogController {
    private final GuestCatalogService catalog;

    public GuestCatalogController(GuestCatalogService catalog) {
        this.catalog = catalog;
    }

    @GetMapping
    GuestCatalogDto.Menu menu(@PathVariable String locationSlug) {
        return catalog.loadMenu(locationSlug);
    }

    @GetMapping("/products/{productSlug}")
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
