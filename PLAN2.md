Tamam, yeni fark ettiklerin doğru yönde. Bu aşamada işi ikiye ayırmak lazım:

1. **Notation / parser / renderer contract**
2. **UI configuration + preview interaction**

Mevcut repo tarafında elimizdeki çekirdek dosya `src/lib/familytree.ts`; şu an parser/render API’si burada toplanmış durumda ve dış bağımlılık almıyor. Tipler de `FamilyTreeRelationKind`, `FamilyTreeUnionKind`, `FamilyTreeTheme`, `parseFamilyTree`, `renderFamilyTreeSvg` etrafında kurulmuş durumda.  Repo hâlâ Next/React/Tailwind stack üzerinde; `package.json` Next 16.2.10, React 19.2.4, Tailwind 4 ve Biome kullanıyor.

## Güncellenmiş ürün kararı

Notation açıklamaları artık İngilizce olacak:

```text
+      marriage / spouse
x+     divorced / former spouse
a+     adopted child relation
~      step / external relation
@id    explicit person id / same person reference
"..."  nickname
(...)  birth / death date
{...}  plain text info
[...]  status / inheritance / succession tag
```

Burada kritik ayrım:

```text
relations = actual relationship edges
statuses  = visual override metadata
```

Yani `[v]`, `[m]`, `[x]`, `[red]` gibi şeyler kişi node’unu silmez, ilişkiyi değiştirmez; sadece **status override** olarak çalışır.

---

# Yeni uygulama planı

## 1. `familytree.ts` config modelini genişlet

Şu an theme temel renkleri tutuyor. Bunu daha açık bir render config modeline taşıyalım.

Yeni yapı:

```ts
type FamilyTreeLineStyle = "solid" | "dashed" | "dotted";

type FamilyTreeVisualRule = {
  label: string;
  color: string;
  lineStyle: FamilyTreeLineStyle;
  visible: boolean;
  lockedVisible?: boolean;
};

type FamilyTreeVisualConfig = {
  relations: {
    biological: FamilyTreeVisualRule;
    spouse: FamilyTreeVisualRule;
    formerSpouse: FamilyTreeVisualRule;
    adopted: FamilyTreeVisualRule;
    step: FamilyTreeVisualRule;
  };
  statuses: {
    heir: FamilyTreeVisualRule;
    inheritance: FamilyTreeVisualRule;
    excluded: FamilyTreeVisualRule;
    renounced: FamilyTreeVisualRule;
    will: FamilyTreeVisualRule;
  };
  deceased: {
    desaturate: number; // 0-100, default 50
  };
};
```

Önemli kural:

```text
relation visibility:
  locked visible

status visibility:
  hideable
```

Yani kullanıcı `adopted`, `spouse`, `step`, `formerSpouse` gibi ilişki tiplerini kapatamayacak. Bunlar soy ağacının yapısal parçası. Ama `[v]`, `[m]`, `[x]`, `[red]`, `[will]` gibi status renk override’ları kapatılabilecek.

---

## 2. Renderer renk çözümleme kuralı

Şu an renk seçimi kabaca relation/status üzerinden ilerliyor. Bunu deterministik hale getirelim.

Yeni öncelik sırası:

```text
1. Person deceased desaturation
2. Visible status override
3. Incoming relation color
4. Default bloodline color
```

Daha açık:

```ts
function resolvePersonVisual(person, incomingRelation, config) {
  const relationVisual = config.relations[incomingRelation];

  const visibleStatusVisual = findHighestPriorityVisibleStatus(person.tags, config);

  const baseColor = visibleStatusVisual?.color ?? relationVisual.color;

  return {
    borderColor: applyDeceasedDesaturationIfNeeded(baseColor, person, config),
    lineStyle: relationVisual.lineStyle,
  };
}
```

Status gizlenirse kişi yok olmayacak:

```text
Zeynep [v]
```

`[v]` görünürse kırmızı/varis rengiyle görünür.
`[v]` visibility kapalıysa Zeynep kendi ilişki renginde görünür.

Bu senin söylediğin modeli tam karşılıyor: **statusler ilişkinin altında listelenir ama renk olarak ilişki rengini ezer.**

---

## 3. Relationship + status config UI

How to drawer içinde relation ve statusleri alt alta gösterelim.

Sıralama:

```text
Relationships
- Biological child
- Marriage / spouse
- Divorced / former spouse
- Adopted child
- Step / external

Statuses
- Heir / successor [v]
- Inheritance [m]
- Excluded [x]
- Renounced [red]
- Will / testament [will]

Deceased
- Desaturate slider
```

Her satırda:

```text
Label | color picker | line style select | visibility
```

Ama visibility davranışı farklı:

### Relationships

```text
visible: locked
control: disabled switch / lock icon / "Locked"
```

### Statuses

```text
visible: editable
control: switch
```

