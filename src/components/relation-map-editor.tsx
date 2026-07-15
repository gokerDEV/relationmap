"use client";

import { markdown } from "@codemirror/lang-markdown";
import CodeMirror from "@uiw/react-codemirror";
import { useEffect, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { DEFAULT_RELATION_MAP_EXAMPLE } from "@/lib/relationmap";
import { RelationMapHeader } from "./relation-map-header";
import { RelationMapPreview } from "./relation-map-preview";

const RELATION_MAP_SOURCE_STORAGE_KEY = "relationmap.source";

export function RelationMapEditor() {
  const [source, setSource] = useState(DEFAULT_RELATION_MAP_EXAMPLE);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const storedSource = localStorage.getItem(RELATION_MAP_SOURCE_STORAGE_KEY);
    if (storedSource) setSource(storedSource);
  }, []);

  const handleSourceChange = (val: string) => {
    setSource(val);
    localStorage.setItem(RELATION_MAP_SOURCE_STORAGE_KEY, val);
  };

  const handleReset = () => {
    setSource(DEFAULT_RELATION_MAP_EXAMPLE);
    localStorage.setItem(RELATION_MAP_SOURCE_STORAGE_KEY, DEFAULT_RELATION_MAP_EXAMPLE);
  };

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden w-full">
      <RelationMapHeader onReset={handleReset} />

      <div className="flex-1 overflow-hidden w-full">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel
            defaultSize={42}
            minSize={25}
            className="flex flex-col border-r bg-background"
          >
            <div className="flex-1 overflow-auto h-full relative">
              <CodeMirror
                value={source}
                height="100%"
                extensions={[markdown()]}
                onChange={handleSourceChange}
                className="absolute inset-0"
              />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel
            defaultSize={58}
            minSize={35}
            className="flex flex-col bg-background relative"
          >
            <RelationMapPreview source={source} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
