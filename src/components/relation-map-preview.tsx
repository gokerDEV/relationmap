"use client";

import { AlertCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { parseAndRenderRelationMapSvg } from "@/lib/relationmap";

interface RelationMapPreviewProps {
  source: string;
}

export function RelationMapPreview({ source }: RelationMapPreviewProps) {
  const { result, svg, directPersonLinks } = useMemo(() => {
    const rendered = parseAndRenderRelationMapSvg(source, { showLegend: true });
    const nodeById = new Map(
      rendered.result.document.nodes.map((node) => [node.id, node]),
    );
    const directLinks = rendered.result.document.edges.filter((edge) => {
      const sourceNode = nodeById.get(edge.sourceId);
      const targetNode = nodeById.get(edge.targetId);
      return sourceNode?.type === "person" && targetNode?.type === "person";
    });

    return { ...rendered, directPersonLinks: directLinks };
  }, [source]);

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasValidationMessages = result.issues.length > 0 || directPersonLinks.length > 0;

  const handleWheel = (e: React.WheelEvent) => {
    if (!containerRef.current) return;
    const zoomFactor = 0.001;
    const delta = -e.deltaY * zoomFactor;
    const newScale = Math.min(Math.max(0.25, scale * (1 + delta)), 3);

    const containerRect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;
    const ratio = newScale / scale;

    setPan({
      x: mouseX - (mouseX - pan.x) * ratio,
      y: mouseY - (mouseY - pan.y) * ratio,
    });
    setScale(newScale);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPan((prev) => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const fitToWindow = useCallback(() => {
    if (!containerRef.current) return;
    const svgElement = containerRef.current.querySelector("svg");
    if (!svgElement) return;

    const viewBox = svgElement.viewBox.baseVal;
    if (!viewBox || viewBox.width === 0) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newScale =
      Math.min(
        containerRect.width / viewBox.width,
        containerRect.height / viewBox.height,
      ) * 0.95;
    const clampedScale = Math.min(Math.max(0.25, newScale), 3);

    setScale(clampedScale);
    setPan({
      x: (containerRect.width - viewBox.width * clampedScale) / 2,
      y: (containerRect.height - viewBox.height * clampedScale) / 2,
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "+" || e.key === "=") {
        setScale((prev) => Math.min(prev * 1.2, 3));
      } else if (e.key === "-") {
        setScale((prev) => Math.max(prev / 1.2, 0.25));
      } else if (e.key === "0") {
        fitToWindow();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fitToWindow]);

  const downloadSvg = () => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "relationmap.svg";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {hasValidationMessages && (
        <div className="absolute top-0 left-0 right-0 z-20 p-3 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm flex flex-col gap-1 max-h-48 overflow-auto">
          {result.issues.map((issue) => (
            <div
              key={`${issue.line}-${issue.code}`}
              className="flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Line {issue.line}: {issue.code} — {issue.message}
              </span>
            </div>
          ))}
          {directPersonLinks.map((edge) => (
            <div key={edge.id} className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Line {edge.line}: direct-person-link — Connect people through an
                event, place, institution, group, or family node.
              </span>
            </div>
          ))}
        </div>
      )}

      <ContextMenu>
        <ContextMenuTrigger
          ref={containerRef}
          className="flex-1 overflow-hidden bg-background relative cursor-grab active:cursor-grabbing"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: "0 0",
            }}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: The SVG output is generated by the local renderer.
            dangerouslySetInnerHTML={{ __html: svg }}
            className="absolute inset-0"
          />
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={fitToWindow}>Fit the window</ContextMenuItem>
          <ContextMenuItem onClick={downloadSvg}>Download SVG</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
