# relationmap

`relationmap` is a Markdown-like editor and SVG renderer for mapping people, families, institutions, groups, companies, parties, unions, places, events, publications, sectors, and documents.

The notation is subject-first. A top-level row is the person, family, or group you want to follow. Nested rows form that subject's path over time.

```markdown
- A Person @a
  - > i:school "Shared School" [student]
    - > g:company "Company" [founder]

- B Person @b
  - > i:school [classmate]
    - > g:company [board]
```

In this example, `A` and `B` meet at the same `i:school` node. Their paths continue from that shared school node to the same `g:company` node. The node is shared; the path color follows the top-level subject.

## Why not clusters?

The map should explain relationships through real shared nodes, not artificial clusters.

Instead of writing a vague `Academic Circle` cluster, write the actual institution:

```markdown
- Aylin Soyer @aylin_soyer
  - > i:ankara_sbf "Ankara SBF" [student]

- Bora Erim @bora_erim
  - > i:ankara_sbf [schoolmate]
```

If two subjects share a university, party, company, union, publication, city, region, or event, they should point to the same node id. The renderer merges repeated ids.

## No person targets in relation lines

People are subjects, not relation targets. A relationship between people must be expressed by linking each person to the same explanatory node: an event, place, institution, group, family, publication, document, or sector.

Avoid:

```markdown
- A Person @a
  - ~> @b "B Person" [friend]
```

Also avoid putting people under a relation node:

```markdown
- A Person @a
  - > e:school_circle "School circle" [friendship]
    - ~> @b "B Person" [participant]
```

Prefer separate subject paths into the same node:

```markdown
- A Person @a
  - > e:school_circle "School circle" [friendship]
    - > i:school "Shared School" [place]

- B Person @b
  - > e:school_circle [friendship]
    - > i:school [place]
```

For family and marriage relations, use shared family or event nodes:

```markdown
- A Person @a
  - > e:a_b_marriage "A-B marriage" [spouse]
  - > f:family_ab "A-B family" [parent]

- B Person @b
  - > e:a_b_marriage [spouse]
  - > f:family_ab [parent]

- C Person @c
  - > f:family_ab [child]
```

This keeps the graph readable because person nodes do not become dense hairballs. The explanation lives in the middle node.

## Node ids

```text
@id   person
f:id  family
g:id  group / party / union / company / organization
i:id  institution / school / university
p:id  place / city / region / country
e:id  event / congress / election / foundation
m:id  media / publication / journal
s:id  sector / ideology / field
d:id  document / source
```

Examples:

```markdown
- Aylin Soyer @aylin_soyer [academic]
- Demir Family f:demir_family [family]
- Reform Party g:reform_party [party]
- Ankara SBF i:ankara_sbf [institution]
```

## Relation operators

```text
>    confirmed / direct relation
~>   weak / informal / social relation
?>   claimed / needs source
x>   ended / split / left / disproved
!>   critical relation
```

Examples:

```markdown
- Ali Demir @ali_demir
  - > i:boun "Boğaziçi University" [student]
    - > g:demir_holding "Demir Holding" [founder]
      - > p:marmara_ports "Marmara Ports" [region]
  - > e:boun_school_circle "Boun school circle" [schoolmate]
    - > i:boun [place]
  - x> g:old_party "Old Party" [left]
  - ?> d:report_12 "Report 12" [mentioned]
```

## Fields

```text
"..."  first-use display label for a node
[...]  relation or node tags
(...)  date or date range
{...}  plain note
```

A node only needs its full display label once:

```markdown
- Aylin Soyer @aylin_soyer
  - > i:ankara_sbf "Ankara SBF" [student]

- Bora Erim @bora_erim
  - > i:ankara_sbf [schoolmate]
```

Both paths point to the same `i:ankara_sbf` node.

## Chronology through nesting

Nested rows mean continuation of that subject's path:

```markdown
- Aylin Soyer @aylin_soyer
  - > i:ankara_sbf "Ankara SBF" [student]
    - > m:forum_journal "Forum Journal" [published-in]
      - > g:reform_party "Reform Party" [founder]
```

This reads as:

```text
Aylin Soyer -> Ankara SBF -> Forum Journal -> Reform Party
```

Sibling rows are parallel relations without a stated sequence:

```markdown
- Aylin Soyer @aylin_soyer
  - > i:ankara_sbf "Ankara SBF" [student]
  - > g:reform_party "Reform Party" [founder]
```

## Render rules

- Repeated ids merge into one node.
- Nodes are neutral and styled by type.
- Edges are colored by the top-level subject.
- Relation lines that target `@person` are shown as validation warnings.
- When the same relation node is reused at multiple indentation depths, it is placed at its deepest/rightmost required depth.
- After parsing, edge constraints are propagated so every relation flows left-to-right; the renderer should not draw a logical step backwards.
- This keeps a person's route visually traceable across institutions, groups, places, events, companies, and mediated people.
- Shared nodes make school friendships, organizational continuity, family ties, institutional careers, monopolies, cartels, unions, party movements, and regional power relations readable without fake clusters.

## Built-in samples

The app includes compact relationmap samples under `public/samples`:

```text
academic-political-network.ftmd  school -> publication -> party / union paths
family-business-region.ftmd      family -> company -> sector / region / board paths
union-board-network.ftmd         union -> board -> media / event / document paths
turkiye-1940.ftmd                detailed mediated Turkish left network sample
```

Sample data should also avoid relation lines targeting people. Use event, institution, group, family, place, or document nodes to explain relationships.

## Development

```bash
bun install
bun dev
```

Then open `http://localhost:3000`.

Useful scripts:

```bash
bun run lint
bun run build
```
