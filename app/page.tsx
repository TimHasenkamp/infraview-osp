import { Header } from "./_components/header";
import { ServerGrid } from "./_components/server-grid";
import { fetchServers } from "./_lib/server-api";
import { normalizeServer } from "./_lib/utils";

export default async function DashboardPage() {
  const rawServers = await fetchServers();
  const servers = rawServers.map(normalizeServer);
  const onlineCount = servers.filter((s) => s.status === "online").length;

  return (
    <div className="flex flex-col min-h-screen">
      <Header serverCount={servers.length} onlineCount={onlineCount} />
      <main className="flex-1 p-4 sm:p-6">
        <ServerGrid servers={servers} />
      </main>
    </div>
  );
}
