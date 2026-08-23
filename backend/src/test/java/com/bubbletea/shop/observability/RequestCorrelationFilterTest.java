package com.bubbletea.shop.observability;

import jakarta.servlet.http.HttpServlet;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class RequestCorrelationFilterTest {
    private final RequestCorrelationFilter filter = new RequestCorrelationFilter();

    @Test
    void preservesSafeRequestIdDuringRequestAndReturnsItToCaller() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/guest/catalog");
        request.addHeader(RequestCorrelationFilter.HEADER, "edge-01.order_42");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicReference<String> observed = new AtomicReference<>();
        HttpServlet servlet = new HttpServlet() {
            @Override
            protected void service(
                jakarta.servlet.http.HttpServletRequest servletRequest,
                jakarta.servlet.http.HttpServletResponse servletResponse
            ) {
                observed.set(MDC.get(RequestCorrelationFilter.MDC_KEY));
            }
        };

        filter.doFilter(request, response, new MockFilterChain(servlet));

        assertThat(observed).hasValue("edge-01.order_42");
        assertThat(response.getHeader(RequestCorrelationFilter.HEADER)).isEqualTo("edge-01.order_42");
        assertThat(MDC.get(RequestCorrelationFilter.MDC_KEY)).isNull();
    }

    @Test
    void replacesUnsafeOrOversizedRequestId() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/health");
        request.addHeader(RequestCorrelationFilter.HEADER, "unsafe\nvalue-that-must-not-reach-logs");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicReference<String> observed = new AtomicReference<>();
        HttpServlet servlet = new HttpServlet() {
            @Override
            protected void service(
                jakarta.servlet.http.HttpServletRequest servletRequest,
                jakarta.servlet.http.HttpServletResponse servletResponse
            ) {
                observed.set(MDC.get(RequestCorrelationFilter.MDC_KEY));
            }
        };

        filter.doFilter(request, response, new MockFilterChain(servlet));

        assertThat(observed.get()).matches("[0-9a-f-]{36}");
        assertThat(response.getHeader(RequestCorrelationFilter.HEADER)).isEqualTo(observed.get());
        assertThat(MDC.get(RequestCorrelationFilter.MDC_KEY)).isNull();
    }
}
