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
