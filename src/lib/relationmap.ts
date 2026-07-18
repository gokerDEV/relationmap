export type RelationMapIssueSeverity = "error" | "warning";

export type RelationMapIssue = {
  line: number;
  column: number;
  severity: RelationMapIssueSeverity;
  code: string;
  message: string;
};

export type RelationMapNodeType =
  | "person"
  | "family"
  | "group"
  | "institution"
  | "place"
  | "event"
  | "media"
  | "sector"
  | "document";

export type RelationMapLinkKind =
  | "confirmed"
  | "weak"
  | "claimed"
  | "ended"
  | "critical";

export type RelationMapNode = {
  id: string;
  type: RelationMapNodeType;
  label: string;
  color?: string;
  tags: string[];
  date?: string;
  note?: string;
  raw: string;
  firstLine: number;
  firstSeen: number;
  depth: number;
};

export type RelationMapEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  rootId: string;
  kind: RelationMapLinkKind;
  tags: string[];
  date?: string;
  note?: string;
  line: number;
};

export type RelationMapDocument = {
  title?: string;
  metadata: Record<string, string>;
  nodes: RelationMapNode[];
  edges: RelationMapEdge[];
  roots: string[];
};

export type RelationMapParseResult = {
  ok: boolean;
  document: RelationMapDocument;
  issues: RelationMapIssue[];
};

export type RelationMapParseOptions = {
  indentSize?: number;
};

export type RelationMapTheme = {
  background: string;
  text: string;
  mutedText: string;
  cardBackground: string;
  relationColor: string;
  edgeMuted: string;
};

export type RelationMapRenderOptions = RelationMapParseOptions & {
  theme?: Partial<RelationMapTheme>;
  cardWidth?: number;
  cardHeight?: number;
  columnGap?: number;
  rowGap?: number;
  padding?: number;
  title?: string;
  showLegend?: boolean;
};

export const DEFAULT_RELATION_MAP_THEME: RelationMapTheme = {
  background: "#ffffff",
  text: "#18181b",
  mutedText: "#71717a",
  cardBackground: "#ffffff",
  relationColor: "#71717a",
  edgeMuted: "#94a3b8",
};

export const DEFAULT_RELATION_MAP_EXAMPLE = `---
map: network
country: Fictional
period: 1960-1975
---

# Mediated RelationMap Example

- Aylin Soyer @aylin_soyer #7c3aed [academic] [writer]
  - > i:ankara_sbf "Ankara SBF" [student] (1960-1964)
    - > m:forum_journal "Forum Journal" [published-in] (1964-1967)
      - > g:reform_party "Reform Party" [founder] (1967)
  - > e:school_circle_1962 "Ankara SBF school circle" #ca8a04 [schoolmate] (1962)

- Bora Erim @bora_erim #059669 [lawyer]
  - > i:ankara_sbf [student] (1961-1965)
    - > g:legal_aid_union "Legal Aid Union" [founder] (1966)
      - > g:reform_party [legal-advisor] (1968-1971)
  - > e:school_circle_1962 [schoolmate] (1962)

- Deniz Kaya @deniz_kaya #2563eb [journalist]
  - > m:forum_journal [editor] (1965-1969)
    - > g:reform_party [media-circle] (1967-1970)
`;

type MutableDocument = {
  title?: string;
  metadata: Record<string, string>;
  nodesById: Map<string, RelationMapNode>;
  edges: RelationMapEdge[];
  roots: string[];
  nextSeen: number;
};

type StackEntry = {
  level: number;
  nodeId: string;
  rootId: string;
  depth: number;
};

type ParsedNodeReference = {
  id: string;
  type: RelationMapNodeType;
  label: string;
  color?: string;
  tags: string[];
  date?: string;
  note?: string;
  raw: string;
};

const NODE_PREFIX_TYPES: Record<string, RelationMapNodeType> = {
  "@": "person",
  f: "family",
  g: "group",
  i: "institution",
  p: "place",
  e: "event",
  m: "media",
  s: "sector",
  d: "document",
};

const LINK_KIND_BY_OPERATOR: Record<string, RelationMapLinkKind> = {
  ">": "confirmed",
  "~>": "weak",
  "?>": "claimed",
  "x>": "ended",
  "!>": "critical",
};

