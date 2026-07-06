"use client";

import { markdown } from "@codemirror/lang-markdown";
import CodeMirror from "@uiw/react-codemirror";
import { useEffect, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  DEFAULT_FAMILY_TREE_EXAMPLE,
  type FamilyTreeVisualConfig,
  mergeFamilyTreeVisualConfig,
} from "@/lib/familytree";
import { FamilyTreeHeader } from "./family-tree-header";
import { FamilyTreePreview } from "./family-tree-preview";

const FAMILY_TREE_VISUAL_CONFIG_STORAGE_KEY = "familytree.visual-config.v1";

export function FamilyTreeEditor() {
  const [source, setSource] = useState(DEFAULT_FAMILY_TREE_EXAMPLE);
  const [visualConfig, setVisualConfig] = useState<FamilyTreeVisualConfig>(() =>
    mergeFamilyTreeVisualConfig(),
  );
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const stored = localStorage.getItem(FAMILY_TREE_VISUAL_CONFIG_STORAGE_KEY);
    if (stored) {
      try {
        setVisualConfig(mergeFamilyTreeVisualConfig(JSON.parse(stored)));
      } catch (e) {
        console.error("Failed to parse stored visual config", e);
      }
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem(
        FAMILY_TREE_VISUAL_CONFIG_STORAGE_KEY,
        JSON.stringify(visualConfig),
      );
    }
  }, [visualConfig, isMounted]);

  const handleResetConfig = () => {
    setVisualConfig(mergeFamilyTreeVisualConfig());
  };

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden w-full">
      <FamilyTreeHeader
        visualConfig={visualConfig}
        setVisualConfig={setVisualConfig}
        onResetConfig={handleResetConfig}
      />

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
                onChange={setSource}
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
            <FamilyTreePreview source={source} visualConfig={visualConfig} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
