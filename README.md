# Kézikönyv Szerkesztő

Böngészőben futó, egyetlen `index.html` fájlból álló szerkesztő kézikönyvek / belső dokumentációk összeállításához. Markdown fejezetekből épít fel egy stílusos, kereshető, navigálható HTML oldalt, amit közvetlenül fel lehet tölteni pl. GitHub Pages-re.

Nincs build lépés, nincs szerver — csak nyisd meg az `index.html`-t egy böngészőben (Chrome/Edge ajánlott a teljes funkcionalitáshoz).

Kétféle módban használható:

- **Helyi mappa mód** — egy projekt a saját géped egy mappájában él, csak te férsz hozzá.
- **Felhő mód** — bejelentkezés után a projekt a Supabase-ben (közös, megosztott tárhelyen) él, így kollégáid is hozzáférnek és szerkeszthetik ugyanazt.

## Tartalom

- [Közös, felhő alapú szerkesztés (bejelentkezéssel)](#közös-felhő-alapú-szerkesztés-bejelentkezéssel)
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

Bejelentkezés után a felső sávban megjelenik egy **☁️ Felhő** gomb:

- **Meglévő felhő projekt megnyitása**: a gombra kattintva megjelenik a közösen tárolt projektek listája — bármelyikre kattintva ("Megnyitás") betöltődik, ugyanúgy szerkeszthető, mint egy helyi projekt.
- **Új felhő projekt létrehozása**: azonosítót és megjelenített címet megadva egy új, üres projekt jön létre (egy induló "Bevezetés" fejezettel), rögtön a felhőben.
- **Meglévő (helyi) projekt átvitele a felhőbe**: a "☁️ Felhő" ablakban a **"Meglévő (helyi) projekt átvitele a felhőbe"** résznél kiválasztható egy már betöltött, helyi projekt — a **"☁️ Feltöltés a felhőbe"** gomb egy kattintással átmásolja az összes fejezetét, a CSS-ét és a beállításait (config.json) egy új felhő projektbe, majd rögtön meg is nyitja azt. Az eredeti, helyi projekt (a böngésző tárolójában) változatlanul megmarad, csak egy másolat kerül a felhőbe.

Amíg egy **felhő projekt** van megnyitva, minden mentés — fejezet gépelése közbeni automatikus mentés, kézi **💾 Mentés**, új fejezet létrehozása, fejezet átnevezése, sorrend átrendezése, menü- és CSS-mentés, valamint a **⚡ Build** kimenete is — közvetlenül a Supabase Storage-ba kerül, nem a böngésző helyi tárolójába vagy a gép mappájába. Így amit az egyik kolléga elment, azt egy másik — ugyanazt a felhő projektet megnyitva — azonnal látja.

A jobb felső **"🔑 Jelszó"** gombbal bármikor lecserélhető a saját jelszó (nem kell hozzá a régi jelszó megadása, csak be kell lenni jelentkezve). A bejelentkező képernyőn az **"Elfelejtett jelszó?"** linkkel jelszó-visszaállító email kérhető — ez, ahogy a felhasználó-meghívó email is, a Supabase alapértelmezett email-küldőjén megy, aminek szigorú (óránkénti néhány email) korlátja van; ha nem érkezik meg az email, ez a korlát az oka, és a bejelentkezés utáni "🔑 Jelszó" gombbal (vagy egy adminisztrátor által a Supabase felületén kézzel beállított új jelszóval) lehet megkerülni.

A jobb felső **"Kilépés"** gomb kijelentkeztet; ezután a bejelentkező képernyő újra megjelenik.

**Fontos korlát:** ha két ember *egyszerre*, ugyanabban a fejezetben dolgozik, a később mentett verzió felülírja a korábbit — nincs beépített ütközéskezelés vagy zárolás. Érdemes egy fejezetet egyszerre csak egy embernek szerkesztenie.

---

## Projekt betöltése és mentése (helyi mappa mód)

## Projekt betöltése és mentése

A **📂 Projekt mappa megnyitása** gombra kattintva válaszd ki a projekt mappáját.

- **Chrome / Edge (asztali gép):** a mappa-választó rögtön **írási jogot** is kér. Ettől kezdve minden mentés — gépelés közbeni automatikus mentés, fejezet létrehozás, sorrend átrendezés, menü- és megjelenés-mentés — közvetlenül **ebbe a mappába** kerül, külön le- vagy feltöltés nélkül.
- **Más böngésző / nem támogatott környezet:** a szerkesztő automatikusan visszaesik a régi, csak-olvasható betöltésre — ott a **💾 Mentés** gombbal (vagy Ctrl+S-sel) fájlonként kell menteni, és a végén a **⚡ Build**-del előállított HTML-t manuálisan kell feltölteni.

### Automatikus mentés

- Gépelés közben kb. 2 másodperccel a szünet után a fejezet tartalma automatikusan elmentődik: a böngésző saját tárolójába (IndexedDB) mindig, a projekt mappájába pedig akkor, ha van hozzá írási jog.
- Új fejezet létrehozásakor a fájl azonnal létrejön a mappában is (ha van írási jog).
- A fejezetek sorrendjének átrendezése (húzd-és-ejtsd a bal oldali listában) és a navigációs menü összeállítása is a `config.json`-ba íródik ki, nem csak a generált HTML-be — így egy másik gépen / böngészőben megnyitva a projektet, a sorrend és a menü is megmarad.

---

## Fejezetek szerkesztése

A bal oldali sávban látod a fejezeteket, középen a markdown szerkesztő, jobb oldalt az élő előnézet.

- **🔄 Frissítés** gomb az előnézet fejlécében: csak az előnézetet tölti újra, az egész oldal nem frissül.
- **Fejezet / Teljes dokumentum** váltó: az előnézet mutathatja csak az aktuális fejezetet, vagy az egész kézikönyvet egyben (ez utóbbi a navigációval és kereséssel együtt — ez felel meg a végleges, buildelt oldalnak).
- Képek beillesztése: **beillesztéssel (Ctrl+V)** vagy **húzd-és-ejtsd**-del a szerkesztőbe. A képek automatikusan tömörödnek (WebP, max. 1440px szélesség), hogy a fejezet fájlja és a mentés ne híz­zon el feleslegesen sok kép esetén sem.

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

- **⚡ Build**: legenerálja a végleges, önálló HTML fájlt (a projekt `config.json`-jában megadott `output` néven, alapból `<projektnév>.html`).
- **⚡ Build + Optimalizál**: ugyanez, de a beágyazott képeket PNG-ről WebP-re konvertálja és max. 1440px szélességre kicsinyíti buildeléskor — ez tud számottevően kisebb fájlt eredményezni, ha sok, tömörítetlen képet tartalmaz a projekt.
- Ha van írási jog a mappához, a build automatikusan a mappába íródik; egyébként letöltésre kerül.

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
- Felhő módban minden bejelentkezett felhasználó minden felhő projekthez hozzáfér (nincs projektenkénti jogosultság-szűkítés) — jelenleg csoport/szerepkör szerinti hozzáférés-korlátozás nincs megvalósítva.
- Felhő módban nincs ütközéskezelés: ha két ember egyszerre szerkeszti ugyanazt a fejezetet, a később mentett verzió felülírja a korábbit.
- Fejezet törlése felhő módban is csak a szerkesztő nézetéből törli a fejezetet — a fájl a Supabase Storage-ban megmarad (ugyanaz a viselkedés, mint helyi mappa módban).