const ROOT_COLORS = [
  "#7c3aed",
  "#059669",
  "#2563eb",
  "#dc2626",
  "#ca8a04",
  "#0891b2",
  "#c026d3",
  "#ea580c",
  "#4f46e5",
  "#16a34a",
];

const RELATION_NODE_COLOR = "#71717a";

export function parseRelationMap(
  source: string,
  options: RelationMapParseOptions = {},
): RelationMapParseResult {
  const indentSize = options.indentSize ?? 2;
  const issues: RelationMapIssue[] = [];
  const document: MutableDocument = {
    metadata: {},
    nodesById: new Map(),
    edges: [],
    roots: [],
    nextSeen: 0,
  };
  const stack: StackEntry[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const contentStartIndex = readFrontmatter(lines, document.metadata);

  for (let index = contentStartIndex; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const line = index + 1;
    if (!rawLine.trim()) continue;

    if (/^\s*#\s+/.test(rawLine)) {
      document.title ??= rawLine.replace(/^\s*#+\s+/, "").trim();
      continue;
    }

    if (rawLine.includes("\t")) {
      issues.push(
        issue(
          line,
          1,
          "error",
          "tab-indent",
          "Tab indentation is not supported. Use spaces.",
        ),
      );
      continue;
    }

    const match = rawLine.match(/^(\s*)-\s+(.+)$/);
    if (!match) {
      issues.push(
        issue(
          line,
          1,
          "error",
          "invalid-line",
          "Expected a markdown list item starting with '-'.",
        ),
      );
      continue;
    }

    const indent = match[1]?.length ?? 0;
    if (indent % indentSize !== 0) {
      issues.push(
        issue(
          line,
          indent + 1,
          "error",
          "invalid-indent",
          `Indentation must use ${indentSize} spaces per level.`,
        ),
      );
      continue;
    }

    const level = indent / indentSize;
    if (level > stack.length) {
      issues.push(
        issue(
          line,
          indent + 1,
          "error",
          "indent-jump",
          "Indentation can only increase by one level at a time.",
        ),
      );
      continue;
    }

    stack.length = level;
    const content = match[2]?.trim() ?? "";
    const linkMatch = content.match(/^(!>|\?>|x>|~>|>)\s+(.+)$/);

    if (linkMatch) {
      const parent = stack[level - 1];
      if (!parent) {
        issues.push(
          issue(
            line,
            indent + 3,
            "error",
            "link-without-source",
            "A relation line must be nested under a source node.",
          ),
        );
        continue;
      }

      const operator = linkMatch[1] ?? ">";
      const target = parseNodeReference(
        linkMatch[2] ?? "",
        line,
        indent + 3,
        issues,
      );
      if (!target) continue;
      if (target.type === "person") {
        addPersonTargetIssue(line, indent + 3, issues);
        continue;
      }

      const node = getOrCreateNode(document, target, line, parent.depth + 1);
      document.edges.push(createEdge(document, parent, node, operator, target, line));
      stack.push({
        level,
        nodeId: node.id,
        rootId: parent.rootId,
        depth: parent.depth + 1,
      });
      continue;
    }

    const entity = parseNodeReference(content, line, indent + 3, issues, true);
    if (!entity) continue;
    const parent = stack[level - 1];
    const depth = parent ? parent.depth + 1 : 0;

    if (parent && entity.type === "person") {
      addPersonTargetIssue(line, indent + 3, issues);
      continue;
    }

    const node = getOrCreateNode(document, entity, line, depth);
    if (!parent) {
      if (!document.roots.includes(node.id)) document.roots.push(node.id);
      stack.push({ level, nodeId: node.id, rootId: node.id, depth });
    } else {
      document.edges.push(createEdge(document, parent, node, ">", entity, line));
      stack.push({ level, nodeId: node.id, rootId: parent.rootId, depth });
    }
  }

  stabilizeForwardDepths(document);

  const finalDocument: RelationMapDocument = {
    title: document.title,
    metadata: document.metadata,
    nodes: Array.from(document.nodesById.values()),
    edges: document.edges,
    roots: document.roots,
  };

  return {
    ok: !issues.some((entry) => entry.severity === "error"),
    document: finalDocument,
    issues,
  };
}

export function parseAndRenderRelationMapSvg(
  source: string,
  options: RelationMapRenderOptions = {},
): { result: RelationMapParseResult; svg: string } {
  const result = parseRelationMap(source, options);
  return { result, svg: renderRelationMapSvg(result, options) };
}

export function renderRelationMapSvg(
  input: RelationMapParseResult | RelationMapDocument,
  options: RelationMapRenderOptions = {},
): string {
  const document = "document" in input ? input.document : input;
  const theme = { ...DEFAULT_RELATION_MAP_THEME, ...options.theme };
  const resolved = {
    cardWidth: options.cardWidth ?? 220,
    cardHeight: options.cardHeight ?? 78,
    columnGap: options.columnGap ?? 120,
    rowGap: options.rowGap ?? 42,
    padding: options.padding ?? 32,
    showLegend: options.showLegend ?? true,
    title: options.title ?? document.title,
  };

  const nodeById = new Map(document.nodes.map((node) => [node.id, node]));
  const rootIndex = new Map(document.roots.map((id, index) => [id, index]));
  const layout = computeLayout(
    document,
    resolved.cardWidth,
    resolved.cardHeight,
    resolved.columnGap,
    resolved.rowGap,
  );
  const positions = Array.from(layout.values());
  const contentWidth = Math.max(
    ...positions.map((item) => item.x + resolved.cardWidth),
    0,
  );
  const contentHeight = Math.max(
    ...positions.map((item) => item.y + resolved.cardHeight),
    0,
  );
  const titleHeight = resolved.title ? 44 : 0;
  const legendHeight = resolved.showLegend
    ? Math.min(document.roots.length, 8) * 20 + 28
    : 0;
  const width = Math.max(760, contentWidth + resolved.padding * 2);
  const height = Math.max(
    420,
    contentHeight + resolved.padding * 2 + titleHeight + legendHeight,
  );
  const shiftX = resolved.padding;
  const shiftY = resolved.padding + titleHeight;
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(width * 0.26458333)}mm" height="${round(height * 0.26458333)}mm" viewBox="0 0 ${round(width)} ${round(height)}" role="img">`,
    `<rect width="100%" height="100%" fill="${attr(theme.background)}"/>`,
  );

  if (resolved.title) {
    parts.push(
      `<text x="${round(width / 2)}" y="${resolved.padding}" text-anchor="middle" dominant-baseline="hanging" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="20" font-weight="700" fill="${attr(theme.text)}">${text(resolved.title)}</text>`,
    );
  }

  for (const edge of document.edges) {
    const source = layout.get(edge.sourceId);
    const target = layout.get(edge.targetId);
    if (!source || !target) continue;
    const color = rootColor(edge.rootId, rootIndex, nodeById);
    const offset = parallelOffset(edge.rootId, rootIndex);
    const from = {
      x: shiftX + source.x + resolved.cardWidth,
      y: shiftY + source.y + resolved.cardHeight / 2 + offset,
    };
    const to = {
      x: shiftX + target.x,
      y: shiftY + target.y + resolved.cardHeight / 2 + offset,
    };
    renderEdge(parts, edge, from, to, color, theme);
  }

  for (const node of document.nodes) {
    const position = layout.get(node.id);
    if (!position) continue;
    const rootColorValue = rootIndex.has(node.id)
      ? rootColor(node.id, rootIndex, nodeById)
      : undefined;
    renderNode(
      parts,
      node,
      shiftX + position.x,
      shiftY + position.y,
      resolved.cardWidth,
      resolved.cardHeight,
      theme,
      rootColorValue,
    );
  }

  if (resolved.showLegend && document.roots.length > 0) {
    renderLegend(
      parts,
      document,
      nodeById,
      rootIndex,
      resolved.padding,
      height - legendHeight + 8,
      theme,
    );
  }

  parts.push("</svg>");
  return parts.join("");
}

