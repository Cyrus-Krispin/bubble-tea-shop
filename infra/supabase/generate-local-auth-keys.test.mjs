import test from "node:test";
import assert from "node:assert/strict";

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
