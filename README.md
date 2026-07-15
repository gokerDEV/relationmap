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
- Mina Urgan @mina
  - > i:istanbul_uni "İstanbul Üniversitesi" [academic]

- Behice Boran @behice
  - > i:dtcf "Ankara Üniversitesi DTCF" [academic]
```

If two subjects share a university, party, company, union, publication, city, or event, they should point to the same node id. The renderer merges repeated ids.

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
- Behice Boran @behice [academic] [marxist]
- Demir Ailesi f:demir [family]
- Türkiye İşçi Partisi g:tip [party]
- Ankara Üniversitesi DTCF i:dtcf [institution]
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
- Ali Demir @ali
  - > i:boun "Boğaziçi Üniversitesi" [student]
    - > g:demir_holding "Demir Holding" [founder]
      - > p:mersin "Mersin" [region]
  - ~> @ayse "Ayşe Kara" [schoolmate]
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
- Behice Boran @behice
  - > i:dtcf "Ankara Üniversitesi DTCF" [academic]

- Mina Urgan @mina
  - > i:dtcf [circle]
```

Both paths point to the same `i:dtcf` node.

## Chronology through nesting

Nested rows mean continuation of that subject's path:

```markdown
- Behice Boran @behice
  - > i:dtcf "Ankara Üniversitesi DTCF" [academic]
    - > g:tip "Türkiye İşçi Partisi" [chair] (1970-1971)
```

This reads as:

```text
Behice Boran -> Ankara Üniversitesi DTCF -> Türkiye İşçi Partisi
```

Sibling rows are parallel relations without a stated sequence:

```markdown
- Behice Boran @behice
  - > i:dtcf "Ankara Üniversitesi DTCF" [academic]
  - > g:tkp "Türkiye Komünist Partisi" [member]
```

## Render rules

- Repeated ids merge into one node.
- Nodes are neutral and styled by type.
- Edges are colored by the top-level subject.
- This keeps a person's route visually traceable across institutions, groups, places, events, companies, and other people.
- Shared nodes make school friendships, organizational continuity, family ties, institutional careers, monopolies, cartels, unions, party movements, and regional power relations readable without fake clusters.

## Example

```markdown
---
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
  - x> @sadun [split]
```

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
