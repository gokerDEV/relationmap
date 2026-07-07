# Alignment Algorithm Upgrade (Widest Generation Baseline)

## Problem
The current O(N^2) contour-based Reingold-Tilford algorithm pushes entire subtrees to the right to avoid collisions. While mathematically correct, it can result in large, asymmetric "voids" between cousin groups when one branch is much deeper/wider than another. Additionally, the title alignment appears broken due to absolute coordinate shifts not being properly centered relative to the drawn tree bounds.

## Proposed Changes

We will rewrite the generation-aware layout in `src/lib/familytree.ts` to use a "Widest Generation Baseline" approach, exactly as requested:

1.  **Group and Measure Generations:**
    *   Traverse the tree to group all `LayoutPerson` nodes by their `depth`.
    *   Within each depth, group individuals by their `family` (i.e., the union that produced them). Roots are treated as a single family group.
    *   Calculate the natural width of each generation:
        *   Gap between siblings (same family): `N = siblingGap`
        *   Gap between cousin groups (different families): `2N = siblingGap * 2`
        *   Total width = Sum of `spouseRowWidth`s + Sibling Gaps + Family Gaps.

2.  **Identify the Baseline (Max Depth):**
    *   Find the depth with the maximum natural width. This is the `anchorDepth`.
    *   This maximum width determines the `maxWidth` of the entire tree.

3.  **Layout the Baseline Generation:**
    *   Place all nodes in the `anchorDepth` linearly starting from `X = 0`, strictly applying the `N` and `2N` spacing rules.

4.  **Bottom-Up Ancestor Centering (Depths: anchorDepth-1 down to 0):**
    *   For each parent node, calculate its `X` by centering it perfectly over the bounding box of its children (who were placed in the layer below).

5.  **Top-Down Descendant Centering (Depths: anchorDepth+1 down to max):**
    *   For each family group, center the entire group perfectly under its parent union (which was placed in the layer above).
    *   *Self-Correction/Collision check:* To ensure descendants don't overlap if they are unexpectedly wide, we will apply a lightweight sweep-line push for descendants to maintain at least `2N` gap between families.

6.  **Fix Title Alignment:**
    *   The `contentWidth` will be precisely the `maxWidth` from the `anchorDepth` (plus any edge spillover). 
    *   The SVG Title `X` will be strictly `width / 2` to guarantee perfect centering.

## Verification
*   Compile and run the visual tree. 
*   Check that families at the widest generation have exactly `2N` gaps, and siblings have `N` gaps.
*   Check that the title is perfectly centered over the rendered tree bounding box.