Line style sadece edge çizgileri için anlamlı. Statuslerde line style opsiyonunu göstermeyelim veya disabled gösterelim. Daha temiz olan:

```text
Relationships:
  color picker + line style + locked visible

Statuses:
  color picker + visibility

Deceased:
  desaturate slider
```

Bu daha anlaşılır olur.

---

## 4. LocalStorage config versiyonu

Yeni key:

```ts
const FAMILY_TREE_VISUAL_CONFIG_STORAGE_KEY = "familytree.visual-config.v1";
```

Config localStorage’da tutulacak.

Kural:

```text
Eksik config alanı varsa default ile merge edilecek.
Bozuk JSON varsa ignore + default.
Reset config default'a dönecek.
```

Bunun için küçük helper:

```ts
function mergeFamilyTreeVisualConfig(
  stored?: Partial<FamilyTreeVisualConfig>,
): FamilyTreeVisualConfig
```

Bu helper `src/lib/familytree.ts` içinde de olabilir, UI helper dosyasında da olabilir. Ben çekirdekle doğrudan ilgili olduğu için `familytree.ts` içinde tutmayı tercih ederim.

---

## 5. Deceased desaturation

Ölüm tarihi olan kişiler için:

```text
deathDate varsa deceased kabul edilir.
```

Default:

```ts
deceased: {
  desaturate: 50
}
```

Slider:

```text
0   = full color
50  = half desaturated
100 = grayscale
```

SVG içinde bunu iki yoldan yapabiliriz:

### Basit ve güvenli yol

Rengi renderer tarafında hesapla:

```ts
desaturateHexColor(color, amount)
```

Bu en temiz çözüm. SVG filter ile uğraşmayız.

### İleride

Node group’a filter uygulanabilir, ama bu ilk versiyon için gereksiz.

---

## 6. Preview zoom / pan

Preview tarafında SVG string’i bir wrapper içinde render edelim:

```tsx
<div
  onWheel={handleWheelZoom}
  onPointerDown={handlePanStart}
  onPointerMove={handlePanMove}
  onPointerUp={handlePanEnd}
>
  <div
    style={{
      transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
      transformOrigin: "0 0",
    }}
    dangerouslySetInnerHTML={{ __html: svg }}
  />
</div>
```

Kurallar:

```text
mouse wheel up   => zoom in
mouse wheel down => zoom out
drag             => pan
double click     => optional fit window, şart değil
```

Zoom sınırı:

```ts
minScale = 0.25
maxScale = 3
```

Pan/zoom state UI componentte kalmalı. `familytree.ts` bunu bilmemeli.

---

## 7. Fit window

Fit işlemi için SVG viewBox/width/height bilgisini okuyabiliriz.

Basit yaklaşım:

```ts
const svgElement = previewRef.current?.querySelector("svg");
const viewBox = svgElement?.viewBox.baseVal;
```

Sonra container ölçüsüne göre scale hesapla:

```ts
scale = Math.min(
  containerWidth / svgWidth,
  containerHeight / svgHeight,
) * 0.95
```

Pan:

```ts
x = (containerWidth - svgWidth * scale) / 2
y = (containerHeight - svgHeight * scale) / 2
```

Context menu’deki `Fit the window` bunu çağıracak.

---

## 8. Right click context menu

shadcn Context Menu kullanılacak. Doküman doğrudan right click ile açılan action menu olarak tanımlıyor ve `ContextMenu`, `ContextMenuTrigger`, `ContextMenuContent`, `ContextMenuItem` composition veriyor. ([Shadcn UI][1])

Kurulum:

```bash
bunx shadcn@latest add context-menu
```

Preview wrapper:

```tsx
<ContextMenu>
  <ContextMenuTrigger asChild>
    <div className="h-full w-full overflow-hidden">
      preview
    </div>
  </ContextMenuTrigger>

  <ContextMenuContent>
    <ContextMenuItem onClick={fitToWindow}>
      Fit the window
    </ContextMenuItem>
    <ContextMenuItem onClick={downloadSvg}>
      Download SVG
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

shadcn tarafında `ContextMenuItem` doğrudan action satırı olarak kullanılabiliyor. ([Shadcn UI][1])

---

## 9. SVG download

Preview component içinde:

```ts
function downloadSvg() {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "family-tree.svg";
  link.click();

  URL.revokeObjectURL(url);
}
```

Filename ileride title’dan üretilebilir:

```text
yilmaz-kralligi-aile-agaci.svg
```

Ama ilk versiyon için `family-tree.svg` yeterli.

---

## 10. shadcn component ekleri

Önceki plana ek olarak:

```bash
bunx shadcn@latest add context-menu
bunx shadcn@latest add slider
bunx shadcn@latest add switch
bunx shadcn@latest add select
```

Mevcut resizable kullanımı aynen kalacak. Resizable dokümanı `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle` composition’ı gösteriyor; editor/preview ayrımı için hâlâ doğru tercih. ([Shadcn UI][2])

Toplam gerekli shadcn seti:

```bash
bunx shadcn@latest add button
bunx shadcn@latest add sheet
bunx shadcn@latest add resizable
bunx shadcn@latest add card
bunx shadcn@latest add label
bunx shadcn@latest add separator
bunx shadcn@latest add scroll-area
bunx shadcn@latest add context-menu
bunx shadcn@latest add slider
bunx shadcn@latest add switch
bunx shadcn@latest add select
```

---

# Antigravity task plan

Bunu doğrudan verilebilir şekilde yazıyorum:

```text
Update the familytree app with the following rules.

