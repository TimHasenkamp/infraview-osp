import Link from "next/link";
import { Activity, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  serverCount: number;
  onlineCount: number;
}

export function Header({ serverCount, onlineCount }: HeaderProps) {
  const allOnline = onlineCount === serverCount;

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 text-primary">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">InfraView</h1>
            <p className="text-xs text-muted-foreground">Server Monitoring</p>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/alerts">
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
              <Bell className="h-4 w-4" />
            </Button>
          </Link>
          <Badge
            variant={allOnline ? "default" : "destructive"}
            className="gap-1.5 text-sm px-3 py-1"
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                allOnline
                  ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                  : "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]"
              }`}
            />
            {onlineCount}/{serverCount} online
          </Badge>
        </div>
      </div>
    </header>
  );
}
