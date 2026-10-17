import { describe, expect, it } from "vitest";

import { normalizeMoney, parseBRL } from "../../src/lib/compute";

describe("compute utilities", () => {
  it("parses BRL strings in Brazilian formats", () => {
    expect(parseBRL("R$ 15.000,00")).toBe(15000);
    expect(parseBRL("1.500,50")).toBe(1500.5);
    expect(parseBRL("15000")).toBe(15000);
    expect(parseBRL("abc")).toBeNull();
  });

  it("normalizes money strings without altering free-form text", () => {
    const formatted = normalizeMoney("R$ 15.000,00").replace(/\s/g, " ");
    expect(formatted).toBe("R$ 15.000,00");
    expect(normalizeMoney("1500").replace(/\s/g, " ")).toBe("R$ 1.500,00");
    expect(normalizeMoney("texto livre")).toBe("texto livre");
  });
});
