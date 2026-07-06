"use client";

import { buttonVariants } from "@/components/ui/button";
import type { FamilyTreeVisualConfig } from "@/lib/familytree";
import { FamilyTreeHowToSheet } from "./family-tree-how-to-sheet";

interface FamilyTreeHeaderProps {
  visualConfig: FamilyTreeVisualConfig;
  setVisualConfig: React.Dispatch<React.SetStateAction<FamilyTreeVisualConfig>>;
  onResetConfig: () => void;
}

export function FamilyTreeHeader({
  visualConfig,
  setVisualConfig,
  onResetConfig,
}: FamilyTreeHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-foreground">family tree</span>
      </div>
      <div className="flex items-center gap-2">
        <FamilyTreeHowToSheet
          visualConfig={visualConfig}
          setVisualConfig={setVisualConfig}
          onResetConfig={onResetConfig}
        />
        <a
          href="https://github.com/gokerm/familytree"
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
