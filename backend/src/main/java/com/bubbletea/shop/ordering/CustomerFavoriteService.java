package com.bubbletea.shop.ordering;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

@Service
public class CustomerFavoriteService {
    private static final String AVAILABLE = """
        SELECT DISTINCT r.id, r.name FROM recipe r
        JOIN recipe_version rv ON rv.recipe_id = r.id AND rv.organization_id = r.organization_id
        JOIN menu_variant_offering o ON o.recipe_version_id = rv.id AND o.organization_id = rv.organization_id
        JOIN menu_variant v ON v.id = o.menu_variant_id
        JOIN menu_product p ON p.id = v.menu_product_id
        WHERE r.organization_id = :org AND o.location_id = :loc AND o.available AND variant_currency_ready(v.id, o.currency_code)
          AND r.archived_at IS NULL AND rv.status = 'PUBLISHED' AND v.archived_at IS NULL AND p.archived_at IS NULL
        """;
    private final JdbcClient jdbc;
    CustomerFavoriteService(JdbcClient jdbc) { this.jdbc = jdbc; }
    @Transactional(readOnly = true)
    public FavoriteState get(UUID subject, String slug) { return state(scope(subject, slug)); }
    @Transactional
    public FavoriteState set(UUID subject, String slug, UUID recipeId) {
        Scope scope = scope(subject, slug);
        if (recipeId == null || jdbc.sql("SELECT count(*) FROM (" + AVAILABLE + " AND r.id = :recipe) candidates")
            .param("org", scope.org()).param("loc", scope.loc()).param("recipe", recipeId).query(Long.class).single() == 0)
            throw new FavoriteUnavailableException();
        jdbc.sql("""
            INSERT INTO customer_favorite (account_id, organization_id, recipe_id) VALUES (:account, :org, :recipe)
            ON CONFLICT (account_id, organization_id) DO UPDATE SET recipe_id = excluded.recipe_id, updated_at = now()
            """).param("account", scope.account()).param("org", scope.org()).param("recipe", recipeId).update();
        return state(scope);
    }
    @Transactional
    public FavoriteState clear(UUID subject, String slug) {
        Scope scope = scope(subject, slug);
        jdbc.sql("DELETE FROM customer_favorite WHERE account_id = :account AND organization_id = :org")
            .param("account", scope.account()).param("org", scope.org()).update();
        return state(scope);
    }
    private Scope scope(UUID subject, String slug) {
        UUID account = jdbc.sql("SELECT id FROM account WHERE auth_subject = :subject AND enabled")
            .param("subject", subject).query(UUID.class).optional().orElseThrow(CustomerAccountDisabledException::new);
        return jdbc.sql("SELECT id, organization_id FROM location WHERE public_slug = :slug AND active")
            .param("slug", slug).query((rs, row) -> new Scope(account, rs.getObject("organization_id", UUID.class), rs.getObject("id", UUID.class)))
            .optional().orElseThrow(FavoriteUnavailableException::new);
    }
    private FavoriteState state(Scope scope) {
        var selected = jdbc.sql("""
            SELECT r.id, r.name FROM customer_favorite f JOIN recipe r ON r.id = f.recipe_id
            WHERE f.account_id = :account AND f.organization_id = :org
            """).param("account", scope.account()).param("org", scope.org())
            .query((rs, row) -> new FavoriteRecipe(rs.getObject("id", UUID.class), rs.getString("name"))).optional();
        var recipes = jdbc.sql(AVAILABLE + " ORDER BY r.name, r.id LIMIT 250").param("org", scope.org()).param("loc", scope.loc())
            .query((rs, row) -> new FavoriteRecipe(rs.getObject("id", UUID.class), rs.getString("name"))).list();
        return new FavoriteState(selected.map(FavoriteRecipe::id).orElse(null), selected.map(FavoriteRecipe::name).orElse(null),
            recipes, 5);
    }
    private record Scope(UUID account, UUID org, UUID loc) {}
    @Schema(name = "FavoriteRecipe") public record FavoriteRecipe(UUID id, String name) {}
    @Schema(name = "CustomerFavorite") public record FavoriteState(
        @Schema(nullable = true) UUID recipeId, @Schema(nullable = true) String recipeName,
        List<FavoriteRecipe> recipes, int discountPercent) {}
}
class FavoriteUnavailableException extends RuntimeException {}
