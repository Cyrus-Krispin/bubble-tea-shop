import { createHmac, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const LEGACY_API_KEY_LIFETIME_SECONDS = 10 * 365 * 24 * 60 * 60;

export function generateLocalAuthKeys() {
  const { privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const signingKey = privateKey.export({ format: "jwk" });

  signingKey.alg = "ES256";
  signingKey.kid = randomUUID();
  signingKey.key_ops = ["sign", "verify"];
  signingKey.use = "sig";

  const jwtSecret = randomBytes(48).toString("base64url");
  const issuedAt = Math.floor(Date.now() / 1000);

  return {
    anonKey: createLegacyApiKey(jwtSecret, "anon", issuedAt),
    jwtSecret,
    jwtKeys: JSON.stringify([signingKey]),
    pgMetaCryptoKey: randomBytes(32).toString("hex"),
    serviceRoleKey: createLegacyApiKey(jwtSecret, "service_role", issuedAt),
  };
}

function createLegacyApiKey(secret, role, issuedAt) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: "supabase-local",
      ref: "supabase-local",
      role,
      iat: issuedAt,
      exp: issuedAt + LEGACY_API_KEY_LIFETIME_SECONDS,
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { anonKey, jwtSecret, jwtKeys, pgMetaCryptoKey, serviceRoleKey } = generateLocalAuthKeys();

  console.log(`JWT_SECRET=${jwtSecret}`);
  console.log(`JWT_KEYS='${jwtKeys}'`);
  console.log(`ANON_KEY=${anonKey}`);
  console.log(`SERVICE_ROLE_KEY=${serviceRoleKey}`);
  console.log(`PG_META_CRYPTO_KEY=${pgMetaCryptoKey}`);
}
