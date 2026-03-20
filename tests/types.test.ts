import { describe, it, expect } from "vitest";
import type {
  PaginatedResponse,
  PaginatedMetrics,
  PaginatedAlertEvents,
  MetricSnapshot,
  AlertEvent,
} from "../app/_lib/types";

describe("PaginatedResponse type", () => {
  it("accepts valid paginated metrics", () => {
    const response: PaginatedMetrics = {
      items: [
        {
          timestamp: 1000,
          cpu_percent: 50,
          memory_percent: 60,
          disk_percent: 40,
          net_bytes_sent: 100,
          net_bytes_recv: 200,
          load1: 1.0,
          load5: 0.8,
          load15: 0.5,
        },
      ],
      total: 1,
      limit: 500,
      offset: 0,
    };

    expect(response.items).toHaveLength(1);
    expect(response.total).toBe(1);
  });

  it("accepts empty paginated response", () => {
    const response: PaginatedMetrics = {
      items: [],
      total: 0,
      limit: 500,
      offset: 0,
    };

    expect(response.items).toHaveLength(0);
    expect(response.total).toBe(0);
  });
});

describe("constants", () => {
  it("TIME_RANGES includes 30d", async () => {
    const { TIME_RANGES } = await import("../app/_lib/constants");
    const values = TIME_RANGES.map((r) => r.value);
    expect(values).toContain("30d");
    expect(values).toContain("1h");
    expect(values).toContain("7d");
  });
});
