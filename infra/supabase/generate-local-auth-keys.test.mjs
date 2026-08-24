import test from "node:test";
import assert from "node:assert/strict";
import { createPublicKey, verify } from "node:crypto";

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

test("generates ES256 API keys accepted by asymmetric GoTrue", () => {
  const { anonKey, jwtKeys, serviceRoleKey } = generateLocalAuthKeys();
  const [signingKey] = JSON.parse(jwtKeys);

  assertApiKey(anonKey, signingKey, "anon");
  assertApiKey(serviceRoleKey, signingKey, "service_role");
});

test("generates a separate encryption key for postgres-meta", () => {
  const { jwtSecret, pgMetaCryptoKey } = generateLocalAuthKeys();

  assert.ok(pgMetaCryptoKey.length >= 32);
  assert.notEqual(pgMetaCryptoKey, jwtSecret);
});

function assertApiKey(token, signingKey, expectedRole) {
  assert.equal(typeof token, "string");

  const [encodedHeader, encodedPayload, signature] = token.split(".");
  const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  const publicKey = createPublicKey({
    key: { ...signingKey, d: undefined, key_ops: ["verify"] },
    format: "jwk",
  });

  assert.deepEqual(header, { alg: "ES256", typ: "JWT", kid: signingKey.kid });
  assert.equal(payload.iss, "supabase-local");
  assert.equal(payload.aud, "authenticated");
  assert.equal(payload.role, expectedRole);
  assert.ok(payload.iat <= Math.floor(Date.now() / 1000));
  assert.ok(payload.exp > payload.iat);
  assert.equal(verify(
    "sha256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    { key: publicKey, dsaEncoding: "ieee-p1363" },
    Buffer.from(signature, "base64url"),
  ), true);
}
