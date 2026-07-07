Evet, burada artık tek tek bug fix değil, **layout motorunu bir üst seviyeye çıkarma** işi var.
Sorunların çoğu aynı kökten geliyor:

* node genişlikleri ile subtree genişlikleri birbirine karışıyor
* generation bazlı yerleşim yapılmıyor
* union/wedding node, partner center ve child edge renklendirmesi ayrı kavramlar olarak ele alınmıyor
* legend basitçe alta basılıyor, ölçülüp yerleştirilmiyor

Aşağıda bunu **uygulanabilir bir plan** olarak topladım.

---

# Hedef

Ağaç şu prensiplerle çalışmalı:

1. **Legend overlap etmeyecek**
2. **Aynı kuşak generation-based hizalanacak**
3. **Cousin / sibling / spouse kümeleri generation bazında gruplanacak**
4. **Leaf spacing subtree yüzünden gereksiz açılmayacak**
5. **Status label’ları sadeleştirilecek**
6. **Wedding node tam merkezden üretilecek**
7. **Wedding node sonrası child edge rengi, çocuğun effective rengi olacak**
8. **Curved ve elbow modları aynı semantik renklendirme kuralını paylaşacak**

---

# Sorun bazlı plan

## 1) Legend alt kısımda iç içe giriyor

### Problem

Legend item’lar sabit aralıkla basılıyor gibi davranıyor.
Label uzunlukları ölçülmediği için:

* yazılar birbirine giriyor
* bazı item’lar dot üzerine biniyor
* küçük ekranda taşma artıyor

### Çözüm planı

Legend render’ı “sabit 120px slot” mantığından çıkarılmalı.

### Yapılacaklar

* Legend item için gerçek text uzunluğu bazlı width hesapla
* Her item’i şu yapı ile ölç:

  * color dot
  * dot-label gap
  * label text width
  * item padding
* Legend layout’u satır bazlı olsun:

  * önce tek satıra sığdırmayı dene
  * sığmazsa wrap et
  * her satırı ortala
* Legend yüksekliği dinamik hesaplanmalı
* SVG total height buna göre artırılmalı

### Teknik not

`renderLegend(...)` fonksiyonu yeniden yazılmalı.
Gerekirse helper:

```ts
measureLegendItem(label) -> width
layoutLegendRows(items, maxWidth) -> rows
```

### Kabul kriteri

* Legend hiçbir durumda overlap etmeyecek
* Uzun label’lar olsa bile okunabilir olacak
* Bottom padding korunacak

---

## 2) Yapraklar arası mesafe gereksiz geniş

### Problem

Leaf spacing şu an subtree width tarafından gereğinden fazla şişiyor.
Özellikle cousin blokları boşluğa yayılıyor.

### Kök sebep

* her child subtree bağımsız büyüyor
* sibling/cousin packing yapılmıyor
* aynı generation’daki kişiler topluca hizalanmıyor

### Çözüm planı

Mevcut “recursive subtree width” yaklaşımı tek başına yeterli değil.
Yeni aşama olarak **generation-aware compaction** eklenmeli.

### Yapılacaklar

* İlk aşamada node tree’den **render groups** üret:

  * person
  * spouse row
  * union node
  * child cluster
* Sonra her person için generation depth belirle
* Her generation’daki tüm person/spouse kartlarını ayrı koleksiyon halinde topla
* Aynı generation içinde:

  * sibling groups
  * cousin groups
  * spouse groups
    hesaplanmalı
* Compact placement algoritması uygulanmalı:

  * minimum horizontal gap
  * group box collision kontrolü
  * subtree anchor alignment korunmalı

### Basit kural

Aynı kuşakta:

* kişi
* kişinin eşi/eşleri
* aynı parent union’dan gelen kardeşler
* aynı üst kuşakta ilişkili cousin clusters

birer **layout group** olarak ele alınmalı.

### Kabul kriteri

* Aynı level’daki kişiler ekranı gereksiz açmadan yerleşmeli
* Cousin grupları anlaşılır ama sıkışık olmayan aralıkla görünmeli
* Çok geniş boş beyaz alanlar azalmalı

