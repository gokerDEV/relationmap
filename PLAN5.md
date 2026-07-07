You are working in this repo:

https://github.com/gokerDEV/familytree

Task:
Refactor the family tree SVG layout algorithm in `src/lib/familytree.ts`.

Important:
We are NOT changing the notation parser.
We are NOT changing the syntax.
We are NOT changing colors, statuses, line styles, deceased desaturation, context menu, preview behavior, or shadcn components.
This task is only about the render/layout algorithm.

Current problem:
The current layout code is becoming spaghetti. It uses ad-hoc fixed widths, partial contour logic, and render-time coordinate calculations. This creates unstable, asymmetric, hard-to-handle layouts.

The layout engine must become a deterministic, optimized, block-based tidy-tree algorithm.

Non-negotiable constraints:
- Do not change `parseFamilyTree`.
- Do not change notation syntax.
- Do not change visual config behavior.
- Preserve all current relationship colors.
- Preserve all current status color overrides.
- Preserve status visibility behavior.
- Preserve deceased desaturation behavior.
- Preserve connector shape support: `curved` and `elbow`.
- Preserve relationship line styles: `solid`, `dashed`, `dotted`.
- Preserve simplified status pill labels:
  - `[v]` renders as `v`
  - `[m]` renders as `m`
  - `[m:regent]` renders as `regent`
- Do not manually edit shadcn generated components.
- Keep changes focused on `src/lib/familytree.ts`.

Notation remains:

+      marriage / spouse
x+     divorced / former spouse
a+     adopted child relation
~      step / external relation
@id    explicit person id / same person reference
"..."  nickname
(...)  birth / death date
{...}  plain text info
[...]  status / inheritance / succession tag

Main layout rules:
1. The tree is bloodline-oriented, not gender-oriented.
2. The anchor person is the person in the bloodline branch.
3. Every spouse/former spouse is rendered on the same row as the anchor person.
4. A person must be rendered only once even if they have multiple spouses.
5. All spouses of the same anchor are placed to the right of that anchor.
6. Spouse gap is `n`.
7. Sibling gap is `2n`.
8. `n` should be derived from the existing layout gap options, preferably `partnerGap`.
9. Children must belong to a union/wedding node, never directly to a person.
10. Children of different marriages must not be flattened into the same child list.
11. Each leaf/person block must be horizontally centered under its own parent union/wedding node.
12. The whole rendered tree must be centered in the SVG.
13. The final SVG width/height must be computed from actual rendered bounds, not arbitrary fixed assumptions.

Critical wedding node rule:
Previously we considered placing the wedding node at the midpoint between the anchor and spouse. Do NOT do that.

For tracking clarity, the wedding node for each marriage must be placed directly under the spouse card center.

Example:

[Mehmet] [Fatma] [Sema]
           node1   node2

- Mehmet + Fatma children originate from the node under Fatma.
- Mehmet + Sema children originate from the node under Sema.
- This avoids visual confusion when the anchor has multiple spouses.

So for every union:
- partner/spouse card center defines the wedding node X.
- wedding node X = spouseCard.centerX.
- wedding node Y = spouseCard.bottomY + weddingOffset.
- Anchor-to-wedding connector still exists.
- Spouse-to-wedding connector is vertical or curved depending on connector shape.
- Children originate from that wedding node.

Required algorithm:
Implement a block-based tidy-tree layout.

Do not keep the current ad-hoc `assignCoordinates` algorithm.
Replace it with a clean, deterministic layout pipeline.

Recommended pipeline:

1. Build layout blocks from the parsed document.
2. Measure each block.
3. Recursively compute child subtree layouts.
4. Pack siblings using tidy-tree contour rules.
5. Center each child group under its own wedding node.
6. Compute actual bounds.
7. Normalize the whole tree into SVG coordinates.
8. Render using only precomputed coordinates.

Detailed model:

Create internal layout types similar to these. Exact names may differ, but these concepts must exist.

type LayoutPersonBlock = {
  kind: "person";
  node: FamilyTreePersonNode;
  personId: string;

  depth: number;
  incomingRelationKind: FamilyTreeRelationKind;
  parentUnionId?: string;

  // absolute coordinates after layout normalization
  x: number;
  y: number;

  // local coordinates before normalization
  localX: number;

  // anchor card
  anchor: LayoutCard;

  // spouses on the same generation row
  spouses: LayoutSpouse[];

  // one union per spouse relation
  unions: LayoutUnionBlock[];

  // measured subtree bounds
  width: number;
  height: number;

  // contour data for tidy packing
  leftContour: Map<number, number>;
  rightContour: Map<number, number>;
};

type LayoutSpouse = {
  personId: string;
  unionId: string;
  relationType: "spouse" | "formerSpouse";
  localX: number;
  localY: number;
  centerX: number;
};

type LayoutUnionBlock = {
  unionId: string;
  relationType: "spouse" | "formerSpouse";
  spousePersonId?: string;

  // wedding node is under spouse center, not midpoint
  weddingLocalX: number;
  weddingLocalY: number;

  children: LayoutPersonBlock[];

  childGroupLeft: number;
  childGroupWidth: number;
};

type LayoutCard = {
  localX: number;
  localY: number;
  width: number;
  height: number;
  centerX: number;
  bottomY: number;
};

Important structural rule:
Do not store children as a flat `LayoutPersonBlock.children` list.
Children must stay under their actual `LayoutUnionBlock`.

Bad:
PersonBlock.children = all children from all marriages

Good:
PersonBlock.unions[0].children = children from spouse A
PersonBlock.unions[1].children = children from spouse B

This is mandatory. It prevents Mehmet + Fatma children and Mehmet + Sema children from mixing.

Measurement rules:

Let:
- `cardW = options.cardWidth`
- `cardH = options.cardHeight`
- `n = options.partnerGap`
- `spouseGap = n`
- `siblingGap = 2 * n`
- `levelGap = options.levelGap`

For a person block:

Anchor card local position:
- anchor.localX = 0
- anchor.localY = 0

Spouse cards:
- first spouse localX = cardW + spouseGap
- second spouse localX = cardW + spouseGap + cardW + spouseGap
- etc.

So row layout is:

[Anchor] n [Spouse1] n [Spouse2] n [Spouse3]

Person row width:
- if no spouses: cardW
- if spouses: cardW + spouseCount * (spouseGap + cardW)

For each union:
- weddingLocalX = spouse.localX + cardW / 2
- weddingLocalY = cardH + weddingOffset

Do not use midpoint between anchor and spouse for weddingLocalX.

Recursive child layout:

For every union:
1. Recursively layout each child `LayoutPersonBlock`.
2. Pack child blocks left-to-right using sibling gap = `2n`.
3. Use tidy-tree contour packing so subtrees do not overlap.
4. After packing, compute childGroupWidth and center the group under the union’s wedding node.

Pseudo:

layoutUnionChildren(union):
  children = union.children

  if no children:
    childGroupWidth = 0
    return

  pack children with siblingGap = 2n using contour apportionment

  packedLeft = min child subtree left
  packedRight = max child subtree right
  packedWidth = packedRight - packedLeft

  desiredGroupLeft = union.weddingLocalX - packedWidth / 2

  shift all child blocks so group left = desiredGroupLeft

  union.childGroupLeft = desiredGroupLeft
  union.childGroupWidth = packedWidth

Tidy packing / contour requirement:

Implement a clean `packSiblings` helper.

The helper receives:
- an array of already measured child blocks
- gap = siblingGap = 2n

It returns child positions with minimal non-overlapping distance.

Use contours, not arbitrary fixed width.

Pseudo:

packSiblings(children, gap):
  placed = []

  place first child at x = 0

  for each next child:
    shift = minimum shift so next does not collide with placed aggregate

    for each depth where aggregateRightContour and nextLeftContour overlap:
      required = aggregateRightContour[depth] + gap - nextLeftContour[depth]
      shift = max(shift, required)

    apply shift to next child
    merge next contours into aggregate contours

Important:
The contour depth is relative to the child block root.
The block’s own row is depth 0.
Grandchildren are depth 1, etc.

This should be a proper tidy-tree style apportioning step.

Block bounds:
After child groups are laid out, compute block bounds from:
- anchor card
- all spouse cards
- all wedding nodes
- all child subtrees

The person block may extend to the left of anchor due to centered children.
That is allowed in local layout.

After bounds are computed:
- normalize the block local coordinates so its left bound becomes 0
- shift anchor, spouse cards, wedding nodes, and children accordingly
- block.width = right - left

Generation Y alignment:
All person blocks of the same depth must have the same Y.

Use:
- personY = depth * (cardH + levelGap)

Spouses share the same Y as the anchor person.
Wedding nodes live below the spouse row.
Children live at depth + 1.

This guarantees all siblings/cousins in the same generation are horizontally comparable and vertically aligned.

Parent-child alignment:
Every child group must be centered under its own union’s wedding node.

For example:

- Mehmet
  - x+ Fatma
    - Ali
    - Elif
  - + Sema
    - Bora

Expected:

[Mehmet] n [Fatma] n [Sema]
            node1     node2
              |         |
          Ali/Elif     Bora

- Ali and Elif are centered under Fatma’s wedding node.
- Bora is centered under Sema’s wedding node.
- Mehmet appears once.
- Fatma and Sema are on the same row as Mehmet.

Spacing rule:
- spouses in the same row: `n`
- siblings under the same wedding node: `2n`
- different child groups produced by different weddings are separated naturally by the spouse row and contour packing, but never less than `2n` if their subtrees overlap.

Centering rule:
The full tree must be centered based on actual bounds.

