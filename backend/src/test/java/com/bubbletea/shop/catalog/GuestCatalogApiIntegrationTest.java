package com.bubbletea.shop.catalog;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
class GuestCatalogApiIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>("postgres:18.4-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    MockMvc mvc;

    @Test
    void menuIsPublicAndReturnsDatabaseBackedProductSummaries() throws Exception {
        mvc.perform(get("/api/v1/guest/locations/orchard-central/menu"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.location.slug").value("orchard-central"))
            .andExpect(jsonPath("$.location.name").value("Orchard Central"))
            .andExpect(jsonPath("$.location.currency").value("SGD"))
            .andExpect(jsonPath("$.products.length()").value(4))
            .andExpect(jsonPath("$.products[0].slug").value("moonlit-milk-tea"))
            .andExpect(jsonPath("$.products[0].startingPrice.amountMinor").value(610))
            .andExpect(jsonPath("$.products[0].startingPrice.currency").value("SGD"))
            .andExpect(jsonPath("$.products[0].available").value(true))
            .andExpect(jsonPath("$.products[3].slug").value("cloudberry-taro"))
            .andExpect(jsonPath("$.products[3].available").value(false));
    }

    @Test
    void productDetailReturnsVariantsAndTheirEnabledOptions() throws Exception {
        mvc.perform(get("/api/v1/guest/locations/orchard-central/menu/products/moonlit-milk-tea"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.slug").value("moonlit-milk-tea"))
            .andExpect(jsonPath("$.variants.length()").value(3))
            .andExpect(jsonPath("$.variants[0].name").value("Small"))
            .andExpect(jsonPath("$.variants[0].price.amountMinor").value(610))
            .andExpect(jsonPath("$.variants[1].name").value("Medium"))
            .andExpect(jsonPath("$.variants[1].isDefault").value(true))
            .andExpect(jsonPath("$.variants[1].optionGroups.length()").value(3))
            .andExpect(jsonPath("$.variants[1].optionGroups[0].name").value("Sweetness"))
            .andExpect(jsonPath("$.variants[1].optionGroups[0].choices.length()").value(5))
            .andExpect(jsonPath("$.variants[1].optionGroups[2].name").value("Toppings"))
            .andExpect(jsonPath("$.variants[1].optionGroups[2].choices[0].priceDelta.amountMinor").value(60));
    }

    @Test
    void missingLocationAndProductReturnProblemDetails() throws Exception {
        mvc.perform(get("/api/v1/guest/locations/not-a-shop/menu"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.status").value(404))
            .andExpect(jsonPath("$.code").value("CATALOG_NOT_FOUND"));

        mvc.perform(get("/api/v1/guest/locations/orchard-central/menu/products/not-a-drink"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.status").value(404))
            .andExpect(jsonPath("$.code").value("CATALOG_PRODUCT_NOT_FOUND"));
    }

    @Test
    void protectedApiRemainsClosedWithoutAuthentication() throws Exception {
        mvc.perform(get("/api/v1/staff/example"))
            .andExpect(status().isForbidden());
    }
}