function createEdge(
  document: MutableDocument,
  parent: StackEntry,
  targetNode: RelationMapNode,
  operator: string,
  target: ParsedNodeReference,
  line: number,
): RelationMapEdge {
  return {
    id: `r${document.edges.length + 1}`,
    sourceId: parent.nodeId,
    targetId: targetNode.id,
    rootId: parent.rootId,
    kind: LINK_KIND_BY_OPERATOR[operator] ?? "confirmed",
    tags: target.tags,
    date: target.date,
    note: target.note,
    line,
  };
}

function addPersonTargetIssue(
  line: number,
  column: number,
  issues: RelationMapIssue[],
): void {
  issues.push(
    issue(
      line,
      column,
      "error",
      "person-target-link",
      "Relation lines must not target a person. Put each person as a top-level subject and connect them to the same event, place, institution, group, family, media, sector, or document node.",
    ),
  );
}

function stabilizeForwardDepths(document: MutableDocument): void {
  const nodes = Array.from(document.nodesById.values());
  const nodeIds = nodes.map((node) => node.id);
  const adjacency = new Map<string, string[]>();
  for (const nodeId of nodeIds) adjacency.set(nodeId, []);
  for (const edge of document.edges) adjacency.get(edge.sourceId)?.push(edge.targetId);

  const componentByNode = findStronglyConnectedComponents(nodeIds, adjacency);
  const componentIds = new Set(componentByNode.values());
  const componentDepth = new Map<number, number>();
  const componentEdges = new Map<number, Set<number>>();
  const indegree = new Map<number, number>();

  for (const componentId of componentIds) {
    componentDepth.set(componentId, 0);
    componentEdges.set(componentId, new Set());
    indegree.set(componentId, 0);
  }

  for (const node of nodes) {
    const componentId = componentByNode.get(node.id);
    if (componentId === undefined) continue;
    componentDepth.set(
      componentId,
      Math.max(componentDepth.get(componentId) ?? 0, node.depth),
    );
  }

  for (const edge of document.edges) {
    const sourceComponent = componentByNode.get(edge.sourceId);
    const targetComponent = componentByNode.get(edge.targetId);
    if (
      sourceComponent === undefined ||
      targetComponent === undefined ||
      sourceComponent === targetComponent
    ) {
      continue;
    }
    const outgoing = componentEdges.get(sourceComponent);
    if (!outgoing || outgoing.has(targetComponent)) continue;
    outgoing.add(targetComponent);
    indegree.set(targetComponent, (indegree.get(targetComponent) ?? 0) + 1);
  }

  const queue = Array.from(componentIds)
    .filter((componentId) => (indegree.get(componentId) ?? 0) === 0)
    .sort((a, b) => (componentDepth.get(a) ?? 0) - (componentDepth.get(b) ?? 0));

  while (queue.length > 0) {
    const componentId = queue.shift();
    if (componentId === undefined) break;
    const sourceDepth = componentDepth.get(componentId) ?? 0;
    for (const targetComponent of componentEdges.get(componentId) ?? []) {
      componentDepth.set(
        targetComponent,
        Math.max(componentDepth.get(targetComponent) ?? 0, sourceDepth + 1),
      );
      const nextIndegree = (indegree.get(targetComponent) ?? 0) - 1;
      indegree.set(targetComponent, nextIndegree);
      if (nextIndegree === 0) queue.push(targetComponent);
    }
    queue.sort((a, b) => (componentDepth.get(a) ?? 0) - (componentDepth.get(b) ?? 0));
  }

  for (const node of nodes) {
    const componentId = componentByNode.get(node.id);
    if (componentId === undefined) continue;
    node.depth = componentDepth.get(componentId) ?? node.depth;
  }
}

