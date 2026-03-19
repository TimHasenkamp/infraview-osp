import { notFound } from "next/navigation";
import { ServerDetail } from "../../_components/server-detail";
import { MetricChart } from "../../_components/metric-chart";
import { ContainerList } from "../../_components/container-list";
import { MOCK_SERVERS } from "../../_lib/mock-data";

export default async function ServerPage(props: PageProps<"/servers/[id]">) {
  const { id } = await props.params;
  const server = MOCK_SERVERS.find((s) => s.id === id);

  if (!server) {
    notFound();
  }

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 p-6 space-y-6">
        <ServerDetail server={server} />
        <MetricChart serverId={server.id} />
        <ContainerList containers={server.containers} serverId={server.id} />
      </main>
    </div>
  );
}
