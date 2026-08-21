package com.bubbletea.shop.identity;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OwnerBootstrapRunnerTest {
    @Test
    void delegatesConfiguredIdentifiersToTheBootstrapService() throws Exception {
        OwnerBootstrapService service = mock(OwnerBootstrapService.class);
        UUID authSubject = UUID.randomUUID();
        UUID organizationId = UUID.randomUUID();
        when(service.bootstrap(authSubject, organizationId)).thenReturn(
            new OwnerBootstrapService.BootstrapResult(
                UUID.randomUUID(),
                UUID.randomUUID(),
                organizationId,
                true));
        OwnerBootstrapRunner runner = new OwnerBootstrapRunner(
            service,
            authSubject,
            organizationId);

        runner.run(null);

        verify(service).bootstrap(authSubject, organizationId);
    }
}