function findStronglyConnectedComponents(
  nodeIds: string[],
  adjacency: Map<string, string[]>,
): Map<string, number> {
  const indexByNode = new Map<string, number>();
  const lowLinkByNode = new Map<string, number>();
  const stack: string[] = [];
  const isOnStack = new Set<string>();
  const componentByNode = new Map<string, number>();
  let index = 0;
  let componentId = 0;

  const visit = (nodeId: string) => {
    indexByNode.set(nodeId, index);
    lowLinkByNode.set(nodeId, index);
    index += 1;
    stack.push(nodeId);
    isOnStack.add(nodeId);

    for (const nextId of adjacency.get(nodeId) ?? []) {
      if (!indexByNode.has(nextId)) {
        visit(nextId);
        lowLinkByNode.set(
          nodeId,
          Math.min(lowLinkByNode.get(nodeId) ?? 0, lowLinkByNode.get(nextId) ?? 0),
        );
      } else if (isOnStack.has(nextId)) {
        lowLinkByNode.set(
          nodeId,
          Math.min(lowLinkByNode.get(nodeId) ?? 0, indexByNode.get(nextId) ?? 0),
        );
      }
    }

    if (lowLinkByNode.get(nodeId) !== indexByNode.get(nodeId)) return;

    while (stack.length > 0) {
      const item = stack.pop();
      if (!item) break;
      isOnStack.delete(item);
      componentByNode.set(item, componentId);
      if (item === nodeId) break;
    }
    componentId += 1;
  };

  for (const nodeId of nodeIds) {
    if (!indexByNode.has(nodeId)) visit(nodeId);
  }

  return componentByNode;
}

