# Kézikönyv Szerkesztő

Böngészőben futó, egyetlen `index.html` fájlból álló szerkesztő kézikönyvek / belső dokumentációk összeállításához. Markdown fejezetekből épít fel egy stílusos, kereshető, navigálható HTML oldalt, amit közvetlenül fel lehet tölteni pl. GitHub Pages-re.

Nincs build lépés, nincs szerver — csak nyisd meg az `index.html`-t egy böngészőben (Chrome/Edge ajánlott a teljes funkcionalitáshoz).

Kétféle módban használható:

- **Helyi mappa mód** — egy projekt a saját géped egy mappájában él, csak te férsz hozzá.
- **Felhő mód** — bejelentkezés után a projekt a Supabase-ben (közös, megosztott tárhelyen) él, így kollégáid is hozzáférnek és szerkeszthetik ugyanazt.

## Tartalom

- [Közös, felhő alapú szerkesztés (bejelentkezéssel)](#közös-felhő-alapú-szerkesztés-bejelentkezéssel)
- [Kezdőlap: Projektek és Dokumentumok](#kezdőlap-projektek-és-dokumentumok)
- [Projekt betöltése és mentése (helyi mappa mód)](#projekt-betöltése-és-mentése-helyi-mappa-mód)
- [Fejezetek szerkesztése](#fejezetek-szerkesztése)
- [Markdown szintaxis](#markdown-szintaxis)
- [Megjelenés testreszabása](#megjelenés-testreszabása)
- [Navigáció (menü) szerkesztése](#navigáció-menü-szerkesztése)
- [Build / exportálás](#build--exportálás)
- [Projekt mappa szerkezete](#projekt-mappa-szerkezete)
- [Ismert korlátok](#ismert-korlátok)

---

## Közös, felhő alapú szerkesztés (bejelentkezéssel)

Az oldal megnyitásakor egy bejelentkező képernyő fogad — ez addig fedi le a felületet, amíg valaki nem jelentkezik be egy érvényes, a szervezet által létrehozott felhasználóval (email + jelszó). Új felhasználót önállóan nem lehet regisztrálni: a hozzáférést egy adminisztrátor adja meg a Supabase-projekt **Authentication → Users** felületén (`Invite user` / `Add user`).

Bejelentkezés után a **Kezdőlap** fogad (lásd következő szakasz) — innen érhető el az összes közös, felhőben tárolt Projekt és az azokban lévő Dokumentum (kézikönyv).

Amíg egy felhőben tárolt **Dokumentum** van megnyitva a szerkesztőben, minden mentés — fejezet gépelése közbeni automatikus mentés, kézi **💾 Mentés**, új fejezet létrehozása, fejezet átnevezése, sorrend átrendezése, menü- és CSS-mentés, valamint a **⬇ Letöltés** kimenete is — közvetlenül a Supabase Storage-ba kerül, nem a böngésző helyi tárolójába vagy a gép mappájába. Így amit az egyik kolléga elment, azt egy másik — ugyanazt a Dokumentumot megnyitva — azonnal látja.

A jobb felső sarokban, a felhasználó email-monogramját mutató kör gombra kattintva nyílik meg a **Profil** menü, ez tartalmazza a teljes email címet, a **"🔑 Jelszó módosítása"** és a **"Kilépés"** gombokat.

A **"🔑 Jelszó módosítása"** gombbal bármikor lecserélhető a saját jelszó (nem kell hozzá a régi jelszó megadása, csak be kell lenni jelentkezve). A bejelentkező képernyőn az **"Elfelejtett jelszó?"** linkkel jelszó-visszaállító email kérhető — ez, ahogy a felhasználó-meghívó email is, a Supabase alapértelmezett email-küldőjén megy, aminek szigorú (óránkénti néhány email) korlátja van; ha nem érkezik meg az email, ez a korlát az oka, és a Profil menü "🔑 Jelszó módosítása" gombjával (vagy egy adminisztrátor által a Supabase felületén kézzel beállított új jelszóval) lehet megkerülni.

A **"Kilépés"** gomb kijelentkeztet és visszavisz a Kezdőlapra; ezután a bejelentkező képernyő újra megjelenik.

**Fontos korlát:** ha két ember *egyszerre*, ugyanabban a fejezetben dolgozik, a később mentett verzió felülírja a korábbit — nincs beépített ütközéskezelés vagy zárolás. Érdemes egy fejezetet egyszerre csak egy embernek szerkesztenie.

---

## Kezdőlap: Projektek és Dokumentumok

Bejelentkezés után a **Kezdőlap** mutatja a közös, felhőben tárolt **Projekteket** — egy Projekt egy ügyfél, termék vagy belső téma köré szervezett gyűjtemény, amelyhez egy vagy több **Dokumentum** (egy-egy teljes kézikönyv, ugyanolyan felépítéssel, mint korábban egy "projekt") tartozhat.

Mind a Kezdőlapon (Projekt kártyák), mind egy Projekt nézetében (Dokumentum kártyák) ugyanaz a kártyaszerkezet jelenik meg: 2, széles kártya egy sorban, a gombok pedig egy fix sávban, mindig láthatóan a kártya alján — nem csak kártya fölé húzáskor bukkannak elő.

- **Projekt kártyák a Kezdőlapon**: mindegyik mutatja a nevét, leírását, a hozzá tartozó dokumentumok számát, valamint a projekthez választott színt és ikont. A kártya alján lévő gombsor:
  - **✏ Szerkesztés**: a Projekt nevét, leírását, színét és ikonját lehet módosítani — ugyanaz az űrlap, mint új Projekt létrehozásakor, csak a meglévő adatokkal előtöltve.
  - **🗑 Törlés**: törli a teljes Projektet — ez véglegesen eltávolítja az ÖSSZES benne lévő Dokumentumot, azok fejezeteit, CSS-ét és beállításait a felhőből (megerősítést kér, mert nem vonható vissza).
  - **Megnyitás**: megnyitja a Projekt nézetét (ugyanezt teszi, ha magára a kártyára kattintasz).
- **🔍 Keresés**: a Kezdőlap tetején lévő keresőmezővel a Projektek nevére és leírására lehet szűrni.
- **➕ Új projekt**: a rácsban lévő szaggatott keretű kártyára kattintva nyílik meg az űrlap — itt adható meg a Projekt neve, egy opcionális leírás, valamint egy szín és egy ikon (kattintással választható egy előre elkészített készletből).
- **Dokumentum kártyák egy Projekt nézetében**: a cím, a fejezetszám és az utolsó frissítés alatt egy gombsor:
  - **✏ Szerkesztés**: bekéri a Dokumentum új, megjelenített címét. (Ez csak a címet változtatja, a Dokumentum azonosítóját — vagyis a felhőben lévő mappa nevét — nem.)
  - **➡️ Áthelyezés**: a Dokumentum átvihető egy másik, meglévő Projektbe — a legördülőben kiválasztott célprojektbe átmásolódik az összes fejezete, a CSS-e és a beállításai, majd törlődik a régi helyéről. (Ha a célprojektben már van ugyanilyen azonosítójú Dokumentum, az áthelyezés meghiúsul — ilyenkor előbb nevezd át valamelyiket.)
  - **⬇ HTML**: a legutóbb "⬇ Letöltés"-sel legenerált HTML-t tölti le közvetlenül, a szerkesztő megnyitása nélkül — lásd lent, "Gyors letöltés és megosztható link".
  - **🔗 Link**: egy egyedi, megosztható linket másol a vágólapra, ami a Dokumentum legutóbb legenerált HTML-jét nyitja meg — lásd lent.
  - **🗑 Törlés**: törli a teljes Dokumentumot — ez véglegesen eltávolítja az összes fejezetét, a CSS-ét és a beállításait a felhőből (megerősítést kér, mert nem vonható vissza).
  - **Megnyitás**: megnyitja a Dokumentumot a szerkesztőben (ugyanezt teszi, ha magára a kártyára kattintasz).
- **➕ Új dokumentum**: egy Projekt nézetében, a dokumentum-lista végén lévő kártyával hozható létre egy új, üres Dokumentum (egy induló "Bevezetés" fejezettel) — ehhez azonosítót (szóköz nélkül) és egy megjelenített címet kell megadni.
- **📤 Helyi projekt importálása**: egy Projekt nézetében elérhető gomb — egy már betöltött, *helyi* (nem felhő) projekt egy kattintással feltölthető ebbe a Projektbe, új Dokumentumként. Az összes fejezet, a CSS és a beállítások (config.json) átmásolódnak; az eredeti, helyi másolat közben változatlanul megmarad a gépen / böngészőben.
- **Morzsamenü (breadcrumb)** a felső sáv *alatt*, egy önálló, teljes szélességű sorban mindig mutatja, hol jársz (Kezdőlap / Projekt neve / Dokumentum címe), és bármelyik szintre vissza lehet kattintani belőle. (Ez a sor csak Projekt- vagy szerkesztő nézetben jelenik meg — a Kezdőlapon nincs rá szükség, hiszen ott vagy.) A morzsamenü azért kapott saját sort a gombokkal teli felső sáv alatt, hogy hosszú Projekt- vagy Dokumentum-nevek se törhessék több, egymásra csúszó sorba a felső sávot — helyette önmaguk csonkulnak "…"-tal, ha nagyon hosszúak.

### Felső sáv elrendezése

A felső sáv bal oldalán egyetlen **"🏠 Kezdőlap"** gomb van (korábban ez egy külön logó és egy külön házikó-gomb volt, most egy gomb, egy célponttal), mellette a Projekt-választó legördülő (gyors váltás a már betöltött Dokumentumok között — szerkesztő nézetben jelenik meg).

A jobb oldalon, szerkesztő nézetben, ebben a sorrendben:

1. **⚙ Beállítások** — megnyitja a "Projektek kezelése" gyors váltó/átnevező/törlő panelt (lásd lent).
2. **💾 Mentés**
3. **✨ AI**
4. **⬇ Letöltés**
5. **↗ Előnézet** — az élő előnézetet külön böngészőlapra nyitja ki, hogy a szerkesztő nagyobb helyet kapjon.

Egészen a jobb szélen a kerek **Profil**-gomb (a felhasználó email-monogramja, pl. „DB”) — erre kattintva nyílik meg a jelszó módosítása és a kijelentkezés (lásd fent).
- A jogosultság-modell egyszerű: **minden bejelentkezett felhasználó minden Projektet és Dokumentumot lát és szerkeszthet** — nincs Projektenkénti vagy Dokumentumonkénti hozzáférés-korlátozás.

Helyi mappa módban dolgozva (lásd lent) a Kezdőlap nem jelenik meg — a szerkesztő rögtön a mappa tartalmával nyílik meg, ahogy eddig is.

---

## Projekt betöltése és mentése (helyi mappa mód)

## Projekt betöltése és mentése

A **📂 Projekt mappa megnyitása** gombra kattintva válaszd ki a projekt mappáját.

- **Chrome / Edge (asztali gép):** a mappa-választó rögtön **írási jogot** is kér. Ettől kezdve minden mentés — gépelés közbeni automatikus mentés, fejezet létrehozás, sorrend átrendezés, menü- és megjelenés-mentés — közvetlenül **ebbe a mappába** kerül, külön le- vagy feltöltés nélkül.
- **Más böngésző / nem támogatott környezet:** a szerkesztő automatikusan visszaesik a régi, csak-olvasható betöltésre — ott a **💾 Mentés** gombbal (vagy Ctrl+S-sel) fájlonként kell menteni, és a végén a **⬇ Letöltés**-sel előállított HTML-t manuálisan kell feltölteni.

### Automatikus mentés

- Gépelés közben kb. 2 másodperccel a szünet után a fejezet tartalma automatikusan elmentődik: a böngésző saját tárolójába (IndexedDB) mindig, a projekt mappájába pedig akkor, ha van hozzá írási jog.
- Új fejezet létrehozásakor a fájl azonnal létrejön a mappában is (ha van írási jog).
- A fejezetek sorrendjének átrendezése (húzd-és-ejtsd a bal oldali listában) és a navigációs menü összeállítása is a `config.json`-ba íródik ki, nem csak a generált HTML-be — így egy másik gépen / böngészőben megnyitva a projektet, a sorrend és a menü is megmarad.

---

## Fejezetek szerkesztése

A bal oldali sávban látod a fejezeteket, középen a markdown szerkesztő, jobb oldalt az élő előnézet.

- **🔄 Frissítés** gomb az előnézet fejlécében: csak az előnézetet tölti újra, az egész oldal nem frissül.
- **Fejezet / Teljes dokumentum** váltó: az előnézet mutathatja csak az aktuális fejezetet, vagy az egész kézikönyvet egyben (ez utóbbi a navigációval és kereséssel együtt — ez felel meg a végleges, buildelt oldalnak).
- A szerkesztő a hosszú sorokat (pl. egy hosszú mondatot, vagy egy beillesztett kép base64-be ágyazott adatát) a panel szélességéhez töri, nem kell miattuk oldalra görgetni. Ez kizárólag a szerkesztő nézetét érinti — a mentett `.md` fájlba és a generált HTML-be nem kerül be emiatt semmilyen új sortörés, a bal oldali sorszámok pedig a több sorra tört szöveggel együtt, azzal pontosan egyező magassággal jelennek meg.
- Képek beillesztése: **beillesztéssel (Ctrl+V)** vagy **húzd-és-ejtsd**-del a szerkesztőbe. A képek automatikusan tömörödnek (WebP, max. 1440px szélesség), hogy a fejezet fájlja és a mentés ne híz­zon el feleslegesen sok kép esetén sem.

### ⚙ Projektek kezelése (a szerkesztő felső sávjában)

A szerkesztő felső sávjában lévő legördülő + ⚙ gomb egy régebbi, a Kezdőlap/Projekt-hierarchia bevezetése előtti panelt nyit meg, amely az adott böngészőben **éppen betöltött** összes Dokumentumot (és helyi projektet) egy listában mutatja, gyors váltás/átnevezés/törlés céljából.

- Minden **felhőben tárolt** Dokumentum sora ☁️ ikonnal, a neve mellett pedig — gondolatjellel elválasztva — a szülő **Projekt** nevével jelenik meg (pl. „☁️ Felhasználói kézikönyv — Peers"). Erre azért van szükség, mert két különböző Projektben lehet azonos című Dokumentum — enélkül a lista megkülönböztethetetlen sorokat mutatna.
- A **helyi** (nem felhő) projektek sora nem kap ☁️ jelölést, se alcímet.
- Az itteni **✏ átnevezés** felhő Dokumentumnál nemcsak a böngésző memóriájában/IndexedDB-jében írja át a címet, hanem a Supabase Storage-ban lévő `config.json`-t is frissíti — így a Projekt nézet dokumentum-listája és a kollégák is azonnal a új címet látják.
- Az itteni **🗑 törlés** felhő Dokumentumnál a Supabase Storage-ból is véglegesen törli a Dokumentum összes fájlját (fejezetek, CSS, beállítások) — nem csak a helyi hivatkozást felejti el. (Megerősítést kér, mert nem vonható vissza.)
- Ugyanez az átnevezés/törlés a Kezdőlap → Projekt nézet Dokumentum-kártyáinak ✏/🗑 gombjaival is elvégezhető — a kettő ugyanazt az adatot módosítja, csak két különböző felületről.

---

## Markdown szintaxis

A szerkesztő egy leegyszerűsített markdown-változatot ért. Az eszköztár gombjai a leggyakoribb elemeket be tudják szúrni, de kézzel is írhatod őket.

| Elem | Szintaxis | Megjegyzés |
|---|---|---|
| Félkövér | `**szöveg**` | |
| Dőlt | `*szöveg*` | |
| Kód (inline) | `` `kód` `` | |
| Címsor 1 | `# Cím` | HTML-ben `<h2>`, automatikusan kap egy hivatkozható azonosítót |
| Címsor 2 | `## Cím` | HTML-ben `<h3>` |
| Címsor 3 | `### Cím` | HTML-ben `<h4>` |
| Címsor 4 | `#### Cím` | HTML-ben `<h5>` (a legfrissebb szint) |
| Felsorolás | `- elem` | |
| Számozott lista | `1. elem` | |
| Kiemelt doboz | `> szöveg` | színe a Megjelenés fülön állítható |
| Link | `[szöveg](url)` | |
| Kép | `![alt szöveg](kép)` | a szöveg alatti `*dőlt sor*` a képaláírás |
| Képek egymás alatt, közös keretben | `<!-- shot-stack -->` ... képek ... `<!-- /shot-stack -->` | |
| Kód blokk | ` ```kód``` ` | |
| Táblázat | markdown táblázat (`\|` és `---`) | |
| Lenyíló elem (harmonika) | lásd lent | |

### Hivatkozás egy címsorra

Minden címsor (Címsor 1–4) automatikusan kap egy azonosítót a szövegéből (kisbetűs, szóköz helyett kötőjel, ékezetek megmaradnak). Erre így hivatkozhatsz:

```
## Telepítés lépései
```

```
[ugrás a telepítéshez](#telepítés-lépései)
```

Ez ugyanabban a fejezetben mindig működik; másik fejezetben lévő címsorra csak a "Teljes dokumentum" nézetben / a végleges buildelt oldalon mutat (ott van csak egyben az összes fejezet). Egy másik fejezet **tetejére** a fejezet saját azonosítójával (`id:` a fejlécben) tudsz ugrani.

### Lenyíló elemek (harmonika / accordion)

Az eszköztár **⬇ Harmonika** gombja beszúr egy induló sablont:

```
<!-- accordion -->
+++ Első kérdés vagy cím
Ide jön az első elem szövege.

+++ Második kérdés vagy cím
Ide jön a második elem szövege.
<!-- /accordion -->
```

A `+++ ` sorok lesznek a kattintható, lenyíló fejlécek; az alattuk lévő szöveg a kinyíló tartalom. Tetszőleges számú `+++` blokk követheti egymást, a bennük lévő szöveg ugyanúgy támogatja a formázást (félkövér, lista, kép stb.), mint bárhol máshol.

---

## Megjelenés testreszabása

A projekt-beállítások **CSS** fülén két nézet van:

- **🎨 Egyszerű** (alapértelmezett): magyar nyelvű, egyenként állítható mezők — nincs szükség CSS-tudásra.
  - Kiemelő szín (linkek, címek, gombok)
  - Oldal háttérszíne
  - Kártya / panel háttere
  - Szöveg színe
  - Másodlagos szöveg színe
  - Szegély színe
  - Kiemelt doboz háttere és szövege (a `>` jellel kezdett rész)
  - Sarok lekerekítés
  - Betűtípus stílus (5 előre elkészített páros: Modern, Barátságos, Klasszikus, Letisztult, Gépelt)
  - Betűméretek külön-külön: Bekezdés, Címsor 1–5
- **&lt;/&gt; Kód (haladó)**: a nyers CSS közvetlen szerkesztése azoknak, akik szeretnék teljesen kézben tartani a stílust. Az Egyszerű nézet módosításai nem írják felül a kézzel írt egyedi CSS-t — egy külön, jól elkülöníthető blokként kerülnek a végére.

A módosítások élőben látszanak az előnézeten; a **✓ Mentés** gombbal kerülnek csak ténylegesen elmentésre (böngészőbe és — ha van írási jog — a mappába is).

---

## Navigáció (menü) szerkesztése

A projekt-beállítások **Beállítások** fülén, a "Navigáció csoportok" alatt húzd-és-ejtsd módszerrel rendezheted a fejezeteket csoportokba / alcsoportokba — ez adja a végleges oldal bal oldali menüjének szerkezetét. A **✓ Mentés** gomb a menüt a `config.json`-ba is kiírja, nem csak a generált HTML-be.

---

## Build / exportálás

- **⬇ Letöltés**: legenerálja a végleges, önálló HTML fájlt (a projekt `config.json`-jában megadott `output` néven, alapból `<projektnév>.html`). Kattintva egy kis menü nyílik:
  - **🖼 Képek optimalizálása** (kipipálható): ha be van pipálva, a beágyazott képek PNG-ről WebP-re konvertálódnak és max. 1440px szélességre kicsinyülnek — ez tud számottevően kisebb fájlt eredményezni, ha sok, tömörítetlen képet tartalmaz a projekt, de a képek minősége kicsit romlik. Alapból nincs bepipálva (eredeti minőség).
  - **⬇ Letöltés indítása**: a kiválasztott beállítással lefuttatja a buildet.
- Felhő Dokumentumnál a Letöltés a generált HTML-t a közös Supabase Storage-ba is felmenti (ez frissíti a publikált oldalt, pl. a GitHub Pages-en), a kép-optimalizálás választásától függetlenül — **és emellett a saját gépedre is lekerül egy másolat**:
  - **Chrome / Edge:** egy natív "Mentés másként" ablak kérdezi meg, hova mentse a fájlt a gépeden.
  - **Más böngésző (pl. Firefox, Safari):** nincs ilyen "hova mentsem" választás, a fájl automatikusan a böngésző alapértelmezett Letöltések mappájába kerül.
- Helyi mappa módban: ha van írási jog a mappához (Chrome/Edge), a build automatikusan a mappába íródik; egyébként ugyanígy a "Mentés másként" ablak (vagy annak hiányában a Letöltések mappa) kerül elő.

### Gyors letöltés és megosztható link (felhő Dokumentumoknál)

A szerkesztőben elért "⬇ Letöltés" minden alkalommal egy fix nevű (`published.html`) másolatot is felment a Dokumentum felhő-mappájába — ez mindig a legutóbb legenerált verziót tartalmazza, nincs hozzá külön verziózás vagy dátumozás. Erre épül két dolog a Projekt nézet Dokumentum-kártyáin:

- **⬇ HTML** — egy kattintással letölti ezt a legutóbbi HTML-t, anélkül hogy meg kellene nyitni a szerkesztőt. Ha a Dokumentumhoz még sosem futott le a Letöltés, egy figyelmeztető üzenet jelzi ezt.
- **🔗 Link** — egy egyedi linket másol a vágólapra (`…#view/projekt-azonosító/dokumentum-azonosító` alakban), amivel a legutóbbi HTML bárkinek elküldhető. A linkre kattintva a normál bejelentkező ablak fogadja a címzettet — csak sikeres bejelentkezés **után** nyílik meg maga a kézikönyv, a szerkesztő felülete nélkül, közvetlenül úgy, mintha magát a HTML fájlt nyitották volna meg. Mivel a link mindig ugyanahhoz a `published.html`-hez vezet, egy újabb Letöltés után nem kell új linket generálni — a régi link is már az új tartalmat mutatja.

> Egyelőre nincs mód arra, hogy egy linket bejelentkezés nélkül, kívülállóknak is megnyithatóvá tegyünk — ez egy jövőbeli bővítési lehetőség.

### GitHub Pages-re feltöltés

Ha nincs írási jogod a mappához (pl. nem Chrome/Edge-et használsz), a legfrissebb `index.html`-t és a generált HTML-t a GitHub webes felületén keresztül tudod feltölteni:

1. Nyisd meg a fájlt a repóban → ceruza (✏) ikon jobb fent → a teljes tartalmat cseréld le → **Commit changes**.
2. **Ne** az "Upload files" / húzd-ide feltöltést használd meglévő fájl cseréjére — Windows alatt ez néha egy `NÉV~1.HTM` nevű, felesleges új fájlt hoz létre a felülírás helyett.

---

## Projekt mappa szerkezete

```
projekt-mappa/
├── config.json     # cím, leírás, navigációs menü, fejezetsorrend
├── style.css       # projekt CSS (opcionális, hiányzik → alapértelmezett stílus)
├── logo.txt        # logó (base64 kép vagy elérési út), opcionális
├── sections/
│   ├── 01_bevezetes.md
│   ├── 02_telepites.md
│   └── ...
└── <projektnév>.html   # a Build gombbal legenerált, végleges oldal
```

Minden `.md` fájl elején egy frontmatter blokk (`---` közé zárva) adja meg a fejezet `id`-jét és `title`-jét:

```
---
id: telepites
title: Telepítés
---

# Telepítés
...
```

---

## Ismert korlátok

- A mappába való közvetlen, automatikus mentés (`showDirectoryPicker` API) jelenleg Chrome és Edge asztali böngészőkben működik. Más böngészőknél a szerkesztő működik, de a fájlokat kézzel kell menteni / feltölteni.
- A "Címsor 1" mező jelenleg csak a borító (első fejezet) fejlécére vonatkozó helyet foglal — a markdown `#` szintje ténylegesen `Címsor 2`-nek megfelelő HTML-elemet hoz létre (lásd a fenti táblázatot); ez a jövőben tisztázásra kerülhet.
- Felhő módban minden bejelentkezett felhasználó minden Projektet és Dokumentumot lát és szerkeszthet (nincs Projektenkénti / Dokumentumonkénti jogosultság-szűkítés) — jelenleg csoport/szerepkör szerinti hozzáférés-korlátozás nincs megvalósítva.
- Felhő módban nincs ütközéskezelés: ha két ember egyszerre szerkeszti ugyanazt a fejezetet, a később mentett verzió felülírja a korábbit.
- Fejezet törlése felhő módban is csak a szerkesztő nézetéből törli a fejezetet — a fájl a Supabase Storage-ban megmarad (ugyanaz a viselkedés, mint helyi mappa módban).
- Egy Dokumentum vagy egy Projekt átnevezése, törlése, illetve egy Dokumentum másik Projektbe áthelyezése mind elérhető a kártyák gombjaival — de a Projekt *azonosítója* (a felhőben lévő mappa neve) sehol nem módosítható a felületről, csak a megjelenített neve.
- Egy Projekt vagy Dokumentum áthelyezése/törlése közben megszakadó internetkapcsolat vagy bezárt böngészőlap félbehagyott állapotot eredményezhet (pl. a fájlok már átmásolódtak az új helyre, de a régiek még nem törlődtek) — ilyenkor érdemes a Supabase Storage felületén ellenőrizni és kézzel rendezni.
