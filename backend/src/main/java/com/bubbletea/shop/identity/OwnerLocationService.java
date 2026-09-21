package com.bubbletea.shop.identity;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class OwnerLocationService {
    private final JdbcClient jdbc;
    private final StaffContextService staff;
    OwnerLocationService(JdbcClient jdbc, StaffContextService staff) { this.jdbc = jdbc; this.staff = staff; }
    private void authorize(UUID subject, UUID org) {
        if (staff.resolve(subject).memberships().stream().noneMatch(m -> m.organizationId().equals(org) && m.role() == StaffContextService.StaffRole.OWNER)) throw new StaffAccessDeniedException();
    }
    @Transactional(readOnly = true)
    public List<ShopLocation> list(UUID subject, UUID org) {
        authorize(subject, org);
        return jdbc.sql("SELECT id, name, public_slug, currency_code, timezone, default_locale, active FROM location WHERE organization_id = :org ORDER BY name, id")
            .param("org", org).query((rs, row) -> new ShopLocation(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("public_slug"), rs.getString("currency_code"), rs.getString("timezone"), rs.getString("default_locale"), rs.getBoolean("active"))).list();
    }
    @Transactional
    public ShopLocation create(UUID subject, UUID org, String name, String slug, String currency, String timezone, String locale) {
        authorize(subject, org);
        if (!Set.of("SGD", "MYR", "CNY").contains(currency) || !Set.of("en-SG", "ms-MY", "zh-CN").contains(locale) || !ZoneId.getAvailableZoneIds().contains(timezone)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid currency, locale or timezone");
        UUID id = UUID.randomUUID();
        try {
            jdbc.sql("""
                INSERT INTO location (id, organization_id, name, public_slug, currency_code, timezone, default_locale, image_key)
                VALUES (:id, :org, :name, :slug, :currency, :timezone, :locale, 'generic')
                """).param("id", id).param("org", org).param("name", name.trim()).param("slug", slug)
                .param("currency", currency).param("timezone", timezone).param("locale", locale).update();
        } catch (DataIntegrityViolationException error) { throw new ResponseStatusException(HttpStatus.CONFLICT, "A location already uses this name or public slug"); }
        return new ShopLocation(id, name.trim(), slug, currency, timezone, locale, true);
    }
    @Schema(name = "OwnerShopLocation")
    public record ShopLocation(UUID id, String name, @Schema(nullable = true) String slug, String currencyCode, String timezone, String defaultLocale, boolean active) {}
}