function readFrontmatter(lines: string[], metadata: Record<string, string>): number {
  if ((lines[0] ?? "").trim() !== "---") return 0;
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim() === "---") return index + 1;
    const match = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*$/);
    if (match?.[1]) metadata[match[1]] = match[2] ?? "";
  }
  return 0;
}

function parseNodeReference(
  raw: string,
  line: number,
  column: number,
  issues: RelationMapIssue[],
  allowImplicitId = false,
): ParsedNodeReference | undefined {
  let value = raw.trim();
  if (!value) {
    issues.push(issue(line, column, "error", "empty-node", "Node definition cannot be empty."));
    return undefined;
  }

  const notes: string[] = [];
  value = value.replace(/\{([^{}]*)\}/g, (_, note: string) => {
    if (note.trim()) notes.push(note.trim());
    return " ";
  });

  let quotedLabel: string | undefined;
  value = value.replace(/"([^"]*)"/, (_, label: string) => {
    quotedLabel = label.trim() || undefined;
    return " ";
  });

  let color: string | undefined;
  value = value.replace(/(^|\s)#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})(?=\s|$)/, (_, prefix: string, hex: string) => {
    color = normalizeHex(hex);
    return prefix;
  });

  const tags: string[] = [];
  value = value.replace(/\[([^\]]+)\]/g, (_, tagContent: string) => {
    tags.push(
      ...tagContent
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    );
    return " ";
  });

  let date: string | undefined;
  value = value.replace(/\(([^()]*)\)/g, (_, dateContent: string) => {
    date ??= dateContent.trim() || undefined;
    return " ";
  });

  const idMatch = value.match(/(^|\s)(@[A-Za-z0-9_-]+|[fgipemsd]:[A-Za-z0-9_-]+)/);
  let id = idMatch?.[2];
  if (id && idMatch) value = value.replace(idMatch[0], " ");

  const label = normalize(value) || quotedLabel || (id ? labelFromId(id) : "");
  if (!id && allowImplicitId && label) id = `@${slug(label)}`;

  if (!id) {
    issues.push(
      issue(
        line,
        column,
        "error",
        "missing-id",
        "Relation map nodes need an id such as @person, g:group, i:school, p:place, or e:event.",
      ),
    );
    return undefined;
  }

  return {
    id,
    type: nodeTypeFromId(id),
    label: label || labelFromId(id),
    color,
    tags,
    date,
    note: notes.length ? notes.join("\n") : undefined,
    raw,
  };
}

function getOrCreateNode(
  document: MutableDocument,
  ref: ParsedNodeReference,
  line: number,
  depth: number,
): RelationMapNode {
  const existing = document.nodesById.get(ref.id);
  if (existing) {
    if (ref.label && existing.label === labelFromId(existing.id)) existing.label = ref.label;
    if (ref.color && !existing.color) existing.color = ref.color;
    existing.tags = Array.from(new Set([...existing.tags, ...ref.tags]));
    existing.date ??= ref.date;
    existing.note ??= ref.note;
    existing.depth = Math.max(existing.depth, depth);
    return existing;
  }

  const node: RelationMapNode = {
    id: ref.id,
    type: ref.type,
    label: ref.label || labelFromId(ref.id),
    color: ref.color,
    tags: ref.tags,
    date: ref.date,
    note: ref.note,
    raw: ref.raw,
    firstLine: line,
    firstSeen: document.nextSeen,
    depth,
  };
  document.nextSeen += 1;
  document.nodesById.set(ref.id, node);
  return node;
}

