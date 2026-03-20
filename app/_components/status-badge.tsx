import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: "online" | "offline";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`gap-1.5 font-mono text-xs ${
        status === "online"
          ? "border-emerald-500/40 bg-emerald-950/50 text-emerald-400"
          : "border-red-500/40 bg-red-950/50 text-red-400"
      }`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          status === "online"
            ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)] animate-pulse"
            : "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.7)]"
        }`}
      />
      {status}
    </Badge>
  );
}
