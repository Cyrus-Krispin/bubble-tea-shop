# Session expiry and refresh

Keep Supabase as the sole owner of browser session persistence and refresh. The application must
stop showing private content or supplying an expired bearer token when automatic refresh cannot
complete before its deadline. A later valid SDK auth event may restore access.

## Acceptance

- Carry the SDK's absolute expiry timestamp in the in-memory session summary; reject missing,
  non-finite, or expired timestamps. This is a UI guard; Spring still verifies JWTs and current roles.
- Clear the private session at expiry without waiting for a network request. Recheck on focus and
  visibility changes because background timers can be throttled.
- A successful refresh replaces the token and timer. An old timer or stale initial lookup cannot
  overwrite a newer session. Sign-out events and unmount cancel pending callbacks.
- Customer provisioning must finish before exposing its session. A delayed provisioning event must
  never overwrite a later sign-out or newer auth event.
- Do not clear the guest cart or manipulate SDK token storage; the SDK handles refresh and explicit
  local sign-out. Protected routes use their existing sign-in redirects and safe return paths.

Verify timer expiry, renewed deadlines, background resume, invalid timestamps, subscription races,
private route cleanup, and existing customer/staff sign-in flows. Run all frontend checks and
real-browser desktop/mobile authentication flows. No API or schema change is needed.

References: [auth events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange),
[session lifecycle](https://supabase.com/docs/guides/auth/sessions). Reviewed the Supabase changelog
on 2026-09-15; this change does not upgrade the pinned local Auth/gateway stack.
