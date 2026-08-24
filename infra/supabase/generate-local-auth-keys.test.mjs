import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { generateLocalAuthKeys } from "./generate-local-auth-keys.mjs";

test("generates one ES256 private signing key accepted by GoTrue", () => {
  const { jwtKeys, jwtSecret } = generateLocalAuthKeys();
  const [signingKey] = JSON.parse(jwtKeys);

  assert.ok(jwtSecret.length >= 32);
  assert.equal(signingKey.kty, "EC");
  assert.equal(signingKey.crv, "P-256");
  assert.equal(signingKey.alg, "ES256");
  assert.deepEqual(signingKey.key_ops, ["sign", "verify"]);
  assert.ok(signingKey.d);
  assert.ok(signingKey.kid);
});

test("generates signed legacy API keys for local Studio", () => {
  const { anonKey, jwtSecret, serviceRoleKey } = generateLocalAuthKeys();

  assertLegacyApiKey(anonKey, jwtSecret, "anon");
  assertLegacyApiKey(serviceRoleKey, jwtSecret, "service_role");
});

test("generates a separate encryption key for postgres-meta", () => {
  const { jwtSecret, pgMetaCryptoKey } = generateLocalAuthKeys();

  assert.ok(pgMetaCryptoKey.length >= 32);
  assert.notEqual(pgMetaCryptoKey, jwtSecret);
});

function assertLegacyApiKey(token, secret, expectedRole) {
  assert.equal(typeof token, "string");

  const [encodedHeader, encodedPayload, signature] = token.split(".");
  const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  const expectedSignature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  assert.deepEqual(header, { alg: "HS256", typ: "JWT" });
  assert.equal(payload.iss, "supabase-local");
  assert.equal(payload.role, expectedRole);
  assert.ok(payload.iat <= Math.floor(Date.now() / 1000));
  assert.ok(payload.exp > payload.iat);
  assert.equal(signature, expectedSignature);
}
