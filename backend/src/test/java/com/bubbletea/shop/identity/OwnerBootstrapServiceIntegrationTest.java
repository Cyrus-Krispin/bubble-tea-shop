package com.bubbletea.shop.identity;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Testcontainers
@SpringBootTest(properties = "spring.main.web-application-type=none")
class OwnerBootstrapServiceIntegrationTest {
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
    JdbcTemplate jdbc;

    @Autowired
    OwnerBootstrapService ownerBootstrap;

    @Test
    void createsOneOwnerMembershipAndTreatsRetryAsSuccess() {
        Fixture fixture = fixture(true);

        OwnerBootstrapService.BootstrapResult first = ownerBootstrap.bootstrap(
            fixture.authSubject(), fixture.organizationId());
        OwnerBootstrapService.BootstrapResult repeated = ownerBootstrap.bootstrap(
            fixture.authSubject(), fixture.organizationId());

        assertThat(first.created()).isTrue();
        assertThat(repeated.created()).isFalse();
        assertThat(repeated.membershipId()).isEqualTo(first.membershipId());
        assertThat(jdbc.queryForObject("""
            SELECT count(*)
              FROM organization_membership
             WHERE organization_id = ?
               AND account_id = ?
               AND role = 'OWNER'
               AND active
            """, Integer.class, fixture.organizationId(), fixture.accountId())).isEqualTo(1);
    }

    @Test
    void refusesToPromoteOrReactivateAnExistingMembership() {
        Fixture manager = fixture(true);
        UUID membershipId = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO organization_membership (
                id, organization_id, account_id, role, active
            ) VALUES (?, ?, ?, 'MANAGER', true)
            """, membershipId, manager.organizationId(), manager.accountId());

        assertThatThrownBy(() -> ownerBootstrap.bootstrap(
            manager.authSubject(), manager.organizationId()))
            .isInstanceOf(OwnerBootstrapException.class)
            .hasMessageContaining("existing membership");
        assertThat(jdbc.queryForObject(
            "SELECT role FROM organization_membership WHERE id = ?",
            String.class,
            membershipId)).isEqualTo("MANAGER");

        Fixture inactiveOwner = fixture(true);
        jdbc.update("""
            INSERT INTO organization_membership (
                id, organization_id, account_id, role, active
            ) VALUES (?, ?, ?, 'OWNER', false)
            """, UUID.randomUUID(), inactiveOwner.organizationId(), inactiveOwner.accountId());

        assertThatThrownBy(() -> ownerBootstrap.bootstrap(
            inactiveOwner.authSubject(), inactiveOwner.organizationId()))
            .isInstanceOf(OwnerBootstrapException.class)
            .hasMessageContaining("existing membership");
        assertThat(jdbc.queryForObject("""
            SELECT active
              FROM organization_membership
             WHERE organization_id = ? AND account_id = ?
            """, Boolean.class, inactiveOwner.organizationId(), inactiveOwner.accountId())).isFalse();
    }

    @Test
    void requiresAnExistingEnabledAccountAndOrganization() {
        Fixture disabled = fixture(false);
        Fixture enabled = fixture(true);

        assertThatThrownBy(() -> ownerBootstrap.bootstrap(
            disabled.authSubject(), disabled.organizationId()))
            .isInstanceOf(OwnerBootstrapException.class)
            .hasMessageContaining("disabled");
        assertThatThrownBy(() -> ownerBootstrap.bootstrap(
            UUID.randomUUID(), disabled.organizationId()))
            .isInstanceOf(OwnerBootstrapException.class)
            .hasMessageContaining("not provisioned");
        assertThatThrownBy(() -> ownerBootstrap.bootstrap(
            enabled.authSubject(), UUID.randomUUID()))
            .isInstanceOf(OwnerBootstrapException.class)
            .hasMessageContaining("organization does not exist");
        assertThat(jdbc.queryForObject(
            "SELECT count(*) FROM organization_membership WHERE account_id IN (?, ?)",
            Integer.class,
            disabled.accountId(),
            enabled.accountId())).isZero();
    }

    private Fixture fixture(boolean enabled) {
        UUID authSubject = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        UUID organizationId = UUID.randomUUID();
        jdbc.update("INSERT INTO organization (id, name) VALUES (?, ?)",
            organizationId, "Organization " + organizationId);
        jdbc.update("INSERT INTO account (id, auth_subject, enabled) VALUES (?, ?, ?)",
            accountId, authSubject, enabled);
        return new Fixture(authSubject, accountId, organizationId);
    }

    private record Fixture(UUID authSubject, UUID accountId, UUID organizationId) {
    }
}
