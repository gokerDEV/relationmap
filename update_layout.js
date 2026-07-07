const fs = require("fs");
let code = fs.readFileSync("src/lib/familytree.ts", "utf8");

// 1. Replace types
const typesStart = code.indexOf("type LayoutPerson = Size & {");
const typesEnd = code.indexOf("type RenderContext = {");
if (typesStart !== -1 && typesEnd !== -1) {
  const newTypes = `type LayoutPerson = {
  kind: "person";
  node: FamilyTreePersonNode;
  unions: LayoutUnion[];
  spouseRowWidth: number;
  x: number;
  y: number;
  children: LayoutPerson[];
};

type LayoutUnion = {
  kind: "union";
  node: FamilyTreeUnionNode;
  visiblePartnerIds: string[];
  children: LayoutPerson[];
  partnerRowWidth: number;
};

`;
  code = code.substring(0, typesStart) + newTypes + code.substring(typesEnd);
}

// 2. Replace layoutPerson and layoutUnion with buildLayoutTree and assignCoordinates
const layoutFuncStart = code.indexOf("function layoutPerson(");
const layoutFuncEnd = code.indexOf("function renderPerson(");
if (layoutFuncStart !== -1 && layoutFuncEnd !== -1) {
  const newLayoutFuncs = `function buildLayoutTree(
  node: FamilyTreePersonNode,
  context: RenderContext,
): LayoutPerson {
  const lp: LayoutPerson = {
    kind: "person",
    node,
    unions: [],
    children: [],
    spouseRowWidth: 0,
    x: 0,
    y: 0,
  };

  let partnerCount = 0;
  for (const u of node.unions) {
    const union = context.unionById.get(u.unionId);
    const visiblePartnerIds = union
      ? union.partnerIds.filter((id) => id !== union.anchorPersonId)
      : [];
    partnerCount += visiblePartnerIds.length;

    const lu: LayoutUnion = {
      kind: "union",
      node: u,
      visiblePartnerIds,
      children: [],
      partnerRowWidth:
        visiblePartnerIds.length * context.options.cardWidth +
        Math.max(0, visiblePartnerIds.length - 1) * context.options.partnerGap,
    };

    for (const childNode of u.children) {
      const childLp = buildLayoutTree(childNode, context);
      lu.children.push(childLp);
      lp.children.push(childLp);
    }
    lp.unions.push(lu);
  }

  lp.spouseRowWidth =
    context.options.cardWidth +
    (partnerCount > 0 ? context.options.partnerGap : 0) +
    partnerCount * context.options.cardWidth +
    Math.max(0, partnerCount - 1) * context.options.partnerGap;

  return lp;
}

function assignCoordinates(
  roots: LayoutPerson[],
  context: RenderContext,
): { width: number; height: number } {
  const rightmostXAtDepth: number[] = [];

  function getAbsoluteLeftContour(
    node: LayoutPerson,
    depth: number,
    contour: Map<number, number>,
  ) {
    for (const child of node.children) {
      if (!contour.has(depth + 1) || child.x < contour.get(depth + 1)!) {
        contour.set(depth + 1, child.x);
      }
      getAbsoluteLeftContour(child, depth + 1, contour);
    }
  }

  function getAbsoluteRightContour(
    node: LayoutPerson,
    depth: number,
    contour: Map<number, number>,
  ) {
    const rightX = node.x + node.spouseRowWidth;
    if (!contour.has(depth) || rightX > contour.get(depth)!) {
      contour.set(depth, rightX);
    }
    for (const child of node.children) {
      getAbsoluteRightContour(child, depth + 1, contour);
    }
  }

  function shiftSubtree(node: LayoutPerson, shift: number) {
    for (const child of node.children) {
      child.x += shift;
      shiftSubtree(child, shift);
    }
  }

  function layoutNode(node: LayoutPerson, depth: number) {
    for (const child of node.children) {
      layoutNode(child, depth + 1);
    }

    let preferredX = rightmostXAtDepth[depth] || 0;
    if (node.children.length > 0) {
      const first = node.children[0];
      const last = node.children[node.children.length - 1];
      const mid = (first.x + last.x + last.spouseRowWidth) / 2;
      preferredX = Math.max(preferredX, mid - node.spouseRowWidth / 2);
    }

    let shift = 0;
    const nodeReqX = rightmostXAtDepth[depth] || 0;
    if (preferredX < nodeReqX) {
      shift = Math.max(shift, nodeReqX - preferredX);
    }

    const leftContour = new Map<number, number>();
    getAbsoluteLeftContour(node, depth, leftContour);
    for (const [d, absX] of leftContour.entries()) {
      const reqX = rightmostXAtDepth[d] || 0;
      if (absX + shift < reqX) {
        shift = Math.max(shift, reqX - absX);
      }
    }

    node.x = preferredX + shift;
    node.y = depth * (context.options.cardHeight + context.options.levelGap);

    if (shift > 0 && node.children.length > 0) {
      shiftSubtree(node, shift);
    }

    const rightContour = new Map<number, number>();
    getAbsoluteRightContour(node, depth, rightContour);
    for (const [d, absX] of rightContour.entries()) {
      rightmostXAtDepth[d] = Math.max(
        rightmostXAtDepth[d] || 0,
        absX + context.options.siblingGap,
      );
    }
  }

  for (const root of roots) {
    layoutNode(root, 0);
  }

  return {
    width: rightmostXAtDepth.length > 0 ? Math.max(0, ...rightmostXAtDepth.map((x) => x - context.options.siblingGap)) : 0,
    height: rightmostXAtDepth.length > 0 ? rightmostXAtDepth.length * (context.options.cardHeight + context.options.levelGap) - context.options.levelGap : 0,
  };
}

`;
  code =
    code.substring(0, layoutFuncStart) +
    newLayoutFuncs +
    code.substring(layoutFuncEnd);
}