---

## 3) Aynı kuşaktaki çocuklar ve eşler generation bazında align edilmeli

Bu, en kritik mimari iş.

### Hedef davranış

Her generation için şu mantık çalışmalı:

* Aynı kuşaktaki ana kişiler hizalı
* Onların spouse row’ları aynı baseline’da
* Aynı union’dan gelen children blokları tutarlı
* Cousin grupları birbirini bozmadan sıralı

### Çözüm planı

Mevcut recursive render yerine iki aşamalı yerleşim öneriyorum:

---

## Aşama A — Structural normalization

Tree önce şu yapıya normalize edilecek:

```text
Person
  -> spouse row
  -> union node(s)
  -> child groups
```

Her person için:

* anchor person
* spouse group
* unions
* descendants

ayrık tutulmalı.

---

## Aşama B — Generation layout pass

Ayrı bir pass ile:

* generation 0
* generation 1
* generation 2
* ...

katmanları çıkarılmalı.

Her katmanda şu yapılmalı:

1. node’ları group’lara ayır
2. group bounding box hesapla
3. çakışmayı çöz
4. parent-union anchor’larını child cluster’lara göre orta noktala

### Group türleri

Örnek:

```text
Group A: Ivan V + Praskovia
Group B: Catherine Ivanovna + Charles Leopold
Group C: Anna Ioannovna
```

Bir alt generation’da:

```text
Group D: Anna Leopoldovna + Anthony Ulrich
```

### Sonuç

Hem spouse alignment düzelir hem de child placement daha doğal olur.

---

## 4) Status etiketleri sadeleştirilmeli

### Problem

Şu an görselde:

* `[v]`
* `[m:regent]`
* `[m]`

ham biçimde çıkıyor.

Bu UI açısından fazla teknik görünüyor.

### İstenen davranış

* `[v]` → `v`
* `[m]` → `m`
* `[m:regent]` → `regent`

### Çözüm planı

Status parsing ile status display birbirinden ayrılmalı.

### Yapılacaklar

Yeni helper:

```ts
formatStatusLabel(tag: string): string
```

Örnek kurallar:

```ts
[v] semantic => label "v"
[m] semantic => label "m"
[m:regent] semantic => label "regent"
[x] => "x"
[will] => "will"
[red] => "red"
```

Daha genel kural:

* `m:something` varsa `something`
* düz tek token ise kendisi
* bracketlar zaten hiç render edilmeyecek

### Kabul kriteri

Kart üstündeki pill daha kısa ve temiz görünecek.

---

## 5) Wedding node sonrası child line rengi yanlış

### Problem

Şu an union/wedding node’dan child’a giden çizgiler özellikle biological default maviye düşüyor.
Ama senin istediğin şu:

### Kural

**Wedding node’dan sonra devam eden her child edge, bağlandığı leaf’in effective color’ını taşımalı.**

Yani:

* `[v]` ise kırmızı
* `[m:regent]` ise altın/sarımsı
* adopted ise adopted rengi
* step ise step rengi
* status visible değilse underlying relation rengi

### Çözüm planı

Connector renklendirmesi iki aşamaya ayrılmalı:

1. **partner → wedding node**

   * spouse/former spouse relation rengi

2. **wedding node → child**

   * child person’ın effective visual color’ı

### Yeni helper

```ts
resolvePersonEffectiveColor(person, incomingRelation, config): string
```

Bu hem kart border’ı hem child edge için tek source of truth olsun.

### Curved için

Union point → child anchor path
stroke = child effective color

### Elbow için

Union point → trunk / sibling bar / vertical drop
child’e ait segmentler = child effective color

Burada önemli karar:
Elbow modunda ortak sibling bar tek renkte mi olacak, child-specific mi?

Senin söylediğine göre ayırıcı nokta wedding node.
O zaman önerim:

* union point’ten child branch ayrıldıktan sonra child-specific color başlasın
* ortak üst trunk spouse/union renginde kalabilir
* child’a giden branch child renginde olmalı

