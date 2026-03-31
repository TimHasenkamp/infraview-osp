"use client";

import { useState, useCallback } from "react";
import { Trash2, RefreshCw, HardDrive, Package } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DockerImage } from "../_lib/types";
import { formatBytes } from "../_lib/utils";

interface ImageManagerProps {
  serverId: string;
}

export function ImageManager({ serverId }: ImageManagerProps) {
  const [images, setImages] = useState<DockerImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/servers/${serverId}/images`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to load images");
      setImages(data.images ?? []);
      setLoaded(true);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  const removeImages = useCallback(async (ids: string[]) => {
    setRemoving(true);
    try {
      const res = await fetch(`/api/proxy/servers/${serverId}/images`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_ids: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to remove images");
      // Refresh list after removal
      await fetchImages();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setRemoving(false);
    }
  }, [serverId, fetchImages]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const unusedImages = images.filter((img) => !img.in_use);
  const allUnusedSelected =
    unusedImages.length > 0 && unusedImages.every((img) => selected.has(img.id));

  const toggleSelectAllUnused = () => {
    if (allUnusedSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(unusedImages.map((img) => img.id)));
    }
  };

  const selectedList = Array.from(selected);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Docker Images
            {loaded && (
              <span className="text-muted-foreground font-normal text-sm">
                ({images.length} total, {unusedImages.length} unused)
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {selectedList.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                disabled={removing}
                onClick={() => removeImages(selectedList)}
                className="h-7 text-xs gap-1"
              >
                {removing ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
                Delete {selectedList.length} image{selectedList.length !== 1 ? "s" : ""}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={fetchImages}
              className="h-7 text-xs gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              {loaded ? "Refresh" : "Load Images"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-sm text-destructive mb-3">{error}</p>
        )}
        {loading && !loaded && (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        )}
        {loaded && images.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <HardDrive className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No images found</p>
          </div>
        )}
        {loaded && images.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={allUnusedSelected}
                    onChange={toggleSelectAllUnused}
                    title="Select all unused"
                    disabled={unusedImages.length === 0}
                  />
                </TableHead>
                <TableHead className="text-xs">Image</TableHead>
                <TableHead className="text-xs">Size</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {images.map((img) => {
                const primaryTag = img.tags[0] ?? img.id.slice(7, 19);
                const extraTags = img.tags.slice(1);
                return (
                  <TableRow
                    key={img.id}
                    className={`border-border/50 ${img.in_use ? "opacity-60" : ""}`}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={selected.has(img.id)}
                        disabled={img.in_use}
                        onChange={() => toggleSelect(img.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <span className="font-medium">{primaryTag}</span>
                      {extraTags.length > 0 && (
                        <span className="text-muted-foreground ml-1">+{extraTags.length}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatBytes(img.size_bytes)}
                    </TableCell>
                    <TableCell>
                      {img.in_use ? (
                        <Badge variant="default" className="text-xs">In use</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Unused</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!img.in_use && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          disabled={removing}
                          onClick={() => removeImages([img.id])}
                          title="Delete image"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
