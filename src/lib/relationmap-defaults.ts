export const DEFAULT_RELATION_MAP_EXAMPLE = `---
map: network
country: Fictional
period: 1960-1975
---

# Mediated RelationMap Example

- Aylin Soyer @aylin_soyer [academic] [writer]
  - > i:ankara_sbf "Ankara SBF" [student] (1960-1964)
    - > m:forum_journal "Forum Journal" [published-in] (1964-1967)
      - > g:reform_party "Reform Party" [founder] (1967)
  - > e:soyer_erim_meeting "Soyer-Erim school circle" [schoolmate] (1962)
    - > i:ankara_sbf [place]
    - ~> @bora_erim "Bora Erim" [participant]

- Bora Erim @bora_erim [lawyer]
  - > i:ankara_sbf [student] (1961-1965)
    - > g:legal_aid_union "Legal Aid Union" [founder] (1966)
      - > g:reform_party [legal-advisor] (1968-1971)
  - > e:soyer_erim_meeting [schoolmate] (1962)
    - > i:ankara_sbf [place]
    - ~> @aylin_soyer [participant]

- Reform Party g:reform_party [party]
  - > e:reform_party_foundation "Reform Party foundation" [founded] (1967)
    - > @aylin_soyer [founder]
    - > @bora_erim [legal-advisor]
`;
