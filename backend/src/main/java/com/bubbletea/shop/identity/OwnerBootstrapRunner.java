package com.bubbletea.shop.identity;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@ConditionalOnProperty(name = "app.bootstrap.owner.enabled", havingValue = "true")
class OwnerBootstrapRunner implements ApplicationRunner {
    private static final Logger LOGGER = LoggerFactory.getLogger(OwnerBootstrapRunner.class);

    private final OwnerBootstrapService service;
    private final UUID authSubject;
    private final UUID organizationId;

    OwnerBootstrapRunner(
        OwnerBootstrapService service,
        @Value("${app.bootstrap.owner.auth-subject}") UUID authSubject,
        @Value("${app.bootstrap.owner.organization-id}") UUID organizationId
    ) {
        this.service = service;
        this.authSubject = authSubject;
        this.organizationId = organizationId;
    }

    @Override
    public void run(ApplicationArguments args) {
        OwnerBootstrapService.BootstrapResult result = service.bootstrap(
            authSubject,
            organizationId);
        LOGGER.info(
            "owner_bootstrap_completed accountId={} membershipId={} organizationId={} created={}",
            result.accountId(),
            result.membershipId(),
            result.organizationId(),
            result.created());
    }
}
