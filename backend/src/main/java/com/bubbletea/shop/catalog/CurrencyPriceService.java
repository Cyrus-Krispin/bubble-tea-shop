package com.bubbletea.shop.catalog;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class CurrencyPriceService {
    private final JdbcClient jdbc;
    private final CatalogStaffAccessService access;
    CurrencyPriceService(JdbcClient jdbc, CatalogStaffAccessService access) { this.jdbc = jdbc; this.access = access; }
    private void currency(String value) { if (!Set.of("SGD", "MYR", "CNY").contains(value)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported currency"); }
    @Transactional(readOnly = true)
    public PriceSet get(UUID subject, UUID org, UUID variant, String currency) {
        access.authorize(subject, org); currency(currency);
        long version = version(org, variant, false);
        return read(org, variant, currency, version);
    }
    @Transactional
    public PriceSet set(UUID subject, UUID org, UUID variant, String currency, long expectedVersion, List<PriceInput> prices) {
        var actor = access.authorize(subject, org); currency(currency);
        long version = version(org, variant, true);
        if (version != expectedVersion) throw new ResponseStatusException(HttpStatus.CONFLICT, "Variant changed; reload prices");
        PriceSet current = read(org, variant, currency, version);
        Set<UUID> expected = current.choices().stream().map(ChoicePrice::linkId).collect(Collectors.toSet());
        if (prices == null || prices.size() != expected.size() || prices.stream().anyMatch(p -> p == null || p.linkId() == null || p.priceDeltaMinor() == null || p.priceDeltaMinor() < -100000000L || p.priceDeltaMinor() > 100000000L)
            || !prices.stream().map(PriceInput::linkId).collect(Collectors.toSet()).equals(expected)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Provide every enabled choice once");
        for (PriceInput price : prices) {
            if (currency.equals("SGD")) jdbc.sql("UPDATE menu_variant_option_choice SET price_delta_minor = :price, version = version + 1, updated_at = now() WHERE id = :id AND organization_id = :org")
                .param("price", price.priceDeltaMinor()).param("id", price.linkId()).param("org", org).update();
            else jdbc.sql("""
                INSERT INTO menu_variant_currency_price (organization_id, menu_variant_option_choice_id, currency_code, price_delta_minor)
                VALUES (:org, :id, :currency, :price) ON CONFLICT (menu_variant_option_choice_id, currency_code)
                DO UPDATE SET price_delta_minor = excluded.price_delta_minor, updated_at = now()
                """).param("org", org).param("id", price.linkId()).param("currency", currency).param("price", price.priceDeltaMinor()).update();
        }
        jdbc.sql("UPDATE menu_variant SET version = version + 1, updated_at = now() WHERE id = :id").param("id", variant).update();
        jdbc.sql("INSERT INTO catalog_change (organization_id, entity_type, entity_id, action, actor_account_id) VALUES (:org, 'MENU_VARIANT', :variant, 'UPDATE', :actor)")
            .param("org", org).param("variant", variant).param("actor", actor.accountId()).update();
        return read(org, variant, currency, version + 1);
    }
    private long version(UUID org, UUID variant, boolean lock) {
        return jdbc.sql("SELECT version FROM menu_variant WHERE id = :id AND organization_id = :org AND archived_at IS NULL" + (lock ? " FOR UPDATE" : ""))
            .param("id", variant).param("org", org).query(Long.class).optional().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Variant unavailable"));
    }
    private PriceSet read(UUID org, UUID variant, String currency, long version) {
        var choices = jdbc.sql("""
            SELECT link.id, grp.name AS group_name, choice.name,
                CASE WHEN :currency = 'SGD' THEN link.price_delta_minor ELSE price.price_delta_minor END AS price
            FROM menu_variant_option_choice link
            JOIN option_choice choice ON choice.id = link.option_choice_id AND choice.archived_at IS NULL
            JOIN option_group grp ON grp.id = choice.option_group_id AND grp.archived_at IS NULL
            LEFT JOIN menu_variant_currency_price price ON price.menu_variant_option_choice_id = link.id AND price.currency_code = :currency
            WHERE link.menu_variant_id = :variant AND link.organization_id = :org AND link.enabled
            ORDER BY grp.display_order, choice.display_order, choice.id
            """).param("currency", currency).param("variant", variant).param("org", org)
            .query((rs, row) -> new ChoicePrice(rs.getObject("id", UUID.class), rs.getString("group_name"), rs.getString("name"), rs.getObject("price", Long.class))).list();
        return new PriceSet(variant, currency, version, choices);
    }
    @Schema(name = "VariantCurrencyPriceSet") public record PriceSet(UUID variantId, String currencyCode, long version, List<ChoicePrice> choices) {}
    @Schema(name = "CurrencyChoicePrice") public record ChoicePrice(UUID linkId, String groupName, String choiceName, @Schema(nullable=true) Long priceDeltaMinor) {}
    public record PriceInput(@jakarta.validation.constraints.NotNull UUID linkId, @jakarta.validation.constraints.NotNull Long priceDeltaMinor) {}
}
