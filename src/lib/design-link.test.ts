import { describe, expect, it } from "vitest";
import { normalizeDesignLink } from "./design-link";

describe("normalizeDesignLink", () => {
  it("menerima link OneDrive/SharePoint https", () => {
    expect(normalizeDesignLink("https://1drv.ms/i/abc")).toContain("1drv.ms");
    expect(normalizeDesignLink("https://acme-my.sharepoint.com/:i:/g/x")).toContain("sharepoint.com");
  });
  it("menolak http, host lain, dan host tiruan", () => {
    expect(() => normalizeDesignLink("http://1drv.ms/x")).toThrow();
    expect(() => normalizeDesignLink("https://example.com/x")).toThrow();
    expect(() => normalizeDesignLink("https://evilsharepoint.com/x")).toThrow();
    expect(() => normalizeDesignLink("bukan url")).toThrow();
  });
});
