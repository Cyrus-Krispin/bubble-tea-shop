package com.bubbletea.shop.observability;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

@Component
public class RequestCorrelationFilter extends OncePerRequestFilter {
    static final String HEADER = "X-Request-Id";
    static final String MDC_KEY = "request.id";
    private static final Pattern SAFE_REQUEST_ID =
        Pattern.compile("[A-Za-z0-9][A-Za-z0-9._-]{0,63}");

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        String supplied = request.getHeader(HEADER);
        String requestId = supplied != null && SAFE_REQUEST_ID.matcher(supplied).matches()
            ? supplied
            : UUID.randomUUID().toString();
        response.setHeader(HEADER, requestId);
        MDC.put(MDC_KEY, requestId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }
}
