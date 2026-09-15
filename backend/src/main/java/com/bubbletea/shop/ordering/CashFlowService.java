package com.bubbletea.shop.ordering;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeSet;
import java.util.UUID;

@Service
public class CashFlowService {
    private static final String EXPENSE = """
        SELECT e.*, v.expense_id IS NOT NULL AS voided, v.reason AS void_reason,
               v.recorded_at AS voided_at, v.recorded_by_account_id AS voided_by
          FROM cash_expense e LEFT JOIN cash_expense_void v ON v.expense_id = e.id
        """;
    private final JdbcClient jdbc;
    private final OrderStaffAccessService access;
    CashFlowService(JdbcClient jdbc, OrderStaffAccessService access) { this.jdbc = jdbc; this.access = access; }

    @Transactional
    public Expense record(UUID subject, UUID org, UUID loc, UUID key, long amount, String description) {
        UUID actor = access.authorize(subject, org, loc);
        if (key == null || amount <= 0 || amount > 100000000 || description == null
            || description.isBlank() || description.length() > 240) throw new InvalidCashFlowException();
        String text = description.strip();
        String currency = jdbc.sql("SELECT currency_code FROM location WHERE id = :loc AND organization_id = :org FOR SHARE")
            .param("loc", loc).param("org", org).query(String.class).single();
        int created = jdbc.sql("""
            INSERT INTO cash_expense (organization_id, location_id, currency_code, amount_minor, description, recorded_by_account_id, request_key)
            VALUES (:org, :loc, :currency, :amount, :text, :actor, :key) ON CONFLICT (location_id, request_key) DO NOTHING
            """).param("org", org).param("loc", loc).param("currency", currency).param("amount", amount)
            .param("text", text).param("actor", actor).param("key", key).update();
        Expense result = jdbc.sql(EXPENSE + " WHERE e.organization_id = :org AND e.location_id = :loc AND e.request_key = :key")
            .param("org", org).param("loc", loc).param("key", key).query((rs, row) -> expense(rs, created == 0)).single();
        if (result.amountMinor() != amount || !result.description().equals(text) || !result.recordedByAccountId().equals(actor))
            throw new CashFlowConflictException();
        return result;
    }

