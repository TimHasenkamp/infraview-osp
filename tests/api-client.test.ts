import { describe, it, expect } from "vitest";
import { getMetricsExportUrl } from "../app/_lib/api-client";

describe("getMetricsExportUrl", () => {
  it("generates CSV export URL with defaults", () => {
    const url = getMetricsExportUrl("server-1");
    expect(url).toContain("server-1");
    expect(url).toContain("range=1h");
    expect(url).toContain("format=csv");
  });

  it("generates JSON export URL", () => {
    const url = getMetricsExportUrl("server-1", "7d", "json");
    expect(url).toContain("range=7d");
    expect(url).toContain("format=json");
  });

  it("uses custom range", () => {
    const url = getMetricsExportUrl("s1", "30d");
    expect(url).toContain("range=30d");
  });
});
