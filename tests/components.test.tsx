import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../app/_components/status-badge";

// Mock the shadcn Badge component
vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

describe("StatusBadge", () => {
  it("renders online status", () => {
    render(<StatusBadge status="online" />);
    expect(screen.getByText("online")).toBeInTheDocument();
    const badge = screen.getByTestId("badge");
    expect(badge.className).toContain("emerald");
  });

  it("renders offline status", () => {
    render(<StatusBadge status="offline" />);
    expect(screen.getByText("offline")).toBeInTheDocument();
    const badge = screen.getByTestId("badge");
    expect(badge.className).toContain("red");
  });
});
