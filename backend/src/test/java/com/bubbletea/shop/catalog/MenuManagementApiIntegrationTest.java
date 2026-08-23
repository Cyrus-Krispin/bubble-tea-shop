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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
class MenuManagementApiIntegrationTest {
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
    void managesProductsVariantsDefaultsConcurrencyAndAudit() throws Exception {
        Staff owner = staff("OWNER");
        JsonNode product = createProduct(owner, "classic-milk-tea", "Classic Milk Tea");
        UUID productId = UUID.fromString(product.get("id").asText());

        JsonNode withSmall = createVariant(owner, productId, "Small", true);
        UUID smallId = UUID.fromString(withSmall.get("variants").get(0).get("id").asText());
        JsonNode withLarge = createVariant(owner, productId, "Large", true);
        JsonNode small = find(withLarge.get("variants"), smallId);
        JsonNode large = withLarge.get("variants").findValue("defaultVariant").asBoolean()
            ? withLarge.get("variants").get(0) : withLarge.get("variants").get(1);

        assertThat(small.get("defaultVariant").asBoolean()).isFalse();
        assertThat(withLarge.get("variants").findValuesAsText("name")).contains("Small", "Large");
        assertThat(withLarge.get("variants").findValues("defaultVariant").stream()
            .filter(JsonNode::asBoolean).count()).isEqualTo(1);

        mvc.perform(put("/api/v1/staff/organizations/{organizationId}/menu-products/{productId}",
                owner.organizationId(), productId).with(token(owner)).contentType("application/json")
                .content("""
                    {"publicSlug":"classic-milk-tea","name":"Updated Milk Tea",
                     "description":null,"imageUrl":null,"category":"Milk tea",
                     "artworkKey":"moon","displayOrder":2,"version":0}
                    """))
            .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1));
        mvc.perform(put("/api/v1/staff/organizations/{organizationId}/menu-products/{productId}",
                owner.organizationId(), productId).with(token(owner)).contentType("application/json")
                .content("""
                    {"publicSlug":"classic-milk-tea","name":"Stale","description":null,
                     "imageUrl":null,"category":null,"artworkKey":null,"displayOrder":0,"version":0}
                    """))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MENU_VERSION_CONFLICT"));

        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/menu-products",
                owner.organizationId()).with(token(owner)).contentType("application/json")
                .content("""
                    {"publicSlug":"another-tea","name":"updated milk tea","description":null,
                     "imageUrl":null,"category":null,"artworkKey":null,"displayOrder":0}
                    """))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MENU_CONFLICT"));

        assertThat(jdbc.queryForObject("""
            SELECT count(*) FROM catalog_change
             WHERE actor_account_id = ? AND entity_type IN ('MENU_PRODUCT', 'MENU_VARIANT')
            """, Integer.class, owner.accountId())).isEqualTo(5);
        assertThat(large).isNotNull();
    }

    @Test
    void scopesOfferingsToAssignedLocationsAndDerivesCurrency() throws Exception {
        Staff manager = staff("MANAGER");
        UUID assigned = location(manager.organizationId(), "Assigned", "JPY");
        UUID unassigned = location(manager.organizationId(), "Unassigned", "USD");
        assign(manager, assigned);
        JsonNode product = createProduct(manager, "matcha", "Matcha");
        UUID productId = UUID.fromString(product.get("id").asText());
        JsonNode detail = createVariant(manager, productId, "Regular", true);
        UUID variantId = UUID.fromString(detail.get("variants").get(0).get("id").asText());
        UUID recipeVersionId = publishedRecipe(manager.organizationId());

        MvcResult created = mvc.perform(post(
                "/api/v1/staff/organizations/{organizationId}/locations/{locationId}/offerings",
                manager.organizationId(), assigned).with(token(manager)).contentType("application/json")
                .content("""
                    {"variantId":"%s","recipeVersionId":"%s","priceMinor":720,"available":true}
                    """.formatted(variantId, recipeVersionId)))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.currencyCode").value("JPY"))
            .andExpect(jsonPath("$.version").value(0)).andReturn();
        UUID offeringId = UUID.fromString(json.readTree(created.getResponse().getContentAsByteArray())
            .get("id").asText());

        mvc.perform(get("/api/v1/staff/organizations/{organizationId}/locations/{locationId}/offerings",
                manager.organizationId(), unassigned).with(token(manager)))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/menu-products/{productId}/archive",
                manager.organizationId(), productId).with(token(manager)).contentType("application/json")
                .content("{\"version\":0}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MENU_STATE_CONFLICT"));

        mvc.perform(put(
                "/api/v1/staff/organizations/{organizationId}/locations/{locationId}/offerings/{offeringId}",
                manager.organizationId(), assigned, offeringId).with(token(manager))
                .contentType("application/json")
                .content("""
                    {"recipeVersionId":"%s","priceMinor":750,"available":false,"version":0}
                    """.formatted(recipeVersionId)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.available").value(false))
            .andExpect(jsonPath("$.priceMinor").value(750));
        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/menu-products/{productId}/archive",
                manager.organizationId(), productId).with(token(manager)).contentType("application/json")
                .content("{\"version\":0}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.archived").value(true));
    }

    @Test
    void rejectsInvalidAndCrossOrganizationOfferingReferences() throws Exception {
        Staff owner = staff("OWNER");
        UUID location = location(owner.organizationId(), "Shop", "SGD");
        JsonNode product = createProduct(owner, "oolong", "Oolong");
        UUID productId = UUID.fromString(product.get("id").asText());
        UUID variantId = UUID.fromString(createVariant(owner, productId, "Cup", true)
            .get("variants").get(0).get("id").asText());
        UUID foreignVersion = publishedRecipe(staff("OWNER").organizationId());

        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/locations/{locationId}/offerings",
                owner.organizationId(), location).with(token(owner)).contentType("application/json")
                .content("""
                    {"variantId":"%s","recipeVersionId":"%s","priceMinor":500,"available":true}
                    """.formatted(variantId, foreignVersion)))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MENU_INVALID"));

        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/menu-products",
                owner.organizationId()).with(token(owner)).contentType("application/json")
                .content("""
                    {"publicSlug":"bad-image","name":"Bad image","description":null,
                     "imageUrl":"http://example.test/image.png","category":null,
                     "artworkKey":null,"displayOrder":0}
                    """))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MENU_INVALID"));
    }

    private JsonNode createProduct(Staff staff, String slug, String name) throws Exception {
        MvcResult result = mvc.perform(post("/api/v1/staff/organizations/{organizationId}/menu-products",
                staff.organizationId()).with(token(staff)).contentType("application/json")
                .content("""
                    {"publicSlug":"%s","name":"%s","description":null,"imageUrl":null,
                     "category":null,"artworkKey":null,"displayOrder":0}
                    """.formatted(slug, name)))
            .andExpect(status().isCreated()).andReturn();
        return json.readTree(result.getResponse().getContentAsByteArray());
    }

    private JsonNode createVariant(Staff staff, UUID productId, String name,
                                   boolean defaultVariant) throws Exception {
        MvcResult result = mvc.perform(post(
                "/api/v1/staff/organizations/{organizationId}/menu-products/{productId}/variants",
                staff.organizationId(), productId).with(token(staff)).contentType("application/json")
                .content("""
                    {"name":"%s","displayOrder":0,"defaultVariant":%s}
                    """.formatted(name, defaultVariant)))
            .andExpect(status().isCreated()).andReturn();
        return json.readTree(result.getResponse().getContentAsByteArray());
    }

    private JsonNode find(JsonNode items, UUID id) {
        for (JsonNode item : items) if (item.get("id").asText().equals(id.toString())) return item;
        throw new AssertionError("Missing item " + id);
    }

    private Staff staff(String role) {
        UUID subject = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        UUID organizationId = UUID.randomUUID();
        jdbc.update("INSERT INTO account (id, auth_subject, enabled) VALUES (?, ?, true)", accountId, subject);
        jdbc.update("INSERT INTO organization (id, name) VALUES (?, ?)", organizationId,
            "Menu Test " + organizationId);
        jdbc.update("""
            INSERT INTO organization_membership (organization_id, account_id, role, active)
            VALUES (?, ?, ?, true)
            """, organizationId, accountId, role);
        return new Staff(subject, accountId, organizationId);
    }

    private UUID location(UUID organizationId, String name, String currency) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO location (id, organization_id, name, timezone, currency_code)
            VALUES (?, ?, ?, 'Asia/Singapore', ?)
            """, id, organizationId, name + id, currency);
        return id;
    }

    private void assign(Staff staff, UUID locationId) {
        UUID membershipId = jdbc.queryForObject("""
            SELECT id FROM organization_membership WHERE organization_id = ? AND account_id = ?
            """, UUID.class, staff.organizationId(), staff.accountId());
        jdbc.update("""
            INSERT INTO location_assignment (organization_id, membership_id, location_id)
            VALUES (?, ?, ?)
            """, staff.organizationId(), membershipId, locationId);
    }

    private UUID publishedRecipe(UUID organizationId) {
        UUID recipeId = UUID.randomUUID();
        UUID versionId = UUID.randomUUID();
        jdbc.update("INSERT INTO recipe (id, organization_id, name) VALUES (?, ?, ?)",
            recipeId, organizationId, "Menu Recipe " + recipeId);
        jdbc.update("""
            INSERT INTO recipe_version (
                id, organization_id, recipe_id, version_number, status, published_at
            ) VALUES (?, ?, ?, 1, 'PUBLISHED', now())
            """, versionId, organizationId, recipeId);
        return versionId;
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor token(Staff staff) {
        return jwt().jwt(value -> value.subject(staff.authSubject().toString()));
    }

    private record Staff(UUID authSubject, UUID accountId, UUID organizationId) { }
}
