"use client";

import { useState, useEffect } from "react";
import { Plus, Copy, Check, Terminal, Container, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API_BASE_URL } from "../_lib/constants";

function useAgentSetup() {
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/agent/setup`)
      .then((r) => r.json())
      .then((d) => setApiKey(d.api_key ?? null))
      .catch(() => setApiKey(null));
  }, []);

  return apiKey;
}

function backendWsUrl() {
  if (typeof window === "undefined") return "wss://your-backend/ws/agent";
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws/agent`;
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border border-border rounded-t-md text-xs text-muted-foreground">
        <span>{label}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="bg-muted/30 border border-t-0 border-border rounded-b-md p-4 text-xs font-mono overflow-x-auto whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

export function AddAgentDialog() {
  const [open, setOpen] = useState(false);
  const apiKey = useAgentSetup();
  const wsUrl = backendWsUrl();

  const bashSnippet = `BACKEND_URL="${wsUrl}" \\
  AGENT_API_KEY="${apiKey ?? "<your-api-key>"}" \\
  bash <(curl -sSL https://github.com/timhasenkamp/infraview-osp/releases/latest/download/install-agent.sh)`;

  const composeSnippet = `services:
  agent:
    image: ghcr.io/timhasenkamp/infraview-osp/agent:latest
    restart: unless-stopped
    pid: host
    env_file: .env
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /proc:/host/proc:ro
      - /var/lib/dpkg:/host-apt/dpkg:ro
      - /var/lib/apt/lists:/host-apt/lists:ro
      - /etc/apt:/host-apt/etc-apt:ro
    environment:
      - HOST_PROC=/host/proc
      - HOST_APT=/host-apt`;

  const envSnippet = `# Required
INFRAVIEW_BACKEND_URL=${wsUrl}
INFRAVIEW_API_KEY=${apiKey ?? "<your-api-key>"}

# Optional
INFRAVIEW_AGENT_ID=my-server-name
INFRAVIEW_INTERVAL=5
INFRAVIEW_DISK_PATH=/`;

  return (
    <>
      <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add Agent
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Deploy Agent</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground -mt-1">
            Run the agent on any server you want to monitor. It will appear here automatically once connected.
          </p>

          <Tabs defaultValue="bash">
            <TabsList className="w-full">
              <TabsTrigger value="bash" className="flex-1 gap-1.5">
                <Terminal className="h-3.5 w-3.5" />
                Bash Script
              </TabsTrigger>
              <TabsTrigger value="compose" className="flex-1 gap-1.5">
                <Container className="h-3.5 w-3.5" />
                Docker Compose
              </TabsTrigger>
              <TabsTrigger value="env" className="flex-1 gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                .env
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bash" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                One-liner for Debian/Ubuntu/Arch/Alpine. Installs the binary and sets up a systemd service.
              </p>
              <CodeBlock code={bashSnippet} label="shell" />
            </TabsContent>

            <TabsContent value="compose" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Save as <code className="text-xs bg-muted px-1 py-0.5 rounded">docker-compose.yml</code> next to your{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">.env</code> file, then run{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">docker compose up -d</code>.
              </p>
              <CodeBlock code={composeSnippet} label="docker-compose.yml" />
            </TabsContent>

            <TabsContent value="env" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Save as <code className="text-xs bg-muted px-1 py-0.5 rounded">.env</code> in the same directory as your compose file.
              </p>
              <CodeBlock code={envSnippet} label=".env" />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
