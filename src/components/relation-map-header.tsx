"use client";

import { buttonVariants } from "@/components/ui/button";
import { RelationMapHowToSheet } from "./relation-map-how-to-sheet";

interface RelationMapHeaderProps {
  onReset: () => void;
}

export function RelationMapHeader({ onReset }: RelationMapHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-4">
        <span className="font-semibold text-foreground">relationmap</span>
        <button
          type="button"
          onClick={onReset}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Reset example
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
