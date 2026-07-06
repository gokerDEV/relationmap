You are working in this repo:

https://github.com/gokerDEV/familytree

Goal:
Fix the family tree SVG layout algorithm in `src/lib/familytree.ts`.

Current problems:
1. Spouses are too far away from the bloodline anchor person.
2. Spouses must be rendered on the same generation row as the anchor person.
3. If a person has multiple marriages/divorces, render the person only once and place all spouses on the same horizontal row to the right of that person.
4. Children must be generated from an invisible union point, not from the spouse card.
5. Parent-child connector lines must connect to the child person card, not to the center of that child’s entire subtree.
6. In the current layout, the parent connector for Mehmet Yılmaz visually falls around Fatma Demir because the child subtree center is used instead of Mehmet’s own anchor center.
7. When connector shape is set to `curved`, all connectors must be curved. No hard horizontal sibling bars or elbow-like trunk lines should remain in curved mode.
8. When connector shape is set to `elbow`, the classic orthogonal trunk / sibling bar / vertical drop layout is acceptable.

Do not change the notation.
Do not change the parser syntax.
Do not modify shadcn generated component files manually.
Keep the work focused on the library layout and the existing config UI if needed.

Notation must continue to support:

+      marriage / spouse
x+     divorced / former spouse
a+     adopted child relation
~      step / external relation
@id    explicit person id / same person reference
"..."  nickname
(...)  birth / death date
{...}  plain text info
[...]  status / inheritance / succession tag

Important semantic rule:
The tree is bloodline-oriented, not gender-oriented.
The anchor person is the bloodline person in the current branch.
Every spouse/former spouse must be placed to the right of the anchor person, regardless of gender.

Expected visual behavior:

For this notation:

# Yılmaz Krallığı / Ailesi

- Ahmet Yılmaz @ahmet1945 "Kral Ahmet" (1945)
  - + Ayşe Yılmaz @ayse1948 "Kraliçe Ayşe" (1948)
    - Mehmet Yılmaz @mehmet1972 "Büyük Oğul" (1972)
      - x+ Fatma Demir @fatma1974 (1974)
        - Ali Yılmaz @ali1998 (1998)
        - Elif Yılmaz @elif2001 [v] (2001)
        - a+ Ece Yılmaz @ece2004 (2004)
      - + Sema Kaya @sema1978 (1978)
        - ~ Bora Kaya @bora2005 (2005)
    - Zeynep Yılmaz @zeynep1975 [v] (1975)
      - x+ Kemal Arslan @kemal1973 (1973)
        - Mert Arslan @mert1999 (1999)
        - Deniz Arslan @deniz2002 (2002)
        - a+ Ekin Arslan @ekin2006 (2006)

Expected layout shape:

[Ahmet] [Ayşe]
        union
          |
      children...

[Mehmet] [Fatma] [Sema]
          union    union
            |        |
       children... step child...

[Zeynep] [Kemal]
          union
            |
       children...

Critical rendering rules:
- Ahmet and Ayşe must be near each other, not separated by the width of the entire subtree.
- Mehmet and Fatma must be near each other.
- Mehmet and Sema must also be on the same row as Mehmet.
- Mehmet must not be repeated for each marriage.
- All spouses of Mehmet must be on Mehmet’s right side.
- Children of Mehmet + Fatma must visually originate from the Mehmet/Fatma union point.
- Bora must originate from the Mehmet/Sema union point.
- The connector from Ahmet/Ayşe to Mehmet must end at Mehmet’s card anchor, not at the center of Mehmet’s full subtree.
- No connector should pass through a person card.

Implementation requirements:

1. Refactor layout types in `src/lib/familytree.ts`.

Separate these concepts:

- anchor card position
- anchor center position
- spouse row width
- children subtree width
- total allocated width

Do not use `child.width / 2` as the target for parent-child connectors. That is the subtree center and causes wrong lines.

Add explicit offsets similar to:

type LayoutPerson = Size & {
  kind: "person";
  node: FamilyTreePersonNode;
  unions: LayoutUnion[];

  anchorCardXOffset: number;
  anchorCenterOffset: number;

  spouseRowWidth: number;
  subtreeWidth: number;
};

type LayoutUnion = Size & {
  kind: "union";
  node: FamilyTreeUnionNode;
  visiblePartnerIds: string[];
  children: LayoutPerson[];

  rowWidth: number;
  childrenWidth: number;
  subtreeWidth: number;
};

Exact names can differ, but the concepts must exist.

2. Fix `layoutPerson`.

Current problem:
The layout allows union subtree width to push spouse cards far away from the anchor.

