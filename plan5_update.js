const fs = require("fs");

const types = `
type LayoutPersonBlock = {
  kind: "person";
  node: FamilyTreePersonNode;
  personId: string;
  depth: number;
  incomingRelationKind: FamilyTreeRelationKind;
  parentUnionId?: string;
  x: number;
  y: number;
  localX: number;
  anchor: LayoutCard;
  spouses: LayoutSpouse[];
  unions: LayoutUnionBlock[];
  width: number;
  height: number;
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
`;

const funcs = `
function buildLayoutBlock(
  node: FamilyTreePersonNode,
  depth: number,
  context: RenderContext
): LayoutPersonBlock {
  const cardW = context.options.cardWidth;
  const cardH = context.options.cardHeight;
  const spouseGap = context.options.partnerGap;

  const anchorCard: LayoutCard = {
    localX: 0,
    localY: 0,
    width: cardW,
    height: cardH,
    centerX: cardW / 2,
    bottomY: cardH,
  };

  const spouses: LayoutSpouse[] = [];
  const unions: LayoutUnionBlock[] = [];

  let currentLocalX = cardW + spouseGap;

  for (const u of node.unions) {
    const union = context.unionById.get(u.unionId);
    if (!union) continue;

    const visiblePartnerIds = union.partnerIds.filter((id) => id !== union.anchorPersonId);
    const relationType = union.kind === "former" ? "formerSpouse" : "spouse";

    for (const partnerId of visiblePartnerIds) {
      const spouse: LayoutSpouse = {
        personId: partnerId,
        unionId: union.id,
        relationType,
        localX: currentLocalX,
        localY: 0,
        centerX: currentLocalX + cardW / 2,
      };
      spouses.push(spouse);

      const children = u.children.map((childNode) => buildLayoutBlock(childNode, depth + 1, context));

      const unionBlock: LayoutUnionBlock = {
        unionId: union.id,
        relationType,
        spousePersonId: partnerId,
        weddingLocalX: spouse.centerX,
        weddingLocalY: cardH + 26,
        children,
        childGroupLeft: 0,
        childGroupWidth: 0,
      };
      unions.push(unionBlock);

      currentLocalX += cardW + spouseGap;
    }
  }

  return {
    kind: "person",
    node,
    personId: node.personId,
    depth,
    incomingRelationKind: node.incomingRelationKind,
    parentUnionId: undefined,
    x: 0,
    y: depth * (cardH + context.options.levelGap),
    localX: 0,
    anchor: anchorCard,
    spouses,
    unions,
    width: 0,
    height: 0,
    leftContour: new Map(),
    rightContour: new Map(),
  };
}

function mergeContours(
  targetLeft: Map<number, number>,
  targetRight: Map<number, number>,
  sourceLeft: Map<number, number>,
  sourceRight: Map<number, number>,
  shiftX: number
) {
  for (const [depth, x] of sourceLeft.entries()) {
    const shiftedX = x + shiftX;
    if (!targetLeft.has(depth) || shiftedX < targetLeft.get(depth)!) {
      targetLeft.set(depth, shiftedX);
    }
  }
  for (const [depth, x] of sourceRight.entries()) {
    const shiftedX = x + shiftX;
    if (!targetRight.has(depth) || shiftedX > targetRight.get(depth)!) {
      targetRight.set(depth, shiftedX);
    }
  }
}

function shiftBlock(block: LayoutPersonBlock, shiftX: number) {
  block.localX += shiftX;
  for (const [depth, x] of block.leftContour.entries()) {
    block.leftContour.set(depth, x + shiftX);
  }
  for (const [depth, x] of block.rightContour.entries()) {
    block.rightContour.set(depth, x + shiftX);
  }
}

function packSiblings(children: LayoutPersonBlock[], gap: number) {
  if (children.length === 0) return;

  const aggregateLeft = new Map<number, number>();
  const aggregateRight = new Map<number, number>();

  children[0].localX = 0;
  mergeContours(aggregateLeft, aggregateRight, children[0].leftContour, children[0].rightContour, 0);

  for (let i = 1; i < children.length; i++) {
    const next = children[i];
    let minShift = 0;

    for (const [depth, aggRight] of aggregateRight.entries()) {
      if (next.leftContour.has(depth)) {
        const nextLeft = next.leftContour.get(depth)!;
        const required = aggRight + gap - nextLeft;
        if (required > minShift) {
          minShift = required;
        }
      }
    }

    shiftBlock(next, minShift);
    mergeContours(aggregateLeft, aggregateRight, next.leftContour, next.rightContour, 0);
  }
}

function measureAndLayoutBlock(block: LayoutPersonBlock, context: RenderContext) {
  const cardW = context.options.cardWidth;
  const siblingGap = context.options.partnerGap * 2;

  let maxChildDepth = block.depth;

  for (const union of block.unions) {
    for (const child of union.children) {
      measureAndLayoutBlock(child, context);
      maxChildDepth = Math.max(maxChildDepth, ...Array.from(child.leftContour.keys()));
    }

    if (union.children.length > 0) {
      packSiblings(union.children, siblingGap);

      let packedLeft = Infinity;
      let packedRight = -Infinity;

      for (const child of union.children) {
        const childLeft = Math.min(...Array.from(child.leftContour.values()));
        const childRight = Math.max(...Array.from(child.rightContour.values()));
        if (childLeft < packedLeft) packedLeft = childLeft;
        if (childRight > packedRight) packedRight = childRight;
      }

      const packedWidth = packedRight - packedLeft;
      const desiredGroupLeft = union.weddingLocalX - packedWidth / 2;
      const shiftX = desiredGroupLeft - packedLeft;

      for (const child of union.children) {
        shiftBlock(child, shiftX);
      }

      union.childGroupLeft = desiredGroupLeft;
      union.childGroupWidth = packedWidth;
    }
  }

  let minLocalX = 0;
  let maxLocalX = cardW;

  if (block.spouses.length > 0) {
    const lastSpouse = block.spouses[block.spouses.length - 1];
    maxLocalX = Math.max(maxLocalX, lastSpouse.localX + cardW);
  }

  for (const union of block.unions) {
    for (const child of union.children) {
      const childMin = Math.min(...Array.from(child.leftContour.values()));
      const childMax = Math.max(...Array.from(child.rightContour.values()));
      if (childMin < minLocalX) minLocalX = childMin;
      if (childMax > maxLocalX) maxLocalX = childMax;
    }
  }

  const shiftToZero = -minLocalX;
  
  block.anchor.localX += shiftToZero;
  block.anchor.centerX += shiftToZero;
  for (const spouse of block.spouses) {
    spouse.localX += shiftToZero;
    spouse.centerX += shiftToZero;
  }
  for (const union of block.unions) {
    union.weddingLocalX += shiftToZero;
    union.childGroupLeft += shiftToZero;
    for (const child of union.children) {
      shiftBlock(child, shiftToZero);
    }
  }

  block.width = maxLocalX - minLocalX;

  block.leftContour.set(block.depth, block.anchor.localX);
  block.rightContour.set(block.depth, block.spouses.length > 0 ? block.spouses[block.spouses.length - 1].localX + cardW : block.anchor.localX + cardW);

  for (const union of block.unions) {
    for (const child of union.children) {
      mergeContours(block.leftContour, block.rightContour, child.leftContour, child.rightContour, 0);
    }
  }
}

function resolveAbsoluteCoordinates(block: LayoutPersonBlock, absoluteX: number, context: RenderContext) {
  block.x = absoluteX + block.anchor.localX;

  for (const union of block.unions) {
    for (const child of union.children) {
      resolveAbsoluteCoordinates(child, absoluteX + child.localX, context);
    }
  }
}

function computeBounds(roots: LayoutPersonBlock[], context: RenderContext) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  function traverse(block: LayoutPersonBlock) {
    const anchorLeft = block.x;
    const anchorRight = block.x + context.options.cardWidth;
    const anchorTop = block.y;
    const anchorBottom = block.y + context.options.cardHeight;

    if (anchorLeft < minX) minX = anchorLeft;
    if (anchorRight > maxX) maxX = anchorRight;
    if (anchorTop < minY) minY = anchorTop;
    if (anchorBottom > maxY) maxY = anchorBottom;

    for (const spouse of block.spouses) {
      const sx = block.x - block.anchor.localX + spouse.localX;
      if (sx < minX) minX = sx;
      if (sx + context.options.cardWidth > maxX) maxX = sx + context.options.cardWidth;
    }

    for (const union of block.unions) {
      const wx = block.x - block.anchor.localX + union.weddingLocalX;
      const wy = block.y - block.anchor.localY + union.weddingLocalY;
      if (wx - 5 < minX) minX = wx - 5;
      if (wx + 5 > maxX) maxX = wx + 5;
      if (wy + 5 > maxY) maxY = wy + 5;

      for (const child of union.children) {
        traverse(child);
      }
    }
  }

  for (const root of roots) {
    traverse(root);
  }

  return { minX, maxX, minY, maxY };
}

function renderPerson(block: LayoutPersonBlock, context: RenderContext) {
  const person = context.personById.get(block.personId);
  renderCard(person, block.x, block.y, context, block.incomingRelationKind);

  for (const spouse of block.spouses) {
    const spousePerson = context.personById.get(spouse.personId);
    const sx = block.x - block.anchor.localX + spouse.localX;
    renderCard(spousePerson, sx, block.y, context, spouse.relationType);
  }

  for (const union of block.unions) {
    const wx = block.x - block.anchor.localX + union.weddingLocalX;
    const wy = block.y - block.anchor.localY + union.weddingLocalY;
    const unionPoint = { x: wx, y: wy };

    const spouse = block.spouses.find(s => s.personId === union.spousePersonId);
    if (spouse) {
      const spouseBottom = { x: block.x - block.anchor.localX + spouse.centerX, y: block.y + context.options.cardHeight };
      drawConnector(spouseBottom, unionPoint, context, union.relationType);
    }

    const anchorBottom = { x: block.x + context.options.cardWidth / 2, y: block.y + context.options.cardHeight };
    drawConnector(anchorBottom, unionPoint, context, union.relationType);

    const bloodlineRule = context.visualConfig.relations.biological;
    context.parts.push(
      \`<circle cx="\${round(unionPoint.x)}" cy="\${round(unionPoint.y)}" r="5" fill="\${attr(bloodlineRule.color)}"/>\`
    );

    if (union.children.length > 0) {
      const isCurved = context.visualConfig.connectors.shape === "curved";

      for (const child of union.children) {
        const childAnchorCenter = { x: child.x + context.options.cardWidth / 2, y: child.y };
        const childPerson = context.personById.get(child.personId);
        const childColor = resolvePersonEffectiveColor(
          childPerson,
          child.incomingRelationKind,
          context.visualConfig
        );
        const rule = context.visualConfig.relations[child.incomingRelationKind];

        if (isCurved) {
          const path = curvedPath(unionPoint, childAnchorCenter);
          context.parts.push(
            \`<path d="\${path}" fill="none" stroke="\${attr(childColor)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\${dash(rule.lineStyle)}/>\`
          );
        } else {
          // elbow mode for individual children without shared sibling bar
          const horizontalY = unionPoint.y + 22;
          const path = \`M \${round(unionPoint.x)} \${round(unionPoint.y)} V \${round(horizontalY)} H \${round(childAnchorCenter.x)} V \${round(childAnchorCenter.y)}\`;
          context.parts.push(
            \`<path d="\${path}" fill="none" stroke="\${attr(childColor)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\${dash(rule.lineStyle)}/>\`
          );
        }

        renderPerson(child, context);
      }
    }
  }
}
`;

