import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: "online" | "offline";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge
      variant={status === "online" ? "default" : "destructive"}
      className="gap-1.5 font-mono text-xs"
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          status === "online"
            ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
            : "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]"
        }`}
      />
      {status}
    </Badge>
  );
}