Required behavior:
- The anchor card should stay at the left side of its generation group.
- Spouses should start immediately to the right of the anchor card.
- The horizontal gap between anchor and first spouse should use `partnerGap`.
- The horizontal gap between spouses should use `partnerGap`.
- The subtree width of children must not increase the distance between anchor and spouse.
- Subtree width can increase total allocation, but it must not shift the spouse row apart.

3. Fix `layoutUnion`.

Current problem:
A union width combines partner row and children width in a way that spreads spouses too much.

Required behavior:
- Partner row width must be based only on partner cards and partner gaps.
- Children subtree width must be calculated separately.
- Total union width can be `Math.max(rowWidth, childrenWidth)`.
- Partner card X positions must be based on the spouse row, not on the whole children subtree center.

4. Fix `renderPerson`.

Required behavior:
- Render the anchor person once.
- Render all unions/spouses of that person on the same Y coordinate as the anchor.
- All spouses/former spouses must be positioned to the right of the anchor.
- Multiple unions must advance by partner row width, not by subtree width.
- Child subtrees can still allocate below each union.

In other words:
The top row should behave like:

[Anchor] gap [Spouse A] gap [Spouse B] gap [Spouse C]

not like:

[Anchor] .... huge subtree spacing .... [Spouse]

5. Fix parent-child connector targeting.

Current wrong behavior:
Children are connected using:

childCenter = childX + child.width / 2

Required behavior:
Use the child person’s actual anchor center:

childAnchorCenter = childX + child.anchorCenterOffset

or equivalent.

This is mandatory. It fixes the connector landing around Fatma instead of Mehmet.

6. Split curved and elbow child distribution.

Current problem:
Even with connector shape `curved`, some child distribution lines are rendered as hard horizontal lines using SVG `H`.

Required behavior:

If `visualConfig.connectors.shape === "curved"`:
- Do not draw horizontal sibling bars.
- Do not draw hard trunk lines.
- Draw a separate curved connector from the union point to each child’s anchor top/center.
- All connectors should use the same curved path function.

If `visualConfig.connectors.shape === "elbow"`:
- Use orthogonal connector style.
- Horizontal sibling bar is acceptable.
- Vertical drops are acceptable.

Create separate helpers if useful:

renderCurvedChildren(...)
renderElbowChildren(...)

or:

drawChildrenConnectors(...)

with branching inside.

7. Keep line styles working.

Relationship line styles must still work:
- solid
- dashed
- dotted

Connector shape and line style are different concepts:
- connector shape = curved vs elbow
- line style = solid/dashed/dotted

For example:
- curved + dashed should draw a dashed curved path
- elbow + dotted should draw a dotted orthogonal path

8. Keep status color override behavior.

Do not break:
- [v] heir/successor color override
- [m] inheritance override
- [x] excluded override
- [red] renounced override
- [will] testament override

If a status visibility is disabled, the person should still render using its underlying relationship color.
Do not hide the person.

9. Keep deceased desaturation behavior.

Do not break:
- deathDate detection
- deceased desaturation slider
- default 50%

10. Keep config model backward-safe.

Existing localStorage configs may not have `connectors`.
`mergeFamilyTreeVisualConfig` must safely merge missing nested config fields.

Example:
If stored config is missing `connectors`, use default:

connectors: {
  shape: "curved"
}

11. Update `src/components/family-tree-how-to-sheet.tsx` only if needed.

The UI already exposes connector shape.
Make sure it still compiles with the final `FamilyTreeVisualConfig` type.

Do not manually edit shadcn/ui generated files.

12. Validation examples.

After the change, visually check these scenarios:

A. Simple couple:
- Ahmet
  - + Ayşe
    - Mehmet
    - Zeynep

Expected:
Ahmet and Ayşe are same row and close.
Children originate below their union point.

B. Multiple marriages:
- Mehmet
  - x+ Fatma
    - Ali
    - Elif
  - + Sema
    - ~ Bora

Expected:
Mehmet appears once.
Fatma and Sema are both on Mehmet’s right and same row.
Ali/Elif originate from Mehmet/Fatma union.
Bora originates from Mehmet/Sema union.

C. Adopted child:
- Mehmet
  - + Fatma
    - a+ Ece

Expected:
Ece uses adopted color and adopted line style.

D. Curved connector mode:
All connector paths should be curved.
There should be no hard horizontal sibling bar.

E. Elbow connector mode:
Orthogonal connectors are acceptable.

13. Run checks.

Run:

bun run lint
bun run build

Fix TypeScript/Biome errors.

14. Open a PR.

PR title:
Fix spouse alignment and connector routing

PR body should include:
- spouses now render on the same row as the anchor person
- anchor person is not repeated for multiple marriages/divorces
- parent-child connectors target child anchor cards instead of subtree centers
- curved mode now renders all connectors as curves
- elbow mode keeps orthogonal routing
- notation unchanged