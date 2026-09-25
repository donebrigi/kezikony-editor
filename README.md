# Kézikönyv Szerkesztő

Böngészőben futó (build lépés nélküli) szerkesztő kézikönyvek / belső dokumentációk összeállításához. Markdown fejezetekből épít fel egy stílusos, kereshető, navigálható HTML oldalt, amit közvetlenül fel lehet tölteni pl. GitHub Pages-re.

Nincs build lépés, nincs szerver — csak nyisd meg az `index.html`-t egy böngészőben (Chrome/Edge ajánlott a teljes funkcionalitáshoz). Az `index.html` mellett a `css/` és `js/` mappának is ott kell lennie (GitHub Pages-re is mindhármat töltsd fel).

## Tartalom

- [Projekt betöltése és mentése](#projekt-betöltése-és-mentése)
- [Fejezetek szerkesztése](#fejezetek-szerkesztése)
- [Markdown szintaxis](#markdown-szintaxis)
- [Megjelenés testreszabása](#megjelenés-testreszabása)
- [Navigáció (menü) szerkesztése](#navigáció-menü-szerkesztése)
- [Build / exportálás](#build--exportálás)
- [Projekt mappa szerkezete](#projekt-mappa-szerkezete)
- [Ismert korlátok](#ismert-korlátok)
- [Kód szerkezete](#kód-szerkezete)
- [Változásnapló](#változásnapló)

---

## Projekt betöltése és mentése

A **📂 Projekt mappa megnyitása** gombra kattintva válaszd ki a projekt mappáját.

- **Chrome / Edge (asztali gép):** a mappa-választó rögtön **írási jogot** is kér. Ettől kezdve minden mentés — gépelés közbeni automatikus mentés, fejezet létrehozás, sorrend átrendezés, menü- és megjelenés-mentés — közvetlenül **ebbe a mappába** kerül, külön le- vagy feltöltés nélkül.
- **Más böngésző / nem támogatott környezet:** a szerkesztő automatikusan visszaesik a régi, csak-olvasható betöltésre (ha a böngésző mégis tud írási jogot adni, a topbaron megjelenik a **🔓 Írási jog** gomb) — ott a **💾 Mentés** gombbal (vagy Ctrl+S-sel) fájlonként kell menteni, és a végén a **⚡ Build**-del előállított HTML-t manuálisan kell feltölteni.

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
| Kiemelt szöveg | `==szöveg==` | színe a Megjelenés fülön külön állítható |
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
| Ikon | `:ikon-nev:` | lásd lent |
| Szerkesztői jegyzet | `<!-- jegyzet -->` ... `<!-- /jegyzet -->` | lásd lent |

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

### Ikonok beszúrása (Lucide)

Az eszköztár **🧩 Ikon** gombja egy kereshető ikonválasztót nyit meg (a [lucide.dev](https://lucide.dev/icons/) ikonkészletéből, kb. 1600 ikon). Gépelj a keresőbe (pl. `house`, `mail`, `check`), majd kattints a kívánt ikonra — ez egy

```
:ikon-nev:
```

jelölést szúr be a szövegbe (pl. `:house:`), ami egy valódi, az oldalba ágyazott SVG-vé alakul mind az előnézetben, mind a végleges buildelt oldalon (nem egy külső képfájl — ezért lehet a megjelenését CSS-ből, azaz a Megjelenés fülről is szabályozni).

Az ikonok kinézete a Megjelenés fülön, az "Ikonok" mezőknél állítható: szín, vastagság (px), valamint szélesség és magasság (px) külön-külön. Alapból a szöveg színét és a Lucide gyári kb. 2px-es vonalvastagságát/20px-es méretét örökli, amíg felül nem írod.

**Fontos:** az ikonok (és az ikonlista is) egy külső CDN-ről (unpkg.com) töltődnek be futásidőben — ehhez internetkapcsolat kell, ugyanúgy, mint a Google Fonts betűtípusokhoz. Ha valaki teljesen internet nélkül nyitja meg a végleges oldalt, az ikonok helyén üres hely marad.

### Szerkesztői jegyzet

Az eszköztár **📝 Jegyzet** gombja egy rejtett, csak a szerkesztőnek szóló jegyzetet szúr be:

```
<!-- jegyzet -->
Ide írhatsz szerkesztői jegyzetet.
<!-- /jegyzet -->
```

Rövidebb megjegyzéshez egysoros forma is használható: `<!-- jegyzet: rövid szöveg -->`.

A jegyzet az **élő előnézetben** egy szaggatott keretű, elkülönülő buborékban jelenik meg ("📝 Jegyzet" felirattal) — de a **⚡ Build**-bel legenerált, végleges/exportált oldalra soha nem kerül bele. Ez pl. saját emlékeztetőkhöz, TODO-khoz, vagy a szerkesztőtársaknak szánt megjegyzésekhez hasznos.

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
  - Kiemelt szöveg színe (a `==szöveg==` jelöléssel formázott résznek)
  - Sarok lekerekítés
  - Betűtípus stílus (5 előre elkészített páros: Modern, Barátságos, Klasszikus, Letisztult, Gépelt)
  - Betűméretek külön-külön: Bekezdés, Címsor 1–5
  - Címsor színek külön-külön: Címsor 1–5 mindegyike saját színt kaphat (alapból a Kiemelő színt / a Címsor 4–5 a szöveg színét örökli, amíg felül nem írod)
- **&lt;/&gt; Kód (haladó)**: a nyers CSS közvetlen szerkesztése azoknak, akik szeretnék teljesen kézben tartani a stílust. Az Egyszerű nézet módosításai nem írják felül a kézzel írt egyedi CSS-t — egy külön, jól elkülöníthető blokként kerülnek a végére.

A módosítások élőben látszanak az előnézeten, de csak a **✓ Mentés** gombbal kerülnek ténylegesen elmentésre — mindkét nézetben ugyanoda: a böngészőbe, felhő Dokumentumnál a felhőbe (`style.css`), helyi projektnél — ha van írási jog — a mappa `style.css` fájljába. Amíg van nem mentett módosítás, a gombok mellett "● Nem mentett módosítás" felirat látszik, és a panel bezárásakor a szerkesztő rákérdez, mented-e.

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
├── style.css       # projekt CSS (hiányzik → alapértelmezett stílus; írható mappánál első megnyitáskor létrejön)
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

---

## Kód szerkezete

```
index.html              # csak a felület HTML váza
css/editor.css          # a szerkesztő saját stílusa
js/
  runtime-scripts.js    # a legenerált kézikönyvbe ágyazott kereső- és ikon-szkript
  state.js              # globális állapot, projekt-modell segédfüggvények
  ui.js                 # toast, státusz, letöltés/fájlírás segédek, topbar menük
  default-css.js        # alapértelmezett kézikönyv-CSS + kereső CSS
  markdown.js           # frontmatter + markdown → HTML
  cloud.js              # Supabase kliens és Storage műveletek
  idb.js                # IndexedDB (böngészőn belüli másolat)
  persistence.js        # MINDEN mentés innen indul: böngésző + felhő + mappa
  design.js             # Megjelenés fül (egyszerű + kód nézet, piszkozat/mentés)
  preview.js            # élő előnézet, HTML összeállítás, navigáció
  build.js              # ⬇ Letöltés (build), kép-optimalizálás
  editor.js             # szövegszerkesztő, sorszámok, kép beillesztés
  toolbar.js            # formázó eszköztár, ikonválasztó
  chapters.js           # fejezetlista, új/átnevezés/törlés, húzás
  nav-groups.js         # navigációs csoportok szerkesztője
  project-modal.js      # ⚙ Beállítások ablak (projektek, másolás, logó, CSS fül)
  loaders.js            # projekt betöltése felhőből / mappából
  views.js              # Kezdőlap, Projekt nézet, projekt/dokumentum kezelő ablakok
  auth.js               # bejelentkezés, megosztott link
  ai.js                 # AI fejezet generálás
  app.js                # indítás, panel-átméretezés
```

A fájlok sima (nem ES-modul) szkriptek, hogy `file://` protokollon, szerver nélkül is működjenek. A betöltési sorrend az `index.html` alján van; az `app.js` indítja az alkalmazást.

**Szabály új funkcióhoz:** ha valami a projekt adatát módosítja (CSS, config, logó, fejezet), a mentést a `persistence.js` `save*` függvényeivel végezd (`saveProjectCss`, `saveProjectConfig`, `saveProjectLogo`, `saveChapterSilently`) — ezek döntik el, hogy a böngésző mellett a felhőbe vagy a mappába is ki kell-e írni.

---

## Változásnapló

### Refaktor + hibajavítások

**A CSS visszaállt alapértelmezettre — okai és javításuk:**

1. A Megjelenés fül **Egyszerű** nézetének *✓ Mentés* gombja csak a böngésző IndexedDB-jébe mentett, a felhőbe és a mappába nem. A felhőben így a dokumentum létrehozásakor feltöltött alapértelmezett `style.css` maradt, és újranyitáskor az töltődött be. → Most mindkét nézet ugyanazt a mentést hívja (böngésző + felhő / mappa).
2. Helyi mappás projektnél a `style.css` **soha nem íródott ki** a mappába. → Most kiíródik (és a logó is `logo.txt`-be).
3. A Supabase a fájlokat 1 órás böngésző-gyorsítótárazással szolgálta ki, így egy mentés után is a régi `style.css` jöhetett vissza. → A letöltések gyorsítótár nélkül mennek, a feltöltések `max-age=0`-val.
4. Az élő előnézet közben a módosított CSS azonnal a projektbe került, és a gépelés közbeni automentés kiírta a böngészőbe — így a böngészőben „megvolt", máshol nem. → A Megjelenés fül piszkozattal dolgozik; mentésig csak az előnézet látja.
5. A kiemelt doboz színe újranyitás után feketére (#000000) állt, mert a színválasztóba a teljes `linear-gradient(...)` szöveg került. → Az alapszín külön (`--callout-tint`) is mentődik, a régi blokkokból pedig a gradient első színét olvassuk ki.
6. Induláskor a legutóbb nyitott felhő Dokumentum a (esetleg elavult) böngészős másolatból töltődött vissza. → Most frissen a felhőből töltődik.

**Egyéb javítások:**

- Build közben a szerkesztő „átugrott" egy másik fejezetre, és a gépelés rossz fejezetbe mehetett.
- Felhő Dokumentumban törölt fejezet a következő megnyitáskor visszajött.
- Új helyi projekt létrehozásakor a *régi* aktív projekt mentődött, az új nem.
- Fejezet / projekt átnevezése helyi mappánál nem íródott ki a fájlba / `config.json`-ba.
- Dokumentum áthelyezésekor sikertelen feltöltés esetén is törlődött a forrás.
- Törölt / áthelyezett dokumentum a projekt-választóban maradt, ha nem az volt megnyitva.
- A `config.json` mentése eldobta a kézzel felvett, ismeretlen kulcsokat.
- A Tab billentyűvel beszúrt szóköz nem számított módosításnak.
- Az új fejezet ablakban egy kézi id-szerkesztés után az automatikus id-kitöltés örökre kikapcsolt.
- Induláskor az ábécében utolsó (nem a legutóbb használt) projekt töltődött vissza.
- A projekt-választó váltáskor a morzsamenü nem frissült.
- A kereső CSS-e kétszer került a legenerált HTML-be.
- Felhő dokumentumnál a kimeneti HTML neve perjelet tartalmazhatott (`projekt/dok.html`).