Constraints:
- Keep shadcn default template colors and component implementation unchanged.
- Do not manually write or modify shadcn/ui component files.
- Add missing shadcn components only through `bunx shadcn@latest add ...`.
- Use composition around shadcn components.
- Keep parser/render logic in `src/lib/familytree.ts`.
- Keep preview interaction state in React components, not in the library.

1. Update notation documentation to English:
   +      marriage / spouse
   x+     divorced / former spouse
   a+     adopted child relation
   ~      step / external relation
   @id    explicit person id / same person reference
   "..."  nickname
   (...)  birth / death date
   {...}  plain text info
   [...]  status / inheritance / succession tag

2. Extend `src/lib/familytree.ts` with a visual config model:
   - relation visual rules:
     biological, spouse, formerSpouse, adopted, step
   - status visual rules:
     heir, inheritance, excluded, renounced, will
   - each relation rule has:
     label, color, lineStyle, visible=true, lockedVisible=true
   - each status rule has:
     label, color, visible
   - deceased config:
     desaturate: number, default 50

3. Update SVG renderer:
   - relation colors control edge and default person border color.
   - status colors override relation colors only when status visibility is true.
   - hiding a status must not hide the person; it only disables that status color override.
   - relation visibility is locked visible.
   - support line styles: solid, dashed, dotted.
   - apply deceased desaturation to persons with deathDate.
   - default deceased desaturation must be 50%.

4. Update How to Sheet:
   - open from the left.
   - show notation guide in English.
   - list all Relationships first:
     Biological child, Marriage / spouse, Divorced / former spouse, Adopted child, Step / external.
   - for each relationship show:
     color picker, line style select, locked visibility.
   - list Statuses below relationships:
     Heir / successor [v], Inheritance [m], Excluded [x], Renounced [red], Will / testament [will].
   - for each status show:
     color picker and visibility switch.
   - add Deceased section at the bottom:
     Desaturate slider, default 50%.
   - persist config to localStorage as `familytree.visual-config.v1`.
   - add Reset colors/config button.

5. Update Preview:
   - render live SVG from current editor source and visual config.
   - support wheel zoom in/out.
   - support drag pan.
   - clamp zoom between 0.25 and 3.
   - keep preview scroll-free; pan/zoom handles navigation.
   - add right-click context menu using shadcn Context Menu.
   - context menu actions:
     Fit the window
     Download SVG

6. Implement Fit the window:
   - read rendered svg width/height or viewBox.
   - compute scale to fit preview container with 5% padding.
   - center SVG in preview area.

7. Implement Download SVG:
   - create Blob from current SVG string.
   - download as `family-tree.svg`.

8. Keep editor/preview split with shadcn Resizable:
   - left panel CodeMirror editor.
   - right panel Preview.
   - use `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle`.

9. Run:
   bun run lint
   bun run build
```

## Kabul kriterleri

```text
- Notation guide is fully English.
- Relationships and statuses are visually separated in the left Sheet.
- Relationships are always visible and visibly locked.
- Statuses can be hidden independently.
- Hidden status does not hide the person.
- Status color overrides relation color only when visible.
- Relation line style supports solid, dashed, dotted.
- Color picker changes only relationship/status SVG colors.
- Deceased persons are desaturated by slider value.
- Default deceased desaturation is 50%.
- Preview supports wheel zoom.
- Preview supports drag pan.
- Right click opens shadcn Context Menu.
- Context menu has Fit the window and Download SVG.
- Download exports current SVG.
- shadcn generated files are not manually modified.
- Build and lint pass.
```

Bir not: `visibility` kelimesini ilişkilerde UI’da gösterebiliriz ama gerçek toggle yapmayalım. Orada “Locked visible” görünmesi yeterli. Böylece ileride filtreleme eklemek istersek model hazır olur, ama şu an soy ağacının yapısını bozan bir kapatma davranışı üretmemiş oluruz.

[1]: https://ui.shadcn.com/docs/components/context-menu "Context Menu - shadcn/ui"
[2]: https://ui.shadcn.com/docs/components/resizable "Resizable - shadcn/ui"