After all layout coordinates are computed:
1. Traverse every card, wedding node, and descendant block.
2. Compute actual `minX`, `maxX`, `minY`, `maxY`.
3. SVG width = max(640, maxX - minX + padding * 2)
4. SVG height = content height + padding + title + legend.
5. Normalize all X coordinates by `padding - minX`.
6. Normalize all Y coordinates by `padding + titleHeight - minY`.
7. Title X = svg width / 2.

Do not render from `startX = padding` blindly.
Do not rely on a fake content width.
Use actual bounds.

Render rules:
After layout is computed, rendering must not calculate layout coordinates anymore.

Bad:
renderPerson calculates partnerX or unionPoint on the fly.

Good:
renderPerson only draws:
- anchor card at precomputed x/y
- spouse card at precomputed x/y
- wedding node at precomputed x/y
- connectors from precomputed points

Rendering should be a pure drawing pass.

Connector semantics:
Keep all existing colors and styles.

But connector source/destination must be correct:

1. Anchor -> wedding node
   - color = spouse/formerSpouse relation color
   - line style = spouse/formerSpouse line style

2. Spouse -> wedding node
   - color = spouse/formerSpouse relation color
   - line style = spouse/formerSpouse line style

3. Wedding node -> child
   - color = child effective color
   - line style = child incoming relation line style

Child effective color:
- if child has visible status color, use status color
- otherwise use incoming relation color
- preserve deceased desaturation for card border only unless current behavior already applies it elsewhere

Do not turn every wedding-to-child line blue.
A child with `[v]` should have a red child branch.
A child with `[m:regent]` should have an inheritance/regent-colored child branch.
An adopted child should use adopted color/style if no visible status override exists.
A step child should use step color/style if no visible status override exists.

Connector shape:
Connector shape and line style are separate.

- shape = curved | elbow
- line style = solid | dashed | dotted

Curved:
- every edge path is a curved path
- no accidental horizontal `H` sibling bars

Elbow:
- every edge path is orthogonal
- do not use a shared sibling bar if it forces all children to share one color
- prefer one edge per child from wedding node to child anchor so each child edge can keep its own effective color

This is important:
A shared sibling bar makes child-specific edge colors ambiguous.
Use individual child edges from wedding node to each child anchor.

Legend:
Do not break current wrapped legend behavior.
If you touch legend, keep it measured/wrapped and non-overlapping.

What to remove/refactor:
The current layout functions should be replaced or heavily rewritten:

- current `LayoutPerson` / `LayoutUnion` types
- current `buildLayoutTree`
- current `assignCoordinates`
- current render-time partner/wedding coordinate calculations in `renderPerson` / `renderUnion`

Parser and visual config should remain intact.

Acceptance criteria:

1. Parser behavior unchanged.
2. Visual config behavior unchanged.
3. Person with multiple spouses renders once.
4. All spouses render on the same row as the anchor.
5. Spouse gap is `n`.
6. Sibling gap is `2n`.
7. Children are centered under their actual wedding node.
8. Wedding node is directly under the corresponding spouse card center.
9. Wedding node is not midpoint between anchor and spouse.
10. Child branches use child effective color.
11. Curved mode draws curved connectors everywhere.
12. Elbow mode draws orthogonal connectors everywhere.
13. No shared sibling bar that forces wrong child colors.
14. Full tree is centered in SVG using real bounds.
15. Title is centered over the SVG.
16. Same-depth people are vertically aligned.
17. Layout does not depend on arbitrary fixed total leaf widths.
18. Ottoman, Tudor, and Romanov samples render without huge asymmetric voids.
19. `bun run lint` passes.
20. `bun run build` passes.

Manual test cases:

Case 1: Simple couple

# Simple

- Ahmet
  - + Ayşe
    - Mehmet
    - Zeynep

Expected:
- Ahmet and Ayşe same row.
- Wedding node under Ayşe center.
- Mehmet and Zeynep centered under Ayşe’s wedding node.
- Mehmet/Zeynep gap = 2n.

Case 2: Multiple spouses

# Multiple spouses

- Mehmet
  - x+ Fatma
    - Ali
    - Elif
  - + Sema
    - Bora

Expected:
- Mehmet appears once.
- Fatma and Sema are same row as Mehmet.
- Fatma and Sema spacing = n.
- Fatma wedding node under Fatma center.
- Sema wedding node under Sema center.
- Ali/Elif centered under Fatma.
- Bora centered under Sema.

Case 3: Status colors

# Status colors

- Parent
  - + Spouse
    - First Child [v]
    - Second Child [m:regent]
    - a+ Adopted Child
    - ~ Step Child

Expected:
- First Child branch from wedding node is heir color.
- Second Child branch is inheritance/regent color.
- Adopted Child branch is adopted color/style.
- Step Child branch is step color/style.
- Status pills render as `v` and `regent`, not `[v]` or `[m:regent]`.

Case 4: Romanov sample

Use `public/samples/romanov.ftmd`.

Expected:
- No huge random horizontal voids.
- Child branches do not collapse into unrelated family groups.
- Spouse rows stay compact.
- Tree is centered.