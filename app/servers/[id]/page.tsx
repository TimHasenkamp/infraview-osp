import { notFound } from "next/navigation";
import { ServerDetail } from "../../_components/server-detail";
import { MetricChart } from "../../_components/metric-chart";
import { ContainerList } from "../../_components/container-list";
import { ProcessList } from "../../_components/process-list";
import { UpdatesPanel } from "../../_components/updates-panel";
import { fetchServer } from "../../_lib/server-api";
import { normalizeServer } from "../../_lib/utils";

export default async function ServerPage(props: PageProps<"/servers/[id]">) {
  const { id } = await props.params;
  const rawServer = await fetchServer(id);

  if (!rawServer) {
    notFound();
  }

  const server = normalizeServer(rawServer);

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 p-6 space-y-6">
        <ServerDetail server={server} />
        <MetricChart serverId={server.id} />
        <UpdatesPanel serverId={server.id} />
        <ProcessList processes={[]} serverId={server.id} />
        <ContainerList containers={server.containers} serverId={server.id} />
      </main>
    </div>
  );
}