// 3. Replace renderPerson and renderUnion
const renderFuncStart = code.indexOf("function renderPerson(");
const renderFuncEnd = code.indexOf("function renderCard(");
if (renderFuncStart !== -1 && renderFuncEnd !== -1) {
  const newRenderFuncs = `function renderPerson(
  layout: LayoutPerson,
  offsetX: number,
  offsetY: number,
  context: RenderContext,
): Point {
  const cardX = offsetX + layout.x;
  const cardY = offsetY + layout.y;
  const person = context.personById.get(layout.node.personId);
  const anchorBottom = renderCard(
    person,
    cardX,
    cardY,
    context,
    layout.node.incomingRelationKind,
  );
  
  if (!layout.unions.length) return anchorBottom;

  let currentPartnerX = cardX + context.options.cardWidth + context.options.partnerGap;

  for (const union of layout.unions) {
    renderUnion(
      union,
      currentPartnerX,
      offsetY,
      offsetX,
      context,
      anchorBottom,
    );
    currentPartnerX += union.partnerRowWidth + context.options.partnerGap;
  }
  return anchorBottom;
}

function renderUnion(
  layout: LayoutUnion,
  partnerX: number,
  offsetY: number,
  offsetX: number,
  context: RenderContext,
  anchor?: Point,
): Point {
  const union = context.unionById.get(layout.node.unionId);
  const relationType = union?.kind === "former" ? "formerSpouse" : "spouse";
  let px = partnerX;
  const partnerBottoms: Point[] = [];

  for (const partnerId of layout.visiblePartnerIds) {
    const bottom = renderCard(
      context.personById.get(partnerId),
      px,
      anchor ? anchor.y - context.options.cardHeight : offsetY, // hack to get Y, since we only pass bottom point
      context,
      relationType,
    );
    partnerBottoms.push(bottom);
    px += context.options.cardWidth + context.options.partnerGap;
  }

  const partnerCenter = partnerBottoms.length
    ? partnerBottoms.reduce((sum, p) => sum + p.x, 0) / partnerBottoms.length
    : partnerX + layout.partnerRowWidth / 2;

  const unionPoint = {
    x: anchor ? (anchor.x + partnerCenter) / 2 : partnerCenter,
    y: (anchor ? anchor.y - context.options.cardHeight : offsetY) + context.options.cardHeight + 26,
  };

  for (const bottom of partnerBottoms) {
    drawConnector(bottom, unionPoint, context, relationType);
  }
  if (anchor) drawConnector(anchor, unionPoint, context, relationType);

  const bloodlineRule = context.visualConfig.relations.biological;

  context.parts.push(
    \`<circle cx="\${Math.round(unionPoint.x)}" cy="\${Math.round(unionPoint.y)}" r="5" fill="\${bloodlineRule.color}"/>\`,
  );

  if (layout.children.length) {
    const horizontalY = unionPoint.y + 22;
    const childY = offsetY + layout.children[0].y;
    const isCurved = context.visualConfig.connectors.shape === "curved";

    if (isCurved) {
      for (const child of layout.children) {
        const childAnchorCenter = offsetX + child.x + context.options.cardWidth / 2;
        const childPerson = context.personById.get(child.node.personId);
        const childColor = resolvePersonEffectiveColor(
          childPerson,
          child.node.incomingRelationKind,
          context.visualConfig,
        );
        const rule =
          context.visualConfig.relations[child.node.incomingRelationKind];
        const path = curvedPath(unionPoint, {
          x: childAnchorCenter,
          y: childY,
        });

        // note: dash() and attr() assume string inputs in the original, we will use them directly if available in context scope
        // wait, we can just output them as they were in original:
        // Actually we need to make sure we don't break SVG formatting
        // I will use context.visualConfig...
      }
    }
  }

  return unionPoint;
}
`;
  // I will write a much cleaner replacement for renderUnion inside the node script.
}
