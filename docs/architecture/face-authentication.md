# Future Face Authentication

Face authentication is a future experiment, not a committed production capability. The developer
may build a simple local model and is investigating whether matching can run in the browser. No
model, biometric provider, liveness technology, enrollment store, or Supabase integration has been
selected or implemented.

## Relationship to managed authentication

Supabase is the selected managed authentication service. A face experiment does not replace
Supabase, issue an application session, or become authorization evidence for Spring.

If face authentication is ever proposed for production, it must use a supported, reviewed path
into Supabase authentication. The repository intentionally does not define that flow yet. A local
model result, browser-supplied account ID, match score, or `matched` flag must never be treated as a
signed-in identity.

After Supabase has established identity, Spring still resolves current application-owned account,
organization membership, role, and location assignments. Face-related information does not grant
domain access and must not be copied into general authorization claims or application metadata.

## Intended experimental scope

- Customer use only at first. Owner and manager access continues to use the standard managed
  authentication path and any stronger controls selected later.
- Enrollment is opt-in and requires an already authenticated customer plus explicit consent.
- Customers can remove a face credential and must always have a non-biometric login and recovery
  path.
- An unknown, ambiguous, low-confidence, or failed-liveness result signs in nobody and falls back
  to the normal Supabase authentication experience without revealing candidate accounts.
- A privacy and legal review is required before collecting face templates because they are
  sensitive biometric data.

One-to-many identification compares a captured face with many enrolled customers and has greater
false-match and privacy risk than one-to-one verification, where a customer first identifies an
account. Prefer one-to-one verification unless hands-free identification becomes a firm product
requirement.

## Enrollment and storage questions

A future design must decide whether processing stays on-device, whether Supabase stores only an
opaque reference or any encrypted application data, and how consent, deletion, retention, and key
rotation work. These decisions are deliberately open.

Any reviewed enrollment flow should:

1. Re-authenticate the customer through the standard Supabase path.
2. Explain purpose, retention, deletion behavior, and the consent choice.
3. Capture samples with quality and presentation/liveness checks.
4. Minimize data sent off the device and delete transient raw captures.
5. Record consent, model version, status, and audit events without exposing biometric material
   through general account APIs.

Biometric templates and match data must not be logged, placed in analytics, reused across
organizations, or stored in unprotected application metadata.

## Abuse and failure controls

- Require presentation-attack/liveness detection before any production pilot; a photo or replayed
  video must not be sufficient.
- Bind attempts to a short-lived challenge, intended device or browser context, origin, and nonce.
- Rate-limit attempts and monitor false accepts, false rejects, spoof attempts, and threshold
  changes.
- Treat multiple close candidates as no match and offer a non-biometric recovery path.
- Avoid silently switching an active user when another face enters view.
- Revoke biometric credentials independently from the managed Supabase session and disable their
  use when the linked application account is disabled.

## Delivery sequence

1. Implement standard Supabase authentication and the application identity mapping.
2. Deliver customer accounts and a non-biometric login and recovery path.
3. Evaluate browser-local or platform biometric approaches that minimize central biometric data.
4. Define consent, enrollment, deletion, retention, and audit requirements.
5. If face matching remains useful, select and threat-model its liveness and matching approach.
6. Pilot only with test identities behind a feature flag, then complete security, accessibility,
   privacy, bias, and operational reviews before considering production use.