let code = fs.readFileSync("src/lib/familytree.ts", "utf8");

const typesStart = code.indexOf("type LayoutPerson = {");
const typesEnd = code.indexOf("type RenderContext = {");
if (typesStart !== -1 && typesEnd !== -1) {
  code =
    code.substring(0, typesStart) +
    types.trim() +
    "\n\n" +
    code.substring(typesEnd);
}

const funcsStart = code.indexOf("function buildLayoutTree(");
const funcsEnd = code.indexOf("function renderCard(");
if (funcsStart !== -1 && funcsEnd !== -1) {
  code =
    code.substring(0, funcsStart) +
    funcs.trim() +
    "\n\n" +
    code.substring(funcsEnd);
}

// Update renderFamilyTreeSvg
const svgRenderFunc = code.match(
  /function renderFamilyTreeSvg[\s\S]*?return context.parts.join\(""\);\n\}/,
);
if (svgRenderFunc) {
  let newSvgRender = svgRenderFunc[0];
  newSvgRender = newSvgRender.replace(
    /const roots = document\.roots\.map\(\(root\) => \{[\s\S]*?const contentHeight = contentSize\.height;/m,
    `const blocks = document.roots.map((root) => {
    if (root.kind === "person") return buildLayoutBlock(root, 0, context);
    throw new Error("Union roots not supported with generation layout yet");
  });

  for (const block of blocks) {
    measureAndLayoutBlock(block, context);
  }

  packSiblings(blocks, context.options.partnerGap * 2);

  for (const block of blocks) {
    resolveAbsoluteCoordinates(block, block.localX, context);
  }

  const bounds = computeBounds(blocks, context);
  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;`,
  );

  newSvgRender = newSvgRender.replace(
    /const startX = context\.options\.padding;\n\s*const rootY = context\.options\.padding \+ titleHeight;\n\s*for \(const root of roots\) \{\n\s*renderPerson\(root, startX, rootY, context\);\n\s*\}/m,
    `const shiftX = context.options.padding - bounds.minX;
  const shiftY = context.options.padding + titleHeight - bounds.minY;

  function shiftCoordinates(block: LayoutPersonBlock) {
    block.x += shiftX;
    block.y += shiftY;
    for (const union of block.unions) {
      for (const child of union.children) {
        shiftCoordinates(child);
      }
    }
  }

  for (const block of blocks) {
    shiftCoordinates(block);
    renderPerson(block, context);
  }`,
  );
  code = code.replace(svgRenderFunc[0], newSvgRender);
}

fs.writeFileSync("src/lib/familytree.ts", code);
console.log("Updated familytree.ts successfully!");
