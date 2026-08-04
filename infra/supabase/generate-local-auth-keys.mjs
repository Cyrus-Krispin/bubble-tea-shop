import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

export function generateLocalAuthKeys() {
  const { privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const signingKey = privateKey.export({ format: "jwk" });

  signingKey.alg = "ES256";
  signingKey.kid = randomUUID();
  signingKey.key_ops = ["sign", "verify"];
  signingKey.use = "sig";

  return {
    jwtSecret: randomBytes(48).toString("base64url"),
    jwtKeys: JSON.stringify([signingKey]),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { jwtSecret, jwtKeys } = generateLocalAuthKeys();

  console.log(`JWT_SECRET=${jwtSecret}`);
  console.log(`JWT_KEYS='${jwtKeys}'`);
}
