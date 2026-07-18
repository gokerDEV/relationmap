"use client";

import { buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function RelationMapHowToSheet() {
  return (
    <Sheet>
      <SheetTrigger
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        How to
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[85vw] data-[side=left]:max-w-full! data-[side=left]:w-xl flex flex-col gap-0 p-0"
      >
        <SheetHeader className="p-6 pb-2 text-left">
          <SheetTitle>RelationMap notation</SheetTitle>
          <SheetDescription>
            Write people, families, institutions, organizations, places, events,
            and their chronological paths.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1 min-h-0 p-6 pt-4">
          <div className="flex flex-col gap-6 text-sm">
            <section className="space-y-3">
              <h3 className="font-medium">Core idea</h3>
              <p className="text-muted-foreground leading-6">
                Top-level rows are the subjects you want to follow. Nested rows
                are their path. If A and B met at the same university, both paths
                should point to the same institution node. If the relationship
                continues later in an organization, nest that organization under
                the institution.
              </p>
              <div className="font-mono bg-muted p-3 rounded-md text-muted-foreground whitespace-pre overflow-auto">
                {`- A Person @a #7c3aed
  - > i:school "School" [student]
    - > g:company "Company" [founder]

- B Person @b #059669
  - > i:school [classmate]
    - > g:company [board]`}
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="font-medium">No person targets in relation lines</h3>
              <p className="text-muted-foreground leading-6">
                People are subjects, not nested relation targets. Do not connect
                a person to another person, and do not put people under an event
                node. Instead, make every person point to the same shared event,
                place, institution, group, family, publication, or document node.
              </p>
              <div className="font-mono bg-muted p-3 rounded-md text-muted-foreground whitespace-pre overflow-auto">
                {`// Avoid
- A Person @a
  - ~> @b [friend]

// Also avoid
- A Person @a
  - > e:school_circle "School circle" [friendship]
    - ~> @b "B Person" [participant]

// Prefer
- A Person @a #7c3aed
  - > e:school_circle "School circle" [friendship]
    - > i:school "School" [place]

- B Person @b #059669
  - > e:school_circle [friendship]
    - > i:school [place]`}
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="font-medium">Colors</h3>
              <p className="text-muted-foreground leading-6">
                Add <code>#hex</code> to a person to color that person card and
                all path lines coming from that top-level subject. Relation nodes
                are gray by default. Add <code>#hex</code> to an event, group,
                institution, place, family, media, sector, or document only when
                that node needs an accent color.
              </p>
              <div className="font-mono bg-muted p-3 rounded-md text-muted-foreground whitespace-pre overflow-auto">
                {`- Behice Boran @behice #7c3aed [academic]
  - > i:dtcf "DTCF" [faculty]
    - x> e:dtcf_purge_1948 "DTCF purge" #dc2626 [purged]`}
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="font-medium">Stable depth</h3>
              <p className="text-muted-foreground leading-6">
                Indentation creates the logical order of the path. A reused node
                is placed at the deepest indentation where it appears. The layout
                does not repeatedly push shared nodes to the right, so repeated
                references do not explode into an unreadable horizontal chain.
              </p>
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="font-medium">Node ids</h3>
              <div className="font-mono bg-muted p-3 rounded-md text-muted-foreground whitespace-pre overflow-auto">
                {`@id   person
f:id  family
g:id  group / party / union / company / organization
i:id  institution / school / university
p:id  place / city / region / country
e:id  event / congress / election / foundation
m:id  media / publication / journal
s:id  sector / ideology / field
d:id  document / source`}
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="font-medium">Relation operators</h3>
              <div className="font-mono bg-muted p-3 rounded-md text-muted-foreground whitespace-pre overflow-auto">
                {`>    confirmed / direct relation
~>   weak / informal / social relation
?>   claimed / needs source
x>   ended / split / left / disproved
!>   critical relation`}
              </div>
            </section>

            <Separator />

            <section className="space-y-3 pb-8">
              <h3 className="font-medium">Fields</h3>
              <div className="font-mono bg-muted p-3 rounded-md text-muted-foreground whitespace-pre overflow-auto">
                {`"..."  first-use display label for a node
#hex   optional node color
[...]  relation or node tags
(...)  date or date range
{...}  plain note`}
              </div>
              <p className="text-muted-foreground leading-6">
                A node keeps the same id everywhere. The renderer keeps relation
                nodes neutral and colors paths by the top-level subject, so one
                person&apos;s route can be followed across schools, groups,
                companies, events, regions, and mediated relations.
              </p>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
