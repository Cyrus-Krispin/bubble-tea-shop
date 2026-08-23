import { describe, expect, it } from "vitest";

import { resolveReturnPath } from "./returnPath";

describe("resolveReturnPath", () => {
  it("keeps supported same-origin application paths", () => {
    expect(resolveReturnPath("/cart", "/account")).toBe("/cart");
    expect(resolveReturnPath("/staff/orders?status=PENDING", "/account")).toBe(
      "/staff/orders?status=PENDING",
    );
  });

  it("rejects external, protocol-relative, and recursive auth paths", () => {
    expect(resolveReturnPath("https://attacker.example", "/account")).toBe("/account");
    expect(resolveReturnPath("//attacker.example", "/account")).toBe("/account");
    expect(resolveReturnPath("/account/access?next=/cart", "/account")).toBe("/account");
  });
});
