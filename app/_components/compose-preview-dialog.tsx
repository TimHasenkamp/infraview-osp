"use client";

import { useState, useRef, useEffect } from "react";
import { FileEdit, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { API_BASE_URL } from "../_lib/constants";
import { containerAction } from "../_lib/api-client";

interface ComposePreviewDialogProps {
  serverId: string;
  containerId: string;
  containerName: string;
  latestVersion: string;
  variant?: "icon" | "menuitem";
}

interface PreviewData {
  compose_file: string;
  service: string;
  current: string;
  proposed: string;
  error?: string;
}

export function ComposePreviewDialog({
  serverId,
  containerId,
  containerName,
  latestVersion,
  variant = "icon",
}: ComposePreviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!preview || loading) return;
    // Scroll to first changed line after render
    requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const changed = container.querySelector("[data-changed]") as HTMLElement | null;
      if (changed) {
        changed.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    });
  }, [preview, loading]);

  const fetchPreview = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/servers/${serverId}/containers/${containerId}/compose-preview?target_image=${encodeURIComponent(latestVersion)}`
      );
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        setOpen(false);
      } else {
        setPreview(data);
      }
    } catch {
      toast.error("Failed to fetch compose preview");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      await containerAction(serverId, containerId, "update_compose", latestVersion);
      toast.success(`Updating ${containerName} and compose file`);
      setOpen(false);
    } catch {
      toast.error("Failed to apply update");
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          onClick={fetchPreview}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-amber-400 hover:bg-amber-500/10 transition-colors"
          title="Update + edit Compose file"
        >
          <FileEdit className="h-4 w-4" />
        </button>
      ) : (
        <button
          onClick={fetchPreview}
          className="flex w-full items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm transition-colors"
        >
          <FileEdit className="h-4 w-4" />
          Update + Compose
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:!max-w-[95vw] w-[95vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileEdit className="h-4 w-4" />
              Compose Update Preview — {containerName}
            </DialogTitle>
            {preview && (
              <p className="text-xs text-muted-foreground font-mono">{preview.compose_file}</p>
            )}
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : preview ? (
            <div className="flex-1 overflow-auto" ref={scrollContainerRef}>
              <div className="font-mono text-xs leading-relaxed">
                {renderDiff(preview.current, preview.proposed)}
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={applying || loading}
              className="gap-1.5"
            >
              {applying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileEdit className="h-3.5 w-3.5" />
              )}
              Apply Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function renderDiff(current: string, proposed: string) {
  const currentLines = current.split("\n");
  const proposedLines = proposed.split("\n");
  const maxLen = Math.max(currentLines.length, proposedLines.length);

  const elements: React.ReactNode[] = [];

  for (let i = 0; i < maxLen; i++) {
    const curr = currentLines[i] ?? "";
    const prop = proposedLines[i] ?? "";

    if (curr !== prop) {
      if (curr) {
        elements.push(
          <div key={`del-${i}`} data-changed="" className="bg-red-500/15 text-red-400 px-3 py-0.5">
            <span className="select-none mr-2 text-red-400/50">-</span>
            {curr}
          </div>
        );
      }
      if (prop) {
        elements.push(
          <div key={`add-${i}`} data-changed="" className="bg-emerald-500/15 text-emerald-400 px-3 py-0.5">
            <span className="select-none mr-2 text-emerald-400/50">+</span>
            {prop}
          </div>
        );
      }
    } else {
      elements.push(
        <div key={`ctx-${i}`} className="text-muted-foreground px-3 py-0.5">
          <span className="select-none mr-2 opacity-30">&nbsp;</span>
          {curr}
        </div>
      );
    }
  }

  return <>{elements}</>;
}
