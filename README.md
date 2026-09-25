# Kézikönyv Szerkesztő

Böngészőben futó szerkesztő kézikönyvek / belső dokumentációk összeállításához. Markdown fejezetekből épít fel egy stílusos, kereshető, navigálható HTML oldalt. Minden adat a felhőben (Supabase) van, így minden bejelentkezett kolléga ugyanazt látja és szerkeszti.

Nincs build lépés és nincs saját szerver: az `index.html` mellé a `css/`, `js/` és `vendor/` mappát kell feltölteni (pl. GitHub Pages-re), és böngészőben megnyitni.

## Tartalom

- [Mentés](#mentés)
- [Fejezetek szerkesztése](#fejezetek-szerkesztése)
- [Képek](#képek)
- [Képszerkesztő](#képszerkesztő)
- [Linkek](#linkek)
- [Előnézet](#előnézet)
- [Ütközések (ha ketten szerkesztik)](#ütközések-ha-ketten-szerkesztik)
- [Markdown szintaxis](#markdown-szintaxis)
- [Fejezetek, csoportok, menü (bal oldali fa)](#fejezetek-csoportok-menü-bal-oldali-fa)
- [Dokumentum beállításai](#dokumentum-beállításai)
- [Megjelenés testreszabása](#megjelenés-testreszabása)
- [Letöltés](#letöltés)
- [Importálás](#importálás)
- [Felhőbeli szerkezet](#felhőbeli-szerkezet)
- [Ismert korlátok](#ismert-korlátok)
- [Kód szerkezete](#kód-szerkezete)
- [Változásnapló](#változásnapló)

---

## Mentés

Minden automatikusan a felhőbe mentődik:

- **Fejezetek:** gépelés után kb. 1,5 másodperccel. A még nem mentett fejezet mellett a bal oldali listában ● jel látszik. Ha a mentés nem sikerül (pl. megszakadt a net), a szerkesztő újrapróbálja.
- **Szerkezet** (sorrend, csoportok, menü): húzás után azonnal.
- **Képek:** beillesztéskor azonnal.
- **Megjelenés:** a Megjelenés panel **✓ Mentés** gombjával (addig csak az előnézetben látszik).

A **💾 Mentés** gomb (Ctrl+S) mindent azonnal elment. Ha még van mentetlen módosítás, a böngésző bezárás előtt figyelmeztet.

Induláskor az utoljára megnyitott dokumentum nyílik meg újra, mindig a felhőben lévő legfrissebb változattal.

## Ütközések (ha ketten szerkesztik)

Mentés előtt a szerkesztő megnézi, módosította-e valaki más a fejezetet, mióta megnyitottad. Ha igen, nem írja felül vakon, hanem megmutatja a két változatot egymás mellett:

- **Az övé legyen** — a te módosításaid elvesznek.
- **Mindkettő megmarad** — az övé marad a fejezetben, a tiéd egy új „(saját változat)” fejezetbe kerül közvetlenül alá; utána kézzel összefésülhetők.
- **Az enyém legyen** — az ő módosításai elvesznek.

Ha az ablak valamiért nem látszik, de a felső sávban „⚠ Ütközés” áll, kattints a feliratra vagy a **💾 Mentés** gombra, és újra megjelenik.

A szerkezetnél (sorrend, csoportok, cím) egy egyszerű kérdés jön fel. Ha egy fejezetre váltasz, és nálad nincs mentetlen módosítás, a szerkesztő csendben betölti a felhőben lévő legfrissebb változatát.

## Fejezetek szerkesztése

Bal oldalt a fejezetek fája, középen a szerkesztő, jobbra az élő előnézet.

- **Cím mező** a szerkesztő fölött: a fejezet címe, egyben a menüpont neve. Ha a fejezet első sora `# <cím>`, azt is együtt frissíti.
- **#azonosító** a cím mellett: a fejezet horgonya (`#azonosito` linkekhez). Automatikusan készül, kattintással módosítható.
- **„/” menü:** a sor elején (vagy szóköz után) írj egy `/` jelet — megjelenik a beszúrható elemek listája (címsor, lista, kiemelt doboz, harmonika, kép, képsor, ikon, táblázat, link, jegyzet, kódblokk). Gépeléssel szűrhető (pl. `/harm`), Enterrel beszúrható.
- **Ikon-javaslat:** kettősponttal kezdve (pl. `:hou`) felajánlja a Lucide ikonokat.
- **Billentyűk:** Ctrl+B félkövér, Ctrl+I dőlt, Ctrl+K link, Ctrl+S mentés, Ctrl+Z / Ctrl+Y visszavonás (fejezetenként külön), Ctrl+F keresés.
- **🔄 Frissítés** az előnézet fejlécében: csak az előnézetet tölti újra. **Fejezet / Teljes dok** váltó: az aktuális fejezet, vagy az egész kézikönyv a menüvel és a keresővel együtt.

## Képek

- Beillesztés **Ctrl+V**-vel, **húzással** a szerkesztőbe, a **🖼 Kép** gombbal vagy a `/kép` paranccsal. Egyszerre több kép is mehet.
- A képek külön fájlként kerülnek a felhőbe (a dokumentum `images/` mappájába), automatikusan tömörítve (WebP, max. 1440 px széles). A szövegben csak egy rövid hivatkozás áll: `![alt](images/3f9a….webp)`; a szerkesztőben ennek helyén egy kis bélyegkép látszik.
- A kép alatti `*dőlt sor*` a képaláírás.
- A **régi dokumentumokban** beágyazott (base64) képeket a szerkesztő az első megnyitáskor magától átalakítja külön fájllá. Ez egyszeri, és ha bármelyik kép feltöltése nem sikerül, az a kép változatlanul a szövegben marad.
- A letöltött HTML-be és az egyedi `.md` letöltésbe a képek beágyazva kerülnek, így azok önállóan is teljesek.
- A **⚙ Beállítások → Dokumentum → 🧹 Nem használt képek törlése** gomb eltávolítja a felhőből azokat a képfájlokat, amelyekre már egyik fejezet sem hivatkozik (a 10 percnél frissebbeket biztonságból kihagyja).

## Képszerkesztő

A szerkesztőben a kép-címkére (**✏ kép**) kattintva, vagy az előnézetben a képre duplán kattintva nyílik meg:

- **✂ Vágás**, **➚ Nyíl**, **▭ Keret**, **① Számozott jelölő** (1, 2, 3… a lépésekhez), **▦ Kitakarás** (pixelezés — nevek, e-mail címek, személyes adatok elrejtésére).
- 6 szín, 3 vonalvastagság, **↶** visszavonás (Ctrl+Z), **⟲ Eredeti** (minden jelölés törlése).
- **🔄 Kép cseréje…** (vagy Ctrl+V az ablakban): új képernyőkép ugyanoda — a képaláírás megmarad, és rögtön jelölhető.
- A jelölések **utólag is szerkeszthetők**: a szerkesztett kép mellé egy leíró fájl mentődik (`images/<név>.edit.json`), így újranyitáskor az eredeti képből és a meglévő nyilakból/keretekből indul.

## Linkek

- A **🔗 Link** gomb (Ctrl+K) után, vagy kézzel `](` beírásakor a szerkesztő felajánlja a dokumentum fejezeteit és címsorait — nem kell fejből tudni az azonosítókat. Webcím is beírható.
- A **nem létező belső hivatkozások** (pl. egy átnevezett fejezetre mutató `#régi-azonosító`) pirosan aláhúzva látszanak, a fában pedig ⚠ jelzi, melyik fejezetben van ilyen.

## Előnézet

- **🔗 Szinkron** (alapból bekapcsolva): az előnézet követi a szerkesztő görgetését.
- Az előnézetben egy bekezdésre **kattintva** a szerkesztő oda ugrik (teljes dokumentum nézetben a másik fejezetet is megnyitja); egy képre **duplán kattintva** a képszerkesztő nyílik meg.

## Markdown szintaxis

A szerkesztő egy leegyszerűsített markdown-változatot ért. Az eszköztár gombjai a leggyakoribb elemeket be tudják szúrni, de kézzel is írhatod őket.

| Elem | Szintaxis | Megjegyzés |
|---|---|---|
| Félkövér | `**szöveg**` | |
| Dőlt | `*szöveg*` | |
| Kiemelt szöveg | `==szöveg==` | színe a Megjelenés panelen külön állítható |
| Kód (inline) | `` `kód` `` | |
| Címsor 1 | `# Cím` | HTML-ben `<h2>`, automatikusan kap egy hivatkozható azonosítót |
| Címsor 2 | `## Cím` | HTML-ben `<h3>` |
| Címsor 3 | `### Cím` | HTML-ben `<h4>` |
| Címsor 4 | `#### Cím` | HTML-ben `<h5>` (a legfrissebb szint) |
| Felsorolás | `- elem` | |
| Számozott lista | `1. elem` | |
| Kiemelt doboz | `> szöveg` | színe a Megjelenés panelen állítható |
| Link | `[szöveg](url)` | |
| Kép | `![alt szöveg](images/…)` | beillesztéssel jön létre, lásd [Képek](#képek) |
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

Ez ugyanabban a fejezetben mindig működik; másik fejezetben lévő címsorra csak a "Teljes dokumentum" nézetben / a végleges buildelt oldalon mutat (ott van csak egyben az összes fejezet). Egy másik fejezet **tetejére** a fejezet saját azonosítójával (a cím melletti `#azonosito`) tudsz ugrani.

### Lenyíló elemek (harmonika / accordion)

Az eszköztár **⬇ Harmonika** gombja (vagy a `/harmonika` parancs) beszúr egy induló sablont:

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

jelölést szúr be a szövegbe (pl. `:house:`), ami egy valódi, az oldalba ágyazott SVG-vé alakul mind az előnézetben, mind a végleges buildelt oldalon (nem egy külső képfájl — ezért lehet a megjelenését CSS-ből, azaz a Megjelenés panelről is szabályozni).

Az ikonok kinézete a Megjelenés panelen, az "Ikonok" mezőknél állítható: szín, vastagság (px), valamint szélesség és magasság (px) külön-külön. Alapból a szöveg színét és a Lucide gyári kb. 2px-es vonalvastagságát/20px-es méretét örökli, amíg felül nem írod.

**Fontos:** az ikonok (és az ikonlista is) egy külső CDN-ről (unpkg.com) töltődnek be futásidőben — ehhez internetkapcsolat kell, ugyanúgy, mint a Google Fonts betűtípusokhoz. Ha valaki teljesen internet nélkül nyitja meg a végleges oldalt, az ikonok helyén üres hely marad.

### Szerkesztői jegyzet

Az eszköztár **📝 Jegyzet** gombja egy rejtett, csak a szerkesztőnek szóló jegyzetet szúr be:

```
<!-- jegyzet -->
Ide írhatsz szerkesztői jegyzetet.
<!-- /jegyzet -->
```

Rövidebb megjegyzéshez egysoros forma is használható: `<!-- jegyzet: rövid szöveg -->`.

A jegyzet az **élő előnézetben** egy szaggatott keretű, elkülönülő buborékban jelenik meg ("📝 Jegyzet" felirattal) — de a letöltött, végleges oldalra soha nem kerül bele. Ez pl. saját emlékeztetőkhöz, TODO-khoz, vagy a szerkesztőtársaknak szánt megjegyzésekhez hasznos.

---

## Dokumentum beállításai

A **⚙ Beállítások** ablak fülei:

- **📄 Dokumentum:** cím, alcím, rövid leírás, logó, nem használt képek törlése.
- **📋 Fejezetek másolása:** fejezetek átmásolása egy másik dokumentumból (a képeikkel együtt).

## Megjelenés testreszabása

A topbar **🎨 Megjelenés** gombja egy oldalpanelt nyit: a panel a fa és a szerkesztő helyére kerül, az előnézet pedig közben a **teljes kézikönyvet** mutatja mellette (menüvel, borítóval), így minden módosítás hatása rögtön az egész oldalon látszik. A **✕ Bezárás** (vagy újra a 🎨 gomb) visszaállítja a szerkesztőt és a korábbi előnézeti módot; ha van nem mentett módosítás, előtte rákérdez.

A panelen két nézet van:

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

A módosítások élőben látszanak az előnézeten, de csak a **✓ Mentés** gombbal kerülnek a felhőbe (`style.css`). Amíg van nem mentett módosítás, a gombok mellett "● Nem mentett módosítás" felirat látszik, és a panel bezárásakor a szerkesztő rákérdez, mented-e.

---

## Fejezetek, csoportok, menü (bal oldali fa)

A bal oldali fa egyszerre a fejezetek listája, a sorrendjük és a kész oldal menüje — ami itt látszik, az lesz a menüben is, ugyanebben a sorrendben.

- **Húzd** a fejezeteket a sorrend változtatásához, vagy egy csoport fejlécére / csoporton belülre a csoportba tételhez.
- **+ Csoport:** új lenyíló menüpont. A csoport fejlécén: **＋** alcsoport, **✏** átnevezés (vagy dupla kattintás), **🗑** törlés (a fejezetei nem törlődnek, a lista tetejére kerülnek). A csoportok és alcsoportok is húzhatók, a **▾** nyíllal összecsukhatók.
- A csoport nélküli fejezetek a menü tetején, sima linkként jelennek meg (pl. Bevezetés).
- **+ Fejezet:** új fejezet az aktív fejezet után, ugyanabba a csoportba.
- Az aktív fejezet alatt a **címsorai** látszanak — kattintásra oda ugrik a szerkesztő és az előnézet.
- Fejezeten: **⬇** letöltés `.md` fájlként, **🗑** törlés.

## Letöltés

A **⬇ Letöltés** menüben:

- **🖨 Nyomtatás / PDF:** nyomtatási nézet egy új lapon — tartalomjegyzékkel, minden fejezet új oldalon, kinyitott lenyíló elemekkel, menü és kereső nélkül. PDF-hez a nyomtatóválasztóban a „Mentés PDF-ként” lehetőséget válaszd. (A letöltött HTML-ből nyomtatva is ugyanígy néz ki.)
- **⬇ HTML letöltése:** a végleges, önálló HTML fájl (képekkel együtt). Egyúttal a felhőben is frissül a publikált változat — erre épül a megosztható link és a Projekt nézet **⬇ HTML** gombja. A *Képek optimalizálása* opció kisebb fájlt ad.
- **📦 Markdown + képek (ZIP):** a dokumentum összes forrásfájlja (fejezetek, képek, `config.json`, `style.css`) — archiváláshoz, vagy máshová importáláshoz.

Egy-egy fejezet `.md` fájlja a bal oldali fában a fejezet **⬇** gombjával tölthető le (a képek beágyazva).

## Importálás

A Projekt nézet **📤 Importálás** gombjával új dokumentum hozható létre:

- **egy mappából** a gépről: régi projektmappa (`config.json`, `style.css`, `sections/*.md`) vagy a ZIP letöltés kicsomagolt mappája (`images/` mappával);
- **korábbi, böngészőben tárolt helyi projektből** (ha a régi szerkesztőben dolgoztál helyi mappával ebben a böngészőben).

A fejezetekbe ágyazott képek importáláskor automatikusan külön fájlba kerülnek.

## Felhőbeli szerkezet

```
kezikonyv (Supabase Storage bucket)
└── <projekt-azonosító>/
    ├── _project.json          # projekt neve, leírása, színe, ikonja
    └── <dokumentum-azonosító>/
        ├── config.json        # cím, leírás, menü (nav_groups), fejezetsorrend (fileOrder)
        ├── style.css          # megjelenés
        ├── logo.txt           # logó (base64 kép), opcionális
        ├── published.html     # a legutóbb letöltött (publikált) HTML
        ├── images/            # képek (tartalom-hash névvel)
        └── sections/
            ├── 01_bevezetes.md
            └── ...
```

Minden `.md` fájl elején egy frontmatter blokk adja meg a fejezet azonosítóját és címét (a szerkesztőben ez nem látszik, a cím mezőből jön):

```
---
id: telepites
title: Telepítés
---

# Telepítés
...
```

## Ismert korlátok

- Az ütközésjelzés mentéskor lép működésbe; azt nem mutatja élőben, ha valaki épp ugyanazt a fejezetet szerkeszti.
- Egy kolléga által közben létrehozott új fejezet a dokumentum újranyitásakor jelenik meg.
- Az ikonok és a betűtípusok külső CDN-ről töltődnek, ezekhez internet kell a kész oldalon is.
- A "Címsor 1" mező a Megjelenés panelen a borító (első fejezet) fejlécére vonatkozik — a markdown `#` szintje `Címsor 2`-nek megfelelő HTML-elemet hoz létre.

## Kód szerkezete

```
index.html              # a felület HTML váza
css/editor.css          # a szerkesztő stílusa
vendor/
  codemirror.bundle.js  # CodeMirror 6 + JSZip egy fájlban (lásd vendor/README.md)
js/
  runtime-scripts.js    # a kész kézikönyvbe ágyazott kereső- és ikon-szkript
  state.js              # globális állapot, dokumentum-modell segédek
  ui.js                 # toast, státusz, letöltés, topbar menük
  default-css.js        # alapértelmezett kézikönyv-CSS
  markdown.js           # frontmatter, markdown → HTML, címsorok
  cloud.js              # Supabase kliens és Storage műveletek
  structure.js          # fa = menü = sorrend (csoportok, áthelyezés)
  images.js             # képek feltöltése, gyorsítótár, beágyazás, régi képek átalakítása
  imageeditor.js        # képszerkesztő (vágás, nyíl, keret, számozás, kitakarás), csere, takarítás
  persistence.js        # mentések (automatikus és kézi)
  conflicts.js          # ütközésjelzés, ha ketten szerkesztik ugyanazt
  legacy-import.js      # régi, böngészőben tárolt helyi projektek olvasása (importhoz)
  design.js             # Megjelenés beállítások (egyszerű + kód nézet, piszkozat/mentés)
  designpanel.js        # a Megjelenés oldalpanel megnyitása/bezárása
  preview.js            # élő előnézet, HTML összeállítás, menü
  previewsync.js        # görgetés-szinkron, kattintás az előnézetben
  build.js              # HTML letöltés, nyomtatás/PDF, ZIP letöltés
  links.js              # link-javaslatok, hibás hivatkozások jelzése
  editor.js             # CodeMirror szerkesztő, "/" menü, kép-beillesztés
  toolbar.js            # formázó műveletek, ikonválasztó
  tree.js               # bal oldali fa, húzás, fejezet létrehozás/törlés/letöltés
  project-modal.js      # ⚙ Beállítások ablak
  loaders.js            # dokumentum betöltése, importálás
  views.js              # Kezdőlap, Projekt nézet, projekt/dokumentum kezelés
  auth.js               # bejelentkezés, megosztott link
  app.js                # indítás
```

A fájlok sima (nem ES-modul) szkriptek; a betöltési sorrend az `index.html` alján van.

## Változásnapló

### 3.2.1 — Ütközés-javítás

- **Hamis ütközés:** a Supabase egy fájl felülírása után még kb. egy percig a régi változatot is visszaadhatta (CDN-gyorsítótár), ezért a szerkesztő a saját, pár másodperccel korábbi szövegedet „kolléga változatának” nézte — akkor is, ha senki más nem szerkesztett. Javítva: a letöltések mindig a friss változatot kérik, és a saját korábbi változataidat a szerkesztő nem tekinti ütközésnek.

- Ha „Az enyém legyen” választása közben a kolléga újra mentett, a szerkesztő beragadt a „⚠ Ütközés — döntésre vár” állapotba, döntési ablak nélkül. Javítva: „Az enyém” most mindenképp felülír, és a felirat vagy a 💾 Mentés gomb újra előhozza az ablakot, ha függőben van egy döntés.

### 3.2 — Megjelenés oldalpanelben

- A Megjelenés a ⚙ Beállítások ablakból egy saját oldalpanelbe került (topbar: **🎨 Megjelenés**). A panel mellett a teljes kézikönyv előnézete látszik.

### 3.1 — AI funkciók eltávolítva

- A ✨ AI panel (fejezet képernyőképből) és a ✨ Szöveg menü kikerült, mert külön fizetős Claude API-t igényelnek. A `js/ai.js`, `js/aitext.js` és a `supabase/` mappa már nem része a szerkesztőnek.

### 3. verzió — együttműködés, képszerkesztő

- **Ütközésjelzés**, ha ketten szerkesztik ugyanazt a fejezetet (az övé / mindkettő / az enyém), és frissítés fejezetváltáskor.
- **Képszerkesztő:** vágás, nyíl, keret, számozott jelölő, kitakarás; utólag is szerkeszthető jelölések.
- **Kép cseréje** egy kattintással, a képaláírás megtartásával.
- **Nem használt képek takarítása.**
- **Link-javaslatok** és **hibás hivatkozások jelzése** (szerkesztőben és a fában).
- **Görgetés-szinkron** és kattintás az előnézetben → ugrás a szerkesztőben.
- **Nyomtatás / PDF** tartalomjegyzékkel, fejezetenként új oldallal.

### 2. verzió — kényelmesebb szerkesztés, csak felhő

- **Új szerkesztő (CodeMirror):** színezett szöveg, sorszámok, „/” beszúró menü, ikon-javaslatok, fejezetenkénti visszavonás, keresés.
- **Rejtett frontmatter:** a cím a szerkesztő fölötti mezőben, az azonosító automatikus.
- **Képek külön fájlban** a felhőben — a szöveg rövid és gyors marad; a régi beágyazott képek automatikusan átalakulnak.
- **Egyesített bal oldali fa:** fejezetek + csoportok + menü + sorrend egy helyen, húzással; címsorok az aktív fejezet alatt.
- **Letöltés:** egyedi fejezet `.md` (képekkel), vagy minden forrás ZIP-ben.
- **Csak felhő:** a helyi mappás mód megszűnt. A régi helyi projektek az **📤 Importálás** ablakban hozhatók át.
- A ⚙ Beállítások ablak egyszerűsödött: Dokumentum / Megjelenés / Fejezetek másolása.


### 1. verzió — refaktor + hibajavítások

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