function computeLayout(
  document: RelationMapDocument,
  cardWidth: number,
  cardHeight: number,
  columnGap: number,
  rowGap: number,
): Map<string, { x: number; y: number }> {
  const byDepth = new Map<number, RelationMapNode[]>();
  for (const node of document.nodes) {
    const depth = Math.max(0, node.depth);
    if (!byDepth.has(depth)) byDepth.set(depth, []);
    byDepth.get(depth)?.push(node);
  }

  const layout = new Map<string, { x: number; y: number }>();
  const depths = Array.from(byDepth.keys()).sort((a, b) => a - b);
  for (const depth of depths) {
    const nodes = (byDepth.get(depth) ?? []).sort((a, b) => {
      if (a.type === "person" && b.type !== "person") return -1;
      if (a.type !== "person" && b.type === "person") return 1;
      return a.firstSeen - b.firstSeen;
    });
    nodes.forEach((node, row) => {
      layout.set(node.id, {
        x: depth * (cardWidth + columnGap),
        y: row * (cardHeight + rowGap),
      });
    });
  }
  return layout;
}

function renderEdge(
  parts: string[],
  edge: RelationMapEdge,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  theme: RelationMapTheme,
): void {
  const distance = Math.max(40, Math.abs(to.x - from.x));
  const c1x = from.x + distance * 0.45;
  const c2x = to.x - distance * 0.45;
  const path = `M ${round(from.x)} ${round(from.y)} C ${round(c1x)} ${round(from.y)}, ${round(c2x)} ${round(to.y)}, ${round(to.x)} ${round(to.y)}`;
  const stroke = edge.kind === "ended" ? theme.edgeMuted : color;
  const opacity = edge.kind === "ended" ? 0.5 : edge.kind === "claimed" ? 0.72 : 0.92;
  const strokeWidth = edge.kind === "critical" ? 3 : 2;
  const dash = edge.kind === "weak" ? ' stroke-dasharray="6 5"' : edge.kind === "claimed" ? ' stroke-dasharray="3 5"' : edge.kind === "ended" ? ' stroke-dasharray="8 5"' : "";

  parts.push(
    `<path d="${path}" fill="none" stroke="${attr(stroke)}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"${dash}/>`,
  );

  const label = edgeLabel(edge);
  if (label) {
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2 - 8;
    parts.push(
      `<text x="${round(midX)}" y="${round(midY)}" text-anchor="middle" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="10" fill="${attr(stroke)}">${text(truncate(label, 26))}</text>`,
    );
  }
}

