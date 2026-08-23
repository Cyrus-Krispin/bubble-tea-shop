package com.bubbletea.shop.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Testcontainers
@SpringBootTest(properties = {
    "app.security.supabase.enabled=true",
    "app.security.supabase.issuer=http://localhost:8000/auth/v1",
    "app.security.supabase.jwk-set-uri=http://localhost:8000/auth/v1/.well-known/jwks.json"
})
@AutoConfigureMockMvc
class OptionManagementApiIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:18.4-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean JwtDecoder jwtDecoder;
    private final ObjectMapper json = new ObjectMapper();

    @Test
    void managesGroupsChoicesDefaultsConcurrencyAndNormalizedNames() throws Exception {
        Staff owner = owner();
        JsonNode group = createGroup(owner, "Sweetness", 1, 1);
        UUID groupId = UUID.fromString(group.get("id").asText());
        JsonNode first = createChoice(owner, groupId, "50%", true);
        UUID firstId = UUID.fromString(first.get("choices").get(0).get("id").asText());
        JsonNode second = createChoice(owner, groupId, "100%", true);

        assertThat(second.get("choices").findValues("defaultChoice").stream()
            .filter(JsonNode::asBoolean).count()).isEqualTo(1);
        JsonNode oldDefault = find(second.get("choices"), firstId);
        assertThat(oldDefault.get("defaultChoice").asBoolean()).isFalse();
        assertThat(oldDefault.get("version").asLong()).isEqualTo(1);

        mvc.perform(put("/api/v1/staff/organizations/{organizationId}/option-groups/{groupId}",
                owner.organizationId(), groupId).with(token(owner)).contentType("application/json")
                .content("""
                    {"name":"Sugar level","minimumSelections":1,"maximumSelections":1,
                     "displayOrder":2,"version":0}
                    """))
            .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1));
        mvc.perform(put("/api/v1/staff/organizations/{organizationId}/option-groups/{groupId}",
                owner.organizationId(), groupId).with(token(owner)).contentType("application/json")
                .content("""
                    {"name":"Stale","minimumSelections":0,"maximumSelections":1,
                     "displayOrder":0,"version":0}
                    """))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("OPTION_VERSION_CONFLICT"));
        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/option-groups",
                owner.organizationId()).with(token(owner)).contentType("application/json")
                .content("""
                    {"name":"sugar level","minimumSelections":0,"maximumSelections":1,
                     "displayOrder":0}
                    """))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("OPTION_CONFLICT"));
    }

    @Test
    void atomicallyReplacesVariantChoiceEffectsAndAttributesAudit() throws Exception {
        Staff owner = owner();
        Catalog catalog = catalog(owner.organizationId(), false);
        UUID ingredient = ingredient(owner.organizationId(), "Pearls");
        JsonNode group = createGroup(owner, "Toppings", 0, 3);
        UUID groupId = UUID.fromString(group.get("id").asText());
        JsonNode choices = createChoice(owner, groupId, "Pearls", false);
        UUID choiceId = UUID.fromString(choices.get("choices").get(0).get("id").asText());

        MvcResult created = mvc.perform(put(
                "/api/v1/staff/organizations/{organizationId}/menu-products/{productId}/variants/{variantId}/choices/{choiceId}",
                owner.organizationId(), catalog.productId(), catalog.variantId(), choiceId)
                .with(token(owner)).contentType("application/json")
                .content("""
                    {"enabled":true,"priceDeltaMinor":80,"version":null,
                     "ingredientEffects":[{"ingredientId":"%s","quantityDelta":"12.500000"}]}
                    """.formatted(ingredient)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(0))
            .andExpect(jsonPath("$.ingredientEffects[0].quantityDelta").value("12.500000"))
            .andReturn();
        UUID linkId = UUID.fromString(json.readTree(created.getResponse().getContentAsByteArray())
            .get("id").asText());

        mvc.perform(put(
                "/api/v1/staff/organizations/{organizationId}/menu-products/{productId}/variants/{variantId}/choices/{choiceId}",
                owner.organizationId(), catalog.productId(), catalog.variantId(), choiceId)
                .with(token(owner)).contentType("application/json")
                .content("""
                    {"enabled":false,"priceDeltaMinor":50,"version":0,"ingredientEffects":[]}
                    """))
            .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1))
            .andExpect(jsonPath("$.ingredientEffects.length()").value(0));

        assertThat(jdbc.queryForObject("""
            SELECT count(*) FROM option_choice_ingredient_effect
             WHERE menu_variant_option_choice_id = ?
            """, Integer.class, linkId)).isZero();
        assertThat(jdbc.queryForObject("""
            SELECT count(*) FROM catalog_change
             WHERE entity_id = ? AND actor_account_id = ? AND action = 'CONFIGURE'
            """, Integer.class, linkId, owner.accountId())).isEqualTo(2);
    }

    @Test
    void protectsAvailableOfferingsFromInvalidConfigurationAndArchival() throws Exception {
        Staff owner = owner();
        Catalog catalog = catalog(owner.organizationId(), false);
        JsonNode group = createGroup(owner, "Ice", 2, 2);
        UUID groupId = UUID.fromString(group.get("id").asText());
        JsonNode choices = createChoice(owner, groupId, "Regular ice", true);
        UUID choiceId = UUID.fromString(choices.get("choices").get(0).get("id").asText());
        JsonNode withSecondChoice = createChoice(owner, groupId, "Less ice", false);
        UUID secondChoiceId = withSecondChoice.get("choices").findValues("id").stream()
            .map(JsonNode::asText).filter(id -> !id.equals(choiceId.toString()))
            .map(UUID::fromString).findFirst().orElseThrow();
        mvc.perform(put(
                "/api/v1/staff/organizations/{organizationId}/menu-products/{productId}/variants/{variantId}/choices/{choiceId}",
                owner.organizationId(), catalog.productId(), catalog.variantId(), choiceId)
                .with(token(owner)).contentType("application/json")
                .content("""
                    {"enabled":true,"priceDeltaMinor":0,"version":null,"ingredientEffects":[]}
                    """))
            .andExpect(status().isOk());
        mvc.perform(put(
                "/api/v1/staff/organizations/{organizationId}/menu-products/{productId}/variants/{variantId}/choices/{choiceId}",
                owner.organizationId(), catalog.productId(), catalog.variantId(), secondChoiceId)
                .with(token(owner)).contentType("application/json")
                .content("""
                    {"enabled":true,"priceDeltaMinor":0,"version":null,"ingredientEffects":[]}
                    """))
            .andExpect(status().isOk());
        makeAvailable(catalog);

        mvc.perform(put(
                "/api/v1/staff/organizations/{organizationId}/menu-products/{productId}/variants/{variantId}/choices/{choiceId}",
                owner.organizationId(), catalog.productId(), catalog.variantId(), secondChoiceId)
                .with(token(owner)).contentType("application/json")
                .content("""
                    {"enabled":false,"priceDeltaMinor":0,"version":0,"ingredientEffects":[]}
                    """))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("OPTION_STATE_CONFLICT"));
        mvc.perform(post(
                "/api/v1/staff/organizations/{organizationId}/option-groups/{groupId}/choices/{choiceId}/archive",
                owner.organizationId(), groupId, choiceId).with(token(owner))
                .contentType("application/json").content("{\"version\":0}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("OPTION_STATE_CONFLICT"));
    }

    @Test
    void rejectsDuplicateCrossOrganizationAndZeroIngredientEffects() throws Exception {
        Staff owner = owner();
        Catalog catalog = catalog(owner.organizationId(), false);
        JsonNode group = createGroup(owner, "Milk", 0, 1);
        UUID groupId = UUID.fromString(group.get("id").asText());
        JsonNode choices = createChoice(owner, groupId, "Oat", false);
        UUID choiceId = UUID.fromString(choices.get("choices").get(0).get("id").asText());
        UUID foreignIngredient = ingredient(owner().organizationId(), "Foreign Milk");

        mvc.perform(put(
                "/api/v1/staff/organizations/{organizationId}/menu-products/{productId}/variants/{variantId}/choices/{choiceId}",
                owner.organizationId(), catalog.productId(), catalog.variantId(), choiceId)
                .with(token(owner)).contentType("application/json")
                .content("""
                    {"enabled":true,"priceDeltaMinor":0,"version":null,
                     "ingredientEffects":[{"ingredientId":"%s","quantityDelta":"1.000000"}]}
                    """.formatted(foreignIngredient)))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("OPTION_INVALID"));
        UUID localIngredient = ingredient(owner.organizationId(), "Local Milk");
        mvc.perform(put(
                "/api/v1/staff/organizations/{organizationId}/menu-products/{productId}/variants/{variantId}/choices/{choiceId}",
                owner.organizationId(), catalog.productId(), catalog.variantId(), choiceId)
                .with(token(owner)).contentType("application/json")
                .content("""
                    {"enabled":true,"priceDeltaMinor":0,"version":null,
                     "ingredientEffects":[{"ingredientId":"%s","quantityDelta":"0.000000"}]}
                    """.formatted(localIngredient)))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("OPTION_INVALID"));
    }

    private JsonNode createGroup(Staff staff, String name, int minimum, int maximum) throws Exception {
        MvcResult result = mvc.perform(post("/api/v1/staff/organizations/{organizationId}/option-groups",
                staff.organizationId()).with(token(staff)).contentType("application/json")
                .content("""
                    {"name":"%s","minimumSelections":%d,"maximumSelections":%d,"displayOrder":0}
                    """.formatted(name, minimum, maximum)))
            .andExpect(status().isCreated()).andReturn();
        return json.readTree(result.getResponse().getContentAsByteArray());
    }

    private JsonNode createChoice(Staff staff, UUID groupId, String name,
                                  boolean defaultChoice) throws Exception {
        MvcResult result = mvc.perform(post(
                "/api/v1/staff/organizations/{organizationId}/option-groups/{groupId}/choices",
                staff.organizationId(), groupId).with(token(staff)).contentType("application/json")
                .content("""
                    {"name":"%s","displayOrder":0,"defaultChoice":%s}
                    """.formatted(name, defaultChoice)))
            .andExpect(status().isCreated()).andReturn();
        return json.readTree(result.getResponse().getContentAsByteArray());
    }

    private Catalog catalog(UUID organizationId, boolean available) {
        UUID locationId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        UUID variantId = UUID.randomUUID();
        UUID recipeId = UUID.randomUUID();
        UUID versionId = UUID.randomUUID();
        UUID offeringId = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO location (id, organization_id, name, timezone, currency_code)
            VALUES (?, ?, ?, 'Asia/Singapore', 'SGD')
            """, locationId, organizationId, "Option Shop " + locationId);
        jdbc.update("INSERT INTO menu_product (id, organization_id, public_slug, name) VALUES (?, ?, ?, ?)",
            productId, organizationId, "product-" + productId, "Product " + productId);
        jdbc.update("""
            INSERT INTO menu_variant (id, organization_id, menu_product_id, name, is_default)
            VALUES (?, ?, ?, 'Regular', true)
            """, variantId, organizationId, productId);
        jdbc.update("INSERT INTO recipe (id, organization_id, name) VALUES (?, ?, ?)",
            recipeId, organizationId, "Recipe " + recipeId);
        jdbc.update("""
            INSERT INTO recipe_version (
                id, organization_id, recipe_id, version_number, status, published_at
            ) VALUES (?, ?, ?, 1, 'PUBLISHED', now())
            """, versionId, organizationId, recipeId);
        jdbc.update("""
            INSERT INTO menu_variant_offering (
                id, organization_id, location_id, menu_variant_id, recipe_version_id,
                price_minor, currency_code, available
            ) VALUES (?, ?, ?, ?, ?, 500, 'SGD', ?)
            """, offeringId, organizationId, locationId, variantId, versionId, available);
        return new Catalog(productId, variantId, offeringId);
    }

    private void makeAvailable(Catalog catalog) {
        jdbc.update("UPDATE menu_variant_offering SET available = true WHERE id = ?", catalog.offeringId());
    }

    private UUID ingredient(UUID organizationId, String name) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO ingredient (id, organization_id, name, base_unit)
            VALUES (?, ?, ?, 'GRAM')
            """, id, organizationId, name + id);
        return id;
    }

    private Staff owner() {
        UUID subject = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        UUID organizationId = UUID.randomUUID();
        jdbc.update("INSERT INTO account (id, auth_subject, enabled) VALUES (?, ?, true)", accountId, subject);
        jdbc.update("INSERT INTO organization (id, name) VALUES (?, ?)", organizationId,
            "Option Test " + organizationId);
        jdbc.update("""
            INSERT INTO organization_membership (organization_id, account_id, role, active)
            VALUES (?, ?, 'OWNER', true)
            """, organizationId, accountId);
        return new Staff(subject, accountId, organizationId);
    }

    private JsonNode find(JsonNode items, UUID id) {
        for (JsonNode item : items) if (item.get("id").asText().equals(id.toString())) return item;
        throw new AssertionError("Missing item " + id);
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor token(Staff staff) {
        return jwt().jwt(value -> value.subject(staff.authSubject().toString()));
    }

    private record Staff(UUID authSubject, UUID accountId, UUID organizationId) { }
    private record Catalog(UUID productId, UUID variantId, UUID offeringId) { }
}
