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
  edgeMuted: "#94a3b8",
};

export const DEFAULT_RELATION_MAP_EXAMPLE = `---
map: network
country: Türkiye
period: 1940-1975
---

# Turkish Left Network

- Behice Boran @behice [academic] [marxist]
  - > i:dtcf "Ankara Üniversitesi DTCF" [academic]
    - > g:tip "Türkiye İşçi Partisi" [chair] (1970-1971)
  - > g:tkp "Türkiye Komünist Partisi" [member]
  - ~> @sadun "Sadun Aren" [ally]
  - ~> @mina "Mina Urgan" [friend]

- Mina Urgan @mina [writer] [socialist]
  - > i:istanbul_uni "İstanbul Üniversitesi" [academic]
  - > i:dtcf [circle]
    - > g:tip [founder]
  - ~> @behice [friend]

- Sadun Aren @sadun [economist]
  - > i:sbf "Ankara Üniversitesi SBF" [academic]
    - > g:tip [founder]
  - ~> @behice [ally]

- Mehmet Ali Aybar @aybar [lawyer]
  - > g:tip [chair] (1962-1969)
  - x> @behice [split]
  - x> @sadun [split]`;

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

const NODE_TYPE_COLORS: Record<RelationMapNodeType, string> = {
  person: "#18181b",
  family: "#7c3aed",
  group: "#dc2626",
  institution: "#2563eb",
  place: "#059669",
  event: "#ca8a04",
  media: "#c026d3",
  sector: "#0891b2",
  document: "#52525b",
};

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
      const target = parseNodeReference(linkMatch[2] ?? "", line, indent + 3, issues);
      if (!target) continue;
      const node = getOrCreateNode(document, target, line, parent.depth + 1);
      const edge: RelationMapEdge = {
        id: `r${document.edges.length + 1}`,
        sourceId: parent.nodeId,
        targetId: node.id,
        rootId: parent.rootId,
        kind: LINK_KIND_BY_OPERATOR[operator] ?? "confirmed",
        tags: target.tags,
        date: target.date,
        note: target.note,
        line,
      };
      document.edges.push(edge);
      stack.push({ level, nodeId: node.id, rootId: parent.rootId, depth: parent.depth + 1 });
      continue;
    }

    const entity = parseNodeReference(content, line, indent + 3, issues, true);
    if (!entity) continue;
    const parent = stack[level - 1];
    const depth = parent ? parent.depth + 1 : 0;
    const node = getOrCreateNode(document, entity, line, depth);

    if (!parent) {
      if (!document.roots.includes(node.id)) document.roots.push(node.id);
      stack.push({ level, nodeId: node.id, rootId: node.id, depth });
    } else {
      const edge: RelationMapEdge = {
        id: `r${document.edges.length + 1}`,
        sourceId: parent.nodeId,
        targetId: node.id,
        rootId: parent.rootId,
        kind: "confirmed",
        tags: entity.tags,
        date: entity.date,
        note: entity.note,
        line,
      };
      document.edges.push(edge);
      stack.push({ level, nodeId: node.id, rootId: parent.rootId, depth });
    }
  }

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
    columnGap: options.columnGap ?? 110,
    rowGap: options.rowGap ?? 38,
    padding: options.padding ?? 32,
    showLegend: options.showLegend ?? true,
    title: options.title ?? document.title,
  };

  const nodeById = new Map(document.nodes.map((node) => [node.id, node]));
  const rootIndex = new Map(document.roots.map((id, index) => [id, index]));
  const layout = computeLayout(document, resolved.cardWidth, resolved.cardHeight, resolved.columnGap, resolved.rowGap);
  const contentWidth = Math.max(...Array.from(layout.values()).map((item) => item.x + resolved.cardWidth), 0);
  const contentHeight = Math.max(...Array.from(layout.values()).map((item) => item.y + resolved.cardHeight), 0);
  const titleHeight = resolved.title ? 44 : 0;
  const legendHeight = resolved.showLegend ? Math.min(document.roots.length, 8) * 20 + 28 : 0;
  const width = Math.max(760, contentWidth + resolved.padding * 2);
  const height = Math.max(420, contentHeight + resolved.padding * 2 + titleHeight + legendHeight);
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
    const color = rootColor(edge.rootId, rootIndex);
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
    const rootColorValue = rootIndex.has(node.id) ? rootColor(node.id, rootIndex) : undefined;
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
  if (id) {
    value = `${value.slice(0, idMatch?.index ?? 0)} ${value.slice((idMatch?.index ?? 0) + (idMatch?.[0]?.length ?? 0))}`;
  }

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
    existing.tags = Array.from(new Set([...existing.tags, ...ref.tags]));
    existing.date ??= ref.date;
    existing.note ??= ref.note;
    existing.depth = Math.min(existing.depth, depth);
    return existing;
  }

  const node: RelationMapNode = {
    id: ref.id,
    type: ref.type,
    label: ref.label || labelFromId(ref.id),
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
    const depth = Math.max(0, Math.min(node.depth, 8));
    if (!byDepth.has(depth)) byDepth.set(depth, []);
    byDepth.get(depth)?.push(node);
  }

  const layout = new Map<string, { x: number; y: number }>();
  const depths = Array.from(byDepth.keys()).sort((a, b) => a - b);
  for (const depth of depths) {
    const nodes = (byDepth.get(depth) ?? []).sort((a, b) => a.firstSeen - b.firstSeen);
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
) {
  const distance = Math.max(40, Math.abs(to.x - from.x));
  const c1x = from.x + distance * 0.45;
  const c2x = to.x - distance * 0.45;
  const path = `M ${round(from.x)} ${round(from.y)} C ${round(c1x)} ${round(from.y)}, ${round(c2x)} ${round(to.y)}, ${round(to.x)} ${round(to.y)}`;
  const stroke = edge.kind === "ended" ? theme.edgeMuted : color;
  const opacity = edge.kind === "ended" ? 0.5 : edge.kind === "claimed" ? 0.72 : 0.92;
  const width = edge.kind === "critical" ? 3 : 2;
  const dash = edgeDash(edge.kind);
  parts.push(
    `<path d="${path}" fill="none" stroke="${attr(stroke)}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"${dash}/>`,
  );

  const label = edge.tags[0] || formatLinkKind(edge.kind);
  if (label || edge.date) {
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2 - 6;
    parts.push(
      `<text x="${round(mx)}" y="${round(my)}" text-anchor="middle" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="10" font-weight="600" fill="${attr(stroke)}" opacity="0.9">${text([label, edge.date].filter(Boolean).join(" · "))}</text>`,
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
) {
  const typeColor = NODE_TYPE_COLORS[node.type];
  const borderColor = rootColorValue ?? typeColor;
  parts.push(
    `<rect x="${round(x)}" y="${round(y)}" width="${width}" height="${height}" rx="14" fill="${attr(theme.cardBackground)}" stroke="${attr(borderColor)}" stroke-width="2"/>`,
    `<rect x="${round(x)}" y="${round(y)}" width="7" height="${height}" rx="3.5" fill="${attr(borderColor)}"/>`,
    `<text x="${round(x + 16)}" y="${round(y + 22)}" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="700" fill="${attr(theme.text)}">${text(truncate(node.label, 28))}</text>`,
    `<text x="${round(x + 16)}" y="${round(y + 40)}" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="11" fill="${attr(theme.mutedText)}">${text(node.id)}</text>`,
    `<text x="${round(x + width - 12)}" y="${round(y + 20)}" text-anchor="end" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="9" font-weight="700" fill="${attr(typeColor)}">${text(typeLabel(node.type))}</text>`,
  );

  const chips = node.tags.slice(0, 2);
  let chipX = x + 16;
  for (const tag of chips) {
    const chipWidth = Math.min(86, tag.length * 6 + 18);
    parts.push(
      `<rect x="${round(chipX)}" y="${round(y + 54)}" width="${round(chipWidth)}" height="16" rx="8" fill="${attr(typeColor)}" opacity="0.1"/>`,
      `<text x="${round(chipX + 9)}" y="${round(y + 66)}" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="9" font-weight="600" fill="${attr(typeColor)}">${text(truncate(tag, 12))}</text>`,
    );
    chipX += chipWidth + 6;
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
) {
  parts.push(
    `<text x="${round(x)}" y="${round(y)}" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="11" font-weight="700" fill="${attr(theme.mutedText)}">Path colors</text>`,
  );
  document.roots.slice(0, 8).forEach((rootId, index) => {
    const node = nodeById.get(rootId);
    const itemY = y + 18 + index * 20;
    parts.push(
      `<line x1="${round(x)}" y1="${round(itemY - 4)}" x2="${round(x + 26)}" y2="${round(itemY - 4)}" stroke="${attr(rootColor(rootId, rootIndex))}" stroke-width="3" stroke-linecap="round"/>`,
      `<text x="${round(x + 34)}" y="${round(itemY)}" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="11" fill="${attr(theme.mutedText)}">${text(node?.label ?? rootId)}</text>`,
    );
  });
}

function nodeTypeFromId(id: string): RelationMapNodeType {
  const prefix = id.startsWith("@") ? "@" : id.slice(0, 1);
  return NODE_PREFIX_TYPES[prefix] ?? "person";
}

function labelFromId(id: string): string {
  return id.replace(/^@/, "").replace(/^[a-z]:/, "").replace(/_/g, " ");
}

function rootColor(rootId: string, rootIndex: Map<string, number>): string {
  const index = rootIndex.get(rootId) ?? 0;
  return ROOT_COLORS[index % ROOT_COLORS.length] ?? ROOT_COLORS[0];
}

function parallelOffset(rootId: string, rootIndex: Map<string, number>): number {
  const index = rootIndex.get(rootId) ?? 0;
  return ((index % 5) - 2) * 4;
}

function edgeDash(kind: RelationMapLinkKind): string {
  if (kind === "weak") return ' stroke-dasharray="5 5"';
  if (kind === "claimed") return ' stroke-dasharray="2 5"';
  if (kind === "ended") return ' stroke-dasharray="7 5"';
  return "";
}

function formatLinkKind(kind: RelationMapLinkKind): string {
  if (kind === "weak") return "weak";
  if (kind === "claimed") return "claimed";
  if (kind === "ended") return "ended";
  if (kind === "critical") return "critical";
  return "linked";
}

function typeLabel(type: RelationMapNodeType): string {
  const labels: Record<RelationMapNodeType, string> = {
    person: "PERSON",
    family: "FAMILY",
    group: "GROUP",
    institution: "INST",
    place: "PLACE",
    event: "EVENT",
    media: "MEDIA",
    sector: "SECTOR",
    document: "DOC",
  };
  return labels[type];
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

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "node";
}

function round(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
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
