package com.bubbletea.shop;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.skyscreamer.jsonassert.JSONAssert;
import org.skyscreamer.jsonassert.JSONCompareMode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Testcontainers
@SpringBootTest(properties = "springdoc.api-docs.enabled=true")
@AutoConfigureMockMvc
class OpenApiContractIntegrationTest {
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
    void generatesTheImplementedSpringApiContract() throws Exception {
        MvcResult result = mvc.perform(get("/v3/api-docs"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.openapi").value("3.1.0"))
            .andExpect(jsonPath("$.paths['/api/v1/customer/account'].post").exists())
            .andExpect(jsonPath("$.paths['/api/v1/staff/context'].get").exists())
            .andExpect(jsonPath("$.paths['/api/v1/guest/menu'].get").exists())
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/ingredients'].get.operationId")
                .value("listIngredients"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/ingredients'].post.operationId")
                .value("createIngredient"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/ingredients/{ingredientId}'].put.operationId")
                .value("updateIngredient"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/ingredients/{ingredientId}/archive'].post.operationId")
                .value("archiveIngredient"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/recipes'].get.operationId")
                .value("listRecipes"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/recipes'].post.operationId")
                .value("createRecipe"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}'].get.operationId")
                .value("getRecipe"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}'].put.operationId")
                .value("updateRecipe"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/archive'].post.operationId")
                .value("archiveRecipe"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions'].post.operationId")
                .value("createRecipeVersion"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/draft'].put.operationId")
                .value("replaceRecipeDraft"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/publish'].post.operationId")
                .value("publishRecipeVersion"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/retire'].post.operationId")
                .value("retireRecipeVersion"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/menu-products'].get.operationId")
                .value("listMenuProducts"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/menu-products'].post.operationId")
                .value("createMenuProduct"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/menu-products'].post.responses['201']")
                .exists())
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/menu-products/{productId}'].get.operationId")
                .value("getMenuProduct"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/menu-products/{productId}/variants'].post.operationId")
                .value("createMenuVariant"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/locations/{locationId}/offerings'].post.operationId")
                .value("createMenuOffering"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/locations/{locationId}/offerings/{offeringId}'].put.operationId")
                .value("updateMenuOffering"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/option-groups'].get.operationId")
                .value("listOptionGroups"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/option-groups'].post.operationId")
                .value("createOptionGroup"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/option-groups/{groupId}/choices'].post.operationId")
                .value("createOptionChoice"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/menu-products/{productId}/variants/{variantId}/choices/{choiceId}'].put.operationId")
                .value("configureVariantOptionChoice"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/menu-products/{productId}/variants/{variantId}/choices/{choiceId}'].put.responses['409']['$ref']")
                .value("#/components/responses/Problem"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/recipes'].get.security[0].bearerAuth")
                .isArray())
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}'].put.responses['409']")
                .exists())
            .andExpect(jsonPath("$.paths['/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}'].put.responses['409']['$ref']")
                .value("#/components/responses/Problem"))
            .andExpect(jsonPath("$.components.responses.Problem.content['application/problem+json'].schema['$ref']")
                .value("#/components/schemas/ProblemDetail"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/context'].get.operationId")
                .value("getStaffContext"))
            .andExpect(jsonPath("$.paths['/api/v1/staff/context'].get.security[0].bearerAuth")
                .isArray())
            .andExpect(jsonPath("$.paths['/api/v1/staff/context'].get.responses['403']")
                .exists())
            .andExpect(jsonPath("$.paths['/api/v1/staff/context'].get.responses['200'].content['application/json']")
                .exists())
            .andExpect(jsonPath("$.paths['/api/v1/guest/menu'].get.operationId")
                .value("getCurrentGuestMenu"))
            .andExpect(jsonPath("$.paths['/actuator/health']").doesNotExist())
            .andReturn();

        String actual = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        Path snapshot = Path.of("..", "docs", "api", "openapi.json").toAbsolutePath().normalize();
        if (Boolean.getBoolean("openapi.update")) {
            String formatted = new ObjectMapper()
                .writerWithDefaultPrettyPrinter()
                .writeValueAsString(new ObjectMapper().readTree(actual));
            Files.writeString(snapshot, formatted + System.lineSeparator(), StandardCharsets.UTF_8);
        }

        String expected = Files.readString(snapshot, StandardCharsets.UTF_8);
        JSONAssert.assertEquals(expected, actual, JSONCompareMode.STRICT);
    }
}
