import { notFound } from "next/navigation";
import { ServerDetail } from "../../_components/server-detail";
import { ServerTabs } from "../../_components/server-tabs";
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
      <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
        <ServerDetail server={server} />
        <ServerTabs serverId={server.id} containers={server.containers} />
      </main>
    </div>
  );
}
