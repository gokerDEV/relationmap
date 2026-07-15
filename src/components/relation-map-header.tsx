"use client";

import { buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RelationMapHowToSheet } from "./relation-map-how-to-sheet";

interface RelationMapHeaderProps {
  activeSample: string;
  samples: Array<{ id: string; label: string }>;
  onSelectSample: (sampleId: string) => void;
  onReset: () => void;
}

export function RelationMapHeader({
  activeSample,
  samples,
  onSelectSample,
  onReset,
}: RelationMapHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-4">
        <span className="font-semibold text-foreground">relationmap</span>
        <Select value={activeSample} onValueChange={onSelectSample}>
          <SelectTrigger className="w-[220px] h-8 text-xs">
            <SelectValue placeholder="Load a sample..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="custom">Custom</SelectItem>
            {samples.map((sample) => (
              <SelectItem key={sample.id} value={sample.id}>
                {sample.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={onReset}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Reset sample
        </button>
      </div>
      <div className="flex items-center gap-2">
        <RelationMapHowToSheet />
        <a
          href="https://github.com/gokerDEV/relationmap"
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          GitHub
        </a>
      </div>
    </header>
  );
}
