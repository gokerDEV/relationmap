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
const RELATION_MAP_CUSTOM_SOURCE_STORAGE_KEY = "relationmap.custom.source";
const RELATION_MAP_ACTIVE_SAMPLE_STORAGE_KEY = "relationmap.activeSample";

export type RelationMapSample = {
  id: string;
  label: string;
};

const RELATION_MAP_SAMPLES: RelationMapSample[] = [
  {
    id: "academic-political-network",
    label: "Academic / Political Path",
  },
  {
    id: "family-business-region",
    label: "Family / Business / Region",
  },
  {
    id: "union-board-network",
    label: "Union / Board / Media",
  },
  {
    id: "turkiye-1940",
    label: "Turkiye / Left / 1940"
  }
];

export function RelationMapEditor() {
  const [source, setSource] = useState(DEFAULT_RELATION_MAP_EXAMPLE);
  const [activeSample, setActiveSample] = useState("custom");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const storedSample =
      localStorage.getItem(RELATION_MAP_ACTIVE_SAMPLE_STORAGE_KEY) || "custom";
    const storedSource =
      localStorage.getItem(RELATION_MAP_SOURCE_STORAGE_KEY) ||
      localStorage.getItem(RELATION_MAP_CUSTOM_SOURCE_STORAGE_KEY) ||
      DEFAULT_RELATION_MAP_EXAMPLE;

    setActiveSample(storedSample);
    setSource(storedSource);

    if (storedSample !== "custom") {
      fetch(`/samples/${storedSample}.ftmd`)
        .then((res) => (res.ok ? res.text() : Promise.reject(res.statusText)))
        .then((text) => {
          setSource(text);
          localStorage.setItem(RELATION_MAP_SOURCE_STORAGE_KEY, text);
        })
        .catch(console.error);
    }
  }, []);

  const handleSourceChange = (val: string) => {
    setSource(val);
    setActiveSample("custom");
    localStorage.setItem(RELATION_MAP_SOURCE_STORAGE_KEY, val);
    localStorage.setItem(RELATION_MAP_CUSTOM_SOURCE_STORAGE_KEY, val);
    localStorage.setItem(RELATION_MAP_ACTIVE_SAMPLE_STORAGE_KEY, "custom");
  };

  const loadSample = async (sampleId: string) => {
    if (sampleId === "custom") {
      const customSource =
        localStorage.getItem(RELATION_MAP_CUSTOM_SOURCE_STORAGE_KEY) ||
        DEFAULT_RELATION_MAP_EXAMPLE;
      setSource(customSource);
      setActiveSample("custom");
      localStorage.setItem(RELATION_MAP_SOURCE_STORAGE_KEY, customSource);
      localStorage.setItem(RELATION_MAP_ACTIVE_SAMPLE_STORAGE_KEY, "custom");
      return;
    }

    try {
      const res = await fetch(`/samples/${sampleId}.ftmd`);
      if (!res.ok) throw new Error(`Failed to load sample ${sampleId}`);
      const text = await res.text();
      setSource(text);
      setActiveSample(sampleId);
      localStorage.setItem(RELATION_MAP_SOURCE_STORAGE_KEY, text);
      localStorage.setItem(RELATION_MAP_ACTIVE_SAMPLE_STORAGE_KEY, sampleId);
    } catch (e) {
      console.error(e);
    }
  };

  const handleReset = () => {
    if (activeSample !== "custom") {
      void loadSample(activeSample);
      return;
    }

    setSource(DEFAULT_RELATION_MAP_EXAMPLE);
    localStorage.setItem(RELATION_MAP_SOURCE_STORAGE_KEY, DEFAULT_RELATION_MAP_EXAMPLE);
    localStorage.setItem(
      RELATION_MAP_CUSTOM_SOURCE_STORAGE_KEY,
      DEFAULT_RELATION_MAP_EXAMPLE,
    );
  };

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden w-full">
      <RelationMapHeader
        activeSample={activeSample}
        samples={RELATION_MAP_SAMPLES}
        onSelectSample={loadSample}
        onReset={handleReset}
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