    @Transactional
    public Expense voidExpense(UUID subject, UUID org, UUID loc, UUID id, String reason) {
        UUID actor = access.authorize(subject, org, loc);
        if (reason == null || reason.isBlank() || reason.length() > 240) throw new InvalidCashFlowException();
        UUID target = jdbc.sql("SELECT id FROM cash_expense WHERE id = :id AND organization_id = :org AND location_id = :loc")
            .param("id", id).param("org", org).param("loc", loc).query(UUID.class).optional().orElseThrow(CashFlowNotFoundException::new);
        jdbc.sql("""
            INSERT INTO cash_expense_void (expense_id, organization_id, location_id, recorded_by_account_id, reason)
            VALUES (:id, :org, :loc, :actor, :reason) ON CONFLICT (expense_id) DO NOTHING
            """).param("id", target).param("org", org).param("loc", loc).param("actor", actor).param("reason", reason.strip()).update();
        return jdbc.sql(EXPENSE + " WHERE e.id = :id").param("id", target).query((rs, row) -> expense(rs, false)).single();
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Report report(UUID subject, UUID org, UUID loc, int days, int page) {
        access.authorize(subject, org, loc);
        if ((days != 1 && days != 7 && days != 30) || page < 0) throw new InvalidCashFlowException();
        Scope scope = jdbc.sql("SELECT timezone, currency_code, now() AS as_of FROM location WHERE id = :loc AND organization_id = :org")
            .param("loc", loc).param("org", org).query((rs, row) -> new Scope(rs.getString("timezone"), rs.getString("currency_code"), rs.getTimestamp("as_of").toInstant())).single();
        LocalDate start = scope.asOf().atZone(ZoneId.of(scope.timezone())).toLocalDate().minusDays(days - 1L);
        Timestamp from = Timestamp.from(start.atStartOfDay(ZoneId.of(scope.timezone())).toInstant());
        Timestamp until = Timestamp.from(scope.asOf());
        List<Daily> observed = jdbc.sql("""
            SELECT (paid_at AT TIME ZONE :zone)::date AS day, currency_code,
                   coalesce(sum(income), 0) AS income, coalesce(sum(outflow), 0) AS outflow
              FROM (
                SELECT p.paid_at, p.currency_code, p.amount_minor AS income, 0::bigint AS outflow
                  FROM payment p JOIN customer_order o ON o.id = p.customer_order_id
                 WHERE p.organization_id = :org AND o.location_id = :loc AND p.status = 'PAID'
                   AND p.paid_at >= :from AND p.paid_at <= :until
                UNION ALL
                SELECT e.paid_at, e.currency_code, 0::bigint, e.amount_minor
                  FROM cash_expense e
                 WHERE e.organization_id = :org AND e.location_id = :loc AND e.paid_at >= :from AND e.paid_at <= :until
                   AND NOT EXISTS (SELECT 1 FROM cash_expense_void v WHERE v.expense_id = e.id)
              ) events GROUP BY day, currency_code ORDER BY day, currency_code
            """).param("zone", scope.timezone()).param("org", org).param("loc", loc).param("from", from).param("until", until)
            .query((rs, row) -> new Daily(rs.getDate("day").toLocalDate(), rs.getString("currency_code"), rs.getLong("income"), rs.getLong("outflow"))).list();
        var currencies = new TreeSet<String>(); currencies.add(scope.currency()); observed.forEach(row -> currencies.add(row.currencyCode()));
        var daily = new ArrayList<Daily>(); var totals = new ArrayList<Total>();
        for (String currency : currencies) {
            long income = 0, outflow = 0;
            for (int i = 0; i < days; i++) {
                LocalDate day = start.plusDays(i);
                Daily value = observed.stream().filter(row -> row.date().equals(day) && row.currencyCode().equals(currency)).findFirst()
                    .orElse(new Daily(day, currency, 0, 0));
                daily.add(value); income = Math.addExact(income, value.incomeMinor()); outflow = Math.addExact(outflow, value.outflowMinor());
            }
            totals.add(new Total(currency, income, outflow, Math.subtractExact(income, outflow)));
        }
        String filter = " WHERE e.organization_id = :org AND e.location_id = :loc AND e.paid_at >= :from AND e.paid_at <= :until";
        long count = jdbc.sql("SELECT count(*) FROM cash_expense e" + filter).param("org", org).param("loc", loc)
            .param("from", from).param("until", until).query(Long.class).single();
        List<Expense> expenses = jdbc.sql(EXPENSE + filter + " ORDER BY e.paid_at DESC, e.id DESC LIMIT 25 OFFSET :offset")
            .param("org", org).param("loc", loc).param("from", from).param("until", until).param("offset", (long) page * 25)
            .query((rs, row) -> expense(rs, false)).list();
        return new Report(days, scope.timezone(), scope.currency(), start, scope.asOf(), totals, daily, expenses, count, page, (int) ((count + 24) / 25));
    }

    private Expense expense(java.sql.ResultSet rs, boolean replayed) throws java.sql.SQLException {
        Timestamp voidedAt = rs.getTimestamp("voided_at");
        return new Expense(rs.getObject("id", UUID.class), rs.getString("currency_code"), rs.getLong("amount_minor"),
            rs.getString("description"), rs.getTimestamp("paid_at").toInstant(), rs.getObject("recorded_by_account_id", UUID.class),
            rs.getBoolean("voided"), rs.getString("void_reason"), voidedAt == null ? null : voidedAt.toInstant(),
            rs.getObject("voided_by", UUID.class), replayed);
    }
    private record Scope(String timezone, String currency, Instant asOf) {}
    @io.swagger.v3.oas.annotations.media.Schema(name = "CashFlowExpense")
    public record Expense(UUID id, String currencyCode, long amountMinor, String description, Instant paidAt,
        UUID recordedByAccountId, boolean voided, String voidReason, Instant voidedAt, UUID voidedByAccountId, boolean replayed) {}
    @io.swagger.v3.oas.annotations.media.Schema(name = "CashFlowDaily")
    public record Daily(LocalDate date, String currencyCode, long incomeMinor, long outflowMinor) {}
    @io.swagger.v3.oas.annotations.media.Schema(name = "CashFlowTotal")
    public record Total(String currencyCode, long incomeMinor, long outflowMinor, long netMinor) {}
    @io.swagger.v3.oas.annotations.media.Schema(name = "CashFlowReport")
    public record Report(int days, String timezone, String currencyCode, LocalDate startDate, Instant asOf,
        List<Total> totals, List<Daily> daily, List<Expense> expenses, long totalExpenses, int page, int totalPages) {}
}
class InvalidCashFlowException extends RuntimeException {}
class CashFlowConflictException extends RuntimeException {}
class CashFlowNotFoundException extends RuntimeException {}
