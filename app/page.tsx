import { Header } from "./_components/header";
import { ServerGrid } from "./_components/server-grid";
import { MOCK_SERVERS } from "./_lib/mock-data";

export default function DashboardPage() {
  const servers = MOCK_SERVERS;
  const onlineCount = servers.filter((s) => s.status === "online").length;

  return (
    <div className="flex flex-col min-h-screen">
      <Header serverCount={servers.length} onlineCount={onlineCount} />
      <main className="flex-1 p-6">
        <ServerGrid servers={servers} />
      </main>
    </div>
  );
}
