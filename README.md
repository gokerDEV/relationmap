# relationmap

`relationmap` is a Markdown-like editor and SVG renderer for mapping people, families, institutions, groups, companies, parties, unions, places, events, publications, sectors, and documents.

The notation is subject-first. A top-level row is the person, family, or group you want to follow. Nested rows form that subject's path over time.

```markdown
- A Person @a #7c3aed
  - > i:school "Shared School" [student]
    - > g:company "Company" [founder]

- B Person @b #059669
  - > i:school [classmate]
    - > g:company [board]
```

In this example, `A` and `B` meet at the same `i:school` node. Their paths continue from that shared school node to the same `g:company` node. The node is shared; each path keeps the top-level subject color.

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

## No person targets

People are subjects, not relation targets. A relation line should not point to `@person`.

Avoid:

```markdown
- A Person @a
  - ~> @b "B Person" [friend]
```

Also avoid:

```markdown
- A Person @a
  - > e:school_circle "School circle" [friendship]
    - ~> @b "B Person" [participant]
```

Prefer:

```markdown
- A Person @a #7c3aed
  - > e:school_circle "School circle" [friendship]
    - > i:school "Shared School" [place]

- B Person @b #059669
  - > e:school_circle [friendship]
    - > i:school [place]
```

The explanation lives in the shared relation node. Each person connects to that node separately.

For family relations, use a family or event node:

```markdown
- A Person @a #7c3aed
  - > e:a_b_marriage "A-B marriage" [spouse]

- B Person @b #059669
  - > e:a_b_marriage [spouse]

- C Person @c #2563eb
  - > f:family_ab "A-B family" [child]

- D Person @d #dc2626
  - > f:family_ab [child]
```

This keeps the graph readable because person nodes stay in the subject column instead of becoming dense hairballs.

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
- Aylin Soyer @aylin_soyer #7c3aed [academic]
- Demir Family f:demir_family [family]
- Reform Party g:reform_party [party]
- Ankara SBF i:ankara_sbf [institution]
```

## Colors

Use `#hex` directly in notation.

```markdown
- Behice Boran @behice #7c3aed [academic]
  - > i:dtcf "DTCF" [faculty]
    - x> e:dtcf_purge_1948 "DTCF purge" #dc2626 [purged]
```

Rules:

- `@person #hex` sets that person's card color and all path edges from that subject.
- Relation nodes are gray by default.
- `e:/i:/g:/f:/p:/m:/s:/d #hex` gives that relation node an optional accent color.
- Edge color always follows the top-level subject, not the relation node.

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
- Ali Demir @ali_demir #2563eb
  - > i:boun "Boğaziçi University" [student]
    - > g:demir_holding "Demir Holding" [founder]
      - > p:marmara_ports "Marmara Ports" [region]
  - > e:boun_school_circle "Boun school circle" [schoolmate]
  - x> g:old_party "Old Party" [left]
  - ?> d:report_12 "Report 12" [mentioned]

- Ayşe Kara @ayse_kara #dc2626
  - > e:boun_school_circle [schoolmate]
```

## Fields

```text
"..."  first-use display label for a node
#hex   optional node color
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
- Node depth comes from the deepest indentation where that node is used.
- The renderer does not repeatedly push shared nodes to the right, so repeated/cyclic references do not explode the layout.
- Relation nodes are neutral gray unless they have an explicit `#hex` accent.
- Edges are colored by the top-level subject.
- Person targets are parser errors.
- Shared nodes make school friendships, organizational continuity, family ties, institutional careers, monopolies, cartels, unions, party movements, and regional power relations readable without fake clusters.

## Built-in samples

The app includes compact relationmap samples under `public/samples`:

```text
academic-political-network.ftmd  school -> publication -> party / union paths
family-business-region.ftmd      family -> company -> sector / region / board paths
union-board-network.ftmd         union -> board -> media / event / document paths
turkiye-1940.ftmd                detailed mediated Turkish left network sample
```

Sample data should avoid person targets. Use event, institution, group, family, place, or document nodes to explain relationships.

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
