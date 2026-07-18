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
                {`- A Person @a
  - > i:school "School" [student]
    - > g:company "Company" [founder]

- B Person @b
  - > i:school [classmate]
    - > g:company [board]`}
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="font-medium">No direct person-to-person links</h3>
              <p className="text-muted-foreground leading-6">
                Two people should not be connected directly. Use the shared
                event, place, institution, group, family, publication, or
                document that explains the relationship.
              </p>
              <div className="font-mono bg-muted p-3 rounded-md text-muted-foreground whitespace-pre overflow-auto">
                {`// Avoid
- A Person @a
  - ~> @b [friend]

// Prefer
- A Person @a
  - > e:school_circle "School circle" [friendship]
    - > i:school "School" [place]
    - ~> @b "B Person" [participant]

- B Person @b
  - > e:school_circle [friendship]
    - > i:school [place]`}
              </div>
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
[...]  relation or node tags
(...)  date or date range
{...}  plain note`}
              </div>
              <p className="text-muted-foreground leading-6">
                A node keeps the same id everywhere. The renderer keeps nodes
                neutral and colors the path by the top-level subject, so one
                person's route can be followed across schools, groups, companies,
                events, regions, and mediated people.
              </p>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