function renderNode(
  parts: string[],
  node: RelationMapNode,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: RelationMapTheme,
  rootColorValue?: string,
): void {
  const isPerson = node.type === "person";
  const accent = isPerson
    ? node.color ?? rootColorValue ?? RELATION_NODE_COLOR
    : node.color ?? theme.relationColor;
  const typeLabelColor = isPerson ? accent : node.color ?? theme.relationColor;
  const strokeWidth = isPerson ? 3 : node.color ? 2.5 : 1.5;

  parts.push(
    `<rect x="${round(x)}" y="${round(y)}" width="${width}" height="${height}" rx="14" fill="${attr(theme.cardBackground)}" stroke="${attr(accent)}" stroke-width="${strokeWidth}"/>`,
    `<text x="${round(x + 14)}" y="${round(y + 20)}" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="700" fill="${attr(theme.text)}">${text(truncate(node.label, 27))}</text>`,
    `<text x="${round(x + width - 12)}" y="${round(y + 18)}" text-anchor="end" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="8" font-weight="700" fill="${attr(typeLabelColor)}">${text(node.type.toUpperCase())}</text>`,
    `<text x="${round(x + 14)}" y="${round(y + 38)}" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="11" fill="${attr(theme.mutedText)}">${text(truncate(node.id, 30))}</text>`,
  );

  const lowerText = node.date ? node.date : node.note;
  if (lowerText) {
    parts.push(
      `<text x="${round(x + 14)}" y="${round(y + 56)}" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="10" fill="${attr(theme.mutedText)}">${text(truncate(lowerText, 30))}</text>`,
    );
  }

  if (node.tags.length > 0) {
    const tags = node.tags.slice(0, 3);
    let tagX = x + 14;
    const tagY = y + height - 16;
    for (const tag of tags) {
      const tagText = truncate(tag, 12);
      const tagWidth = 12 + tagText.length * 6;
      parts.push(
        `<rect x="${round(tagX)}" y="${round(tagY - 10)}" width="${round(tagWidth)}" height="16" rx="8" fill="${attr(accent)}" opacity="0.12"/>`,
        `<text x="${round(tagX + 6)}" y="${round(tagY + 1)}" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="9" fill="${attr(accent)}">${text(tagText)}</text>`,
      );
      tagX += tagWidth + 6;
    }
  }
}

function renderLegend(
  parts: string[],
  document: RelationMapDocument,
  nodeById: Map<string, RelationMapNode>,
  rootIndex: Map<string, number>,
  x: number,
  y: number,
  theme: RelationMapTheme,
): void {
  parts.push(
    `<text x="${round(x)}" y="${round(y)}" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="11" font-weight="700" fill="${attr(theme.mutedText)}">PATH COLORS</text>`,
  );

  document.roots.slice(0, 8).forEach((rootId, index) => {
    const node = nodeById.get(rootId);
    const color = rootColor(rootId, rootIndex, nodeById);
    const itemY = y + 20 + index * 20;
    parts.push(
      `<line x1="${round(x)}" y1="${round(itemY)}" x2="${round(x + 24)}" y2="${round(itemY)}" stroke="${attr(color)}" stroke-width="3" stroke-linecap="round"/>`,
      `<text x="${round(x + 34)}" y="${round(itemY + 4)}" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="11" fill="${attr(theme.text)}">${text(truncate(node?.label ?? rootId, 42))}</text>`,
    );
  });
}

function edgeLabel(edge: RelationMapEdge): string {
  if (edge.tags.length > 0 && edge.date) return `${edge.tags[0]} · ${edge.date}`;
  if (edge.tags.length > 0) return edge.tags[0] ?? "";
  if (edge.date) return edge.date;
  return "";
}

function rootColor(
  rootId: string,
  rootIndex: Map<string, number>,
  nodeById: Map<string, RelationMapNode>,
): string {
  const nodeColor = nodeById.get(rootId)?.color;
  if (nodeColor) return nodeColor;
  const index = rootIndex.get(rootId) ?? 0;
  return ROOT_COLORS[index % ROOT_COLORS.length] ?? ROOT_COLORS[0];
}

function parallelOffset(rootId: string, rootIndex: Map<string, number>): number {
  const index = rootIndex.get(rootId) ?? 0;
  return ((index % 5) - 2) * 3;
}

function nodeTypeFromId(id: string): RelationMapNodeType {
  if (id.startsWith("@")) return "person";
  const prefix = id.split(":", 1)[0] ?? "";
  return NODE_PREFIX_TYPES[prefix] ?? "document";
}

function labelFromId(id: string): string {
  return id
    .replace(/^@/, "")
    .replace(/^[a-z]:/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function slug(value: string): string {
  return normalize(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "node";
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeHex(value: string): string {
  if (value.length === 3) {
    return `#${value
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`.toLowerCase();
  }
  return `#${value.toLowerCase()}`;
}

function issue(
  line: number,
  column: number,
  severity: RelationMapIssueSeverity,
  code: string,
  message: string,
): RelationMapIssue {
  return { line, column, severity, code, message };
}

function truncate(value: string, length: number): string {
  if (value.length <= length) return value;
  return `${value.slice(0, Math.max(0, length - 1))}…`;
}

function round(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function attr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function text(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
