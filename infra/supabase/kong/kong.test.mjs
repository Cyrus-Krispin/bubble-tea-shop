import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const kongConfig = await readFile(new URL("./kong.yml", import.meta.url), "utf8");

test("rate limits local Auth traffic by client IP", () => {
  assert.match(kongConfig, /name: rate-limiting/);
  assert.match(kongConfig, /route: auth-v1/);
  assert.match(kongConfig, /limit_by: ip/);
  assert.match(kongConfig, /minute: 120/);
  assert.match(kongConfig, /policy: local/);
  assert.match(kongConfig, /fault_tolerant: false/);
});
