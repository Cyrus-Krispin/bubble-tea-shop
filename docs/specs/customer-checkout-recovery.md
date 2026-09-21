# Customer checkout recovery

An unknown placement outcome must keep one immutable payload, location, identity and idempotency key.
Keep the attempt in the cart provider above routes, lock editing while it is unresolved, and allow
recovery without a fresh catalog quote. Token refresh may use the newer token for the same stable Supabase user
identity; a different or expired account must sign back in before retrying. An originally anonymous
attempt remains anonymous, even after signing in. Spring remains the authorization authority.

A first definitive 4xx rejection may unlock the cart. Network/timeout/5xx outcomes remain uncertain;
subsequent failures never discard that key. A 30-second request timeout permits safe retries. Render
confirmed Pending, Completed or Cancelled states accurately, including historical totals. Requests
are single-flight even across route remounts; completion clears the original cart only once.

This recovery state lives for the open app session, like the existing cart. Reloading or closing the
app does not preserve a cart; users should check account history or ask staff about an unknown order
before beginning again. No access token is persisted by this feature.

Verification covers lost response followed by 5xx/4xx, route navigation, editing attempts, identity
switch/expiry, guest-to-login, refresh, delayed response and already-completed receipt recovery.
