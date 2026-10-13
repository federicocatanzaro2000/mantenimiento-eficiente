import { describe, it, expect } from "vitest";
import { calcularCumplimientoPreventivo as c } from "@/lib/kpis/cumplimiento";

describe("cumplimiento preventivo", () => {
  it("60/42/6 → 94,44%", () => expect(c(60, 42, 6)!).toBeCloseTo(94.44, 2));
  it("50/50/0 → 100%", () => expect(c(50, 50, 0)).toBe(100));
  it("0/80/20 → 80%", () => expect(c(0, 80, 20)).toBe(80));
  it("0/0/10 → 0%", () => expect(c(0, 0, 10)).toBe(0));
  it("0/0/0 → sin datos", () => expect(c(0, 0, 0)).toBeNull());
});
