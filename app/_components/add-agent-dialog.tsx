"use client";

import { useState, useEffect } from "react";
import { Plus, Copy, Check, Terminal, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
      {children}
    </code>
  );
}

function CodeBlock({ code, filename }: { code: string; filename: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
          </div>
          <span className="font-mono text-xs text-muted-foreground">{filename}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={copy}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-emerald-500">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </Button>
      </div>
      <pre className="min-w-0 overflow-x-auto bg-muted/20 p-4 text-[12px] leading-relaxed font-mono text-foreground/90 whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

export function AddAgentDialog() {
  const [open, setOpen] = useState(false);
  const apiKey = useAgentSetup();
  const wsUrl = backendWsUrl();

  const key = apiKey ?? "<your-api-key>";

  const bashSnippet =
    `BACKEND_URL="${wsUrl}" \\\n` +
    `AGENT_API_KEY="${key}" \\\n` +
    `bash <(curl -sSL https://github.com/timhasenkamp/infraview-osp/releases/latest/download/install-agent.sh)`;

  const composeSnippet =
    `services:\n` +
    `  agent:\n` +
    `    image: ghcr.io/timhasenkamp/infraview-osp/agent:latest\n` +
    `    restart: unless-stopped\n` +
    `    pid: host\n` +
    `    env_file: .env\n` +
    `    volumes:\n` +
    `      - /var/run/docker.sock:/var/run/docker.sock:ro\n` +
    `      - /proc:/host/proc:ro\n` +
    `      - /var/lib/dpkg:/host-apt/dpkg:ro\n` +
    `      - /var/lib/apt/lists:/host-apt/lists:ro\n` +
    `      - /etc/apt:/host-apt/etc-apt:ro\n` +
    `    environment:\n` +
    `      - HOST_PROC=/host/proc\n` +
    `      - HOST_APT=/host-apt`;

  const envSnippet =
    `# Required\n` +
    `INFRAVIEW_BACKEND_URL=${wsUrl}\n` +
    `INFRAVIEW_API_KEY=${key}\n` +
    `\n` +
    `# Optional\n` +
    `INFRAVIEW_AGENT_ID=my-server-name\n` +
    `INFRAVIEW_INTERVAL=5\n` +
    `INFRAVIEW_DISK_PATH=/`;

  return (
    <>
      <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add Agent
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl gap-5 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-base">Deploy Agent</DialogTitle>
            <DialogDescription>
              Run the agent on any server you want to monitor — it will appear in the dashboard automatically once connected.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="bash" className="min-w-0">
            <TabsList className="w-full">
              <TabsTrigger value="bash" className="flex-1">
                <Terminal className="h-3.5 w-3.5" />
                Bash
              </TabsTrigger>
              <TabsTrigger value="compose" className="flex-1">
                {/* Docker logo approximation */}
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.98 11.08h2.12v-2.1h-2.12v2.1zm-3.06 0h2.13v-2.1H10.92v2.1zm-3.07 0h2.13v-2.1H7.85v2.1zm-3.06 0h2.12v-2.1H4.79v2.1zm6.13-3.06h2.13V5.9H10.92v2.12zm-3.07 0h2.13V5.9H7.85v2.12zm9.56 3.06h2.12v-2.1h-2.12v2.1zm1.97 1.63c-.07-.05-.44-.28-1.04-.28-.18 0-.36.02-.53.06-.12-.87-.79-1.3-1.08-1.48l-.22-.13-.15.2c-.17.26-.3.55-.35.85-.1.38-.04.74.14 1.05-.22.12-.57.16-.74.17H2.07c-.29 0-.52.23-.53.52-.03.82.1 1.64.4 2.42.34.85.84 1.48 1.49 1.87.72.43 1.9.68 3.26.68.6 0 1.23-.05 1.82-.19a7.3 7.3 0 002.43-1.07c.63-.43 1.13-.96 1.55-1.56h.14c.87 0 1.41-.35 1.71-.65.18-.18.32-.38.41-.58l.06-.15-.14-.1z" />
                </svg>
                Docker Compose
              </TabsTrigger>
              <TabsTrigger value="env" className="flex-1">
                <FileText className="h-3.5 w-3.5" />
                .env
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bash" className="mt-4 min-w-0 space-y-3">
              <p className="text-sm text-muted-foreground">
                One-liner for Debian, Ubuntu, Arch, and Alpine. Installs the binary and creates a <Kbd>systemd</Kbd> service.
              </p>
              <CodeBlock code={bashSnippet} filename="terminal" />
            </TabsContent>

            <TabsContent value="compose" className="mt-4 min-w-0 space-y-3">
              <p className="text-sm text-muted-foreground">
                Save as <Kbd>docker-compose.yml</Kbd> alongside your <Kbd>.env</Kbd>, then run{" "}
                <Kbd>docker compose up -d</Kbd>.
              </p>
              <CodeBlock code={composeSnippet} filename="docker-compose.yml" />
            </TabsContent>

            <TabsContent value="env" className="mt-4 min-w-0 space-y-3">
              <p className="text-sm text-muted-foreground">
                Save as <Kbd>.env</Kbd> in the same directory as your compose file.{" "}
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">API key pre-filled</Badge>
              </p>
              <CodeBlock code={envSnippet} filename=".env" />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
