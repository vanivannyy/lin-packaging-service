import { afterEach, describe, expect, it } from "vitest";
import { getClientSecret, getSessionSecret } from "./secrets";

const ORIGINAL = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("secrets", () => {
  it("gagal bila SESSION_SECRET kosong atau lemah", () => {
    delete process.env.SESSION_SECRET;
    expect(() => getSessionSecret()).toThrow();
    process.env.SESSION_SECRET = "pendek";
    expect(() => getSessionSecret()).toThrow();
    process.env.SESSION_SECRET = "REPLACE_ME";
    expect(() => getSessionSecret()).toThrow();
  });
  it("menerima secret kuat; client secret harus berbeda", () => {
    process.env.SESSION_SECRET = "a".repeat(32);
    process.env.CLIENT_SESSION_SECRET = "a".repeat(32);
    expect(getSessionSecret().length).toBe(32);
    expect(() => getClientSecret()).toThrow();
    process.env.CLIENT_SESSION_SECRET = "b".repeat(32);
    expect(getClientSecret().length).toBe(32);
  });
});