Bu görsel olarak daha anlamlı.

---

## 6) Wedding node eşin altından değil, iki eşin ortasından başlamalı

### Problem

Union point şu an daha çok partner altına yapışıyor.

### İstenen davranış

Wedding node, **anchor person ile spouse row’daki ilgili partnerin görsel merkezinden** türetilmeli.

### Çözüm planı

Union point hesaplaması açık biçimde değiştirilmeli.

### Kural

Bir union için:

* source A = anchor bottom center
* source B = spouse bottom center
* wedding node x = `(A.x + B.x) / 2`
* wedding node y = max(A.y, B.y) + offset

Yani iki kartın gerçek ortasından türemeli.

### Çoklu spouse durumunda

Her union kendi partneri ile kendi wedding node’una sahip olacak.

Örnek:

```text
[Mehmet] [Fatma] [Sema]
   union1   union2
```

Her ikisi Mehmet ile ayrı midpoint alır.

### Kabul kriteri

* Wedding node hiçbir zaman tek eşin altına yapışmış görünmeyecek
* Görsel olarak iki partner arasında duracak

---

# Teknik uygulama alanları

Ağırlıklı değişecek yer:

```text
src/lib/familytree.ts
```

Muhtemel yan etkiler:

```text
src/components/family-tree-how-to-sheet.tsx
```

Sadece config açıklaması / legend label’ları için gerekebilir.

---

# Önerilen iş sırası

Ben bunu şu sırayla yaptırırım:

## Faz 1 — Görsel doğruluk

1. Wedding node midpoint hesabını düzelt
2. Child edge rengini effective child color yap
3. Status label formatını düzelt
4. Legend overlap sorununu çöz

## Faz 2 — Layout sıkıştırma

5. Leaf spacing ve subtree width mantığını düzenle
6. Same generation group alignment altyapısını kur
7. Cousin / spouse / sibling group compaction yap

## Faz 3 — Son rötuş

8. Curved modda tüm child dağıtım path’lerini tam curved hale getir
9. Elbow modda child-specific colored branch mantığını temizle
10. Screenshot bazlı regression check yap

---

# Antigravity’ye verilecek task listesi

İstersen bunu direkt görev metni gibi kullan:

```text
1. Fix legend layout so legend items never overlap.
2. Replace fixed legend slot widths with measured label widths.
3. Add wrapped / row-based legend layout and dynamic legend height.
4. Refactor layout so same-generation persons and spouse rows can be grouped and aligned together.
5. Reduce excessive leaf spacing by separating subtree width from compact generation packing.
6. Introduce generation-aware grouping for siblings, cousins, and spouse groups.
7. Ensure same-generation people and their spouses are aligned as grouped layout blocks.
8. Change status pill rendering:
   - [v] -> v
   - [m] -> m
   - [m:regent] -> regent
9. Make the wedding node be computed from the midpoint between the two spouses, not from under the spouse card.
10. Split connector color semantics:
   - spouse -> wedding node uses spouse/former-spouse color
   - wedding node -> child uses child effective color
11. Apply the same color rule in both curved and elbow modes.
12. In curved mode, child connectors after the wedding node must use the child effective color.
13. In elbow mode, child branches after the wedding node must use the child effective color.
14. Keep status visibility behavior intact.
15. Keep adopted/step/biological relation styles intact.
16. Do not change notation syntax.
17. Run lint and build after changes.
```

---

# Kabul kriterleri

İşin bittiğini anlamak için net checklist:

```text
- Legend items do not overlap.
- Long legend labels remain readable.
- Same-generation nodes are visually grouped better.
- Cousin rows do not spread across the canvas unnecessarily.
- Wedding nodes appear between the two partners.
- Status pills show simplified labels.
- [v] renders as v.
- [m:regent] renders as regent.
- Curved mode child edges after wedding node use child effective color.
- Elbow mode child edges after wedding node use child effective color.
- Child edge color matches the child’s visible status color when present.
- If no visible status override exists, child edge color falls back to relation color.
```

