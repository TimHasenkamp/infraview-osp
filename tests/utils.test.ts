import { describe, it, expect } from "vitest";
import {
  formatBytes,
  formatPercent,
  getMetricColor,
  getMetricBarColor,
  timeAgo,
  normalizeServer,
} from "../app/_lib/utils";
import type { ServerResponse } from "../app/_lib/types";

describe("formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1024 * 1024)).toBe("1 MB");
  });

  it("formats gigabytes", () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1 GB");
  });

  it("formats with decimals", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
  });
});

describe("formatPercent", () => {
  it("rounds to nearest integer", () => {
    expect(formatPercent(42.7)).toBe("43%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(100)).toBe("100%");
  });
});

describe("getMetricColor", () => {
  it("returns primary for normal values", () => {
    expect(getMetricColor(50)).toBe("text-primary");
  });

  it("returns amber for warning values", () => {
    expect(getMetricColor(75)).toBe("text-amber-400");
  });

  it("returns destructive for critical values", () => {
    expect(getMetricColor(95)).toBe("text-destructive");
  });

  it("handles boundary values", () => {
    expect(getMetricColor(69)).toBe("text-primary");
    expect(getMetricColor(70)).toBe("text-amber-400");
    expect(getMetricColor(89)).toBe("text-amber-400");
    expect(getMetricColor(90)).toBe("text-destructive");
  });
});

describe("getMetricBarColor", () => {
  it("returns correct bar colors", () => {
    expect(getMetricBarColor(50)).toBe("bg-primary");
    expect(getMetricBarColor(75)).toBe("bg-amber-400");
    expect(getMetricBarColor(95)).toBe("bg-destructive");
  });
});

describe("timeAgo", () => {
  it("formats seconds", () => {
    const now = Date.now() / 1000;
    expect(timeAgo(now - 30)).toBe("30s ago");
  });

  it("formats minutes", () => {
    const now = Date.now() / 1000;
    expect(timeAgo(now - 300)).toBe("5m ago");
  });

  it("formats hours", () => {
    const now = Date.now() / 1000;
    expect(timeAgo(now - 7200)).toBe("2h ago");
  });

  it("formats days", () => {
    const now = Date.now() / 1000;
    expect(timeAgo(now - 172800)).toBe("2d ago");
  });
});

describe("normalizeServer", () => {
  it("fills null metrics with defaults", () => {
    const raw: ServerResponse = {
      id: "test",
      hostname: "host",
      status: "online",
      last_seen: 1000,
      first_seen: 900,
      cpu: null,
      memory: null,
      disk: null,
      network: null,
      load: null,
      containers: [],
    };

    const server = normalizeServer(raw);
    expect(server.cpu.usage_percent).toBe(0);
    expect(server.memory.total_bytes).toBe(0);
    expect(server.disk.path).toBe("/");
    expect(server.network.bytes_sent).toBe(0);
    expect(server.load.load1).toBe(0);
  });

  it("preserves existing metrics", () => {
    const raw: ServerResponse = {
      id: "test",
      hostname: "host",
      status: "online",
      last_seen: 1000,
      first_seen: 900,
      cpu: { usage_percent: 42, core_count: 8, per_core: [40, 44] },
      memory: { usage_percent: 60, total_bytes: 8e9, used_bytes: 4.8e9, avail_bytes: 3.2e9 },
      disk: { usage_percent: 55, total_bytes: 1e11, used_bytes: 5.5e10, free_bytes: 4.5e10, path: "/" },
      network: { bytes_sent: 1000, bytes_recv: 2000, packets_sent: 10, packets_recv: 20 },
      load: { load1: 1.5, load5: 1.2, load15: 0.8 },
      containers: [],
    };

    const server = normalizeServer(raw);
    expect(server.cpu.usage_percent).toBe(42);
    expect(server.cpu.core_count).toBe(8);
    expect(server.memory.usage_percent).toBe(60);
  });
});
