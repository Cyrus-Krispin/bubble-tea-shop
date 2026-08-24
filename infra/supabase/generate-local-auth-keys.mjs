import { createPrivateKey, generateKeyPairSync, randomBytes, randomUUID, sign } from "node:crypto";
import { pathToFileURL } from "node:url";

const API_KEY_LIFETIME_SECONDS = 10 * 365 * 24 * 60 * 60;

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
    anonKey: createApiKey(signingKey, "anon", issuedAt),
    jwtSecret,
    jwtKeys: JSON.stringify([signingKey]),
    pgMetaCryptoKey: randomBytes(32).toString("hex"),
    serviceRoleKey: createApiKey(signingKey, "service_role", issuedAt),
  };
}

function createApiKey(signingKey, role, issuedAt) {
  const header = Buffer.from(JSON.stringify({
    alg: "ES256",
    typ: "JWT",
    kid: signingKey.kid,
  })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: "supabase-local",
      ref: "supabase-local",
      role,
      aud: "authenticated",
      iat: issuedAt,
      exp: issuedAt + API_KEY_LIFETIME_SECONDS,
    }),
  ).toString("base64url");
  const signature = sign(
    "sha256",
    Buffer.from(`${header}.${payload}`),
    {
      key: createPrivateKey({ key: signingKey, format: "jwk" }),
      dsaEncoding: "ieee-p1363",
    },
  ).toString("base64url");

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
