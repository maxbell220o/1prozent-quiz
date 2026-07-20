Hier ist eine **klare, zusammenhängende Projektbeschreibung**, die euren aktuellen Stand korrekt wiedergibt und direkt auf eine Umsetzung mit **GitHub Pages** und **Supabase** ausgelegt ist:

---

# 🧠 Projektbeschreibung: Realtime 1%-Quiz Web-App

Wir entwickeln eine **webbasierte Quiz-Anwendung im Stil der Show The 1% Club**, die im Schulunterricht eingesetzt werden soll. Jeder Teilnehmer nutzt ein iPad, während eine zentrale Anzeige (z. B. Beamer/Tafel) das Spielgeschehen visualisiert.

---

## 🎯 Grundidee

Alle Spieler nehmen gleichzeitig an einem Quiz teil und beantworten identische Fragen in Echtzeit. Die Fragen sind nach Schwierigkeit gestaffelt (z. B. 90 % → 1 %). Ziel ist es, möglichst lange im Spiel zu bleiben.

---

## 🎮 Spielablauf

* Alle Spieler starten gleichzeitig
* Pro Runde wird eine Frage gestellt
* Es gibt einen Timer für die Antwortabgabe
* Antworttypen:

  * Multiple Choice (A/B/C/D)
  * Freitext

### ❗ Eliminierung

* falsche Antwort → Spieler scheidet aus
* keine Antwort → Spieler scheidet aus

Das Spiel läuft weiter, bis:

* nur noch ein Spieler übrig ist
* oder mehrere Spieler die letzte Frage überleben

---

## 💰 Jackpot-System (show-authentisch)

Das Spiel verwendet ein **festes Jackpot-System**, wie in der echten Show:

* Zu Beginn gibt es einen festen Jackpot (z. B. 100 Punkte)
* Alle Spieler konkurrieren um diesen Jackpot
* Wenn Spieler ausscheiden:

  * der Jackpot bleibt unverändert
* Am Ende:

  * 1 Spieler → erhält den gesamten Jackpot
  * mehrere Spieler → teilen den Jackpot

👉 Es gibt **kein wachsendes Jackpot-System** im Standardmodus.

---

## 👥 Rollen im System

### 👨‍🏫 Admin (Lehrer)

* startet und steuert das Spiel
* importiert Fragen über CSV-Dateien
* sieht alle Spieler und deren Status
* kann Spieler bei unfairem Verhalten entfernen
* Zugriff über einfache Passwortabfrage

---

### 👨‍🎓 Teilnehmer (Schüler)

* treten über einen Raumcode bei
* geben Antworten über ihr iPad ein
* sehen ihren Status (aktiv / ausgeschieden)

---

### 🖥️ Anzeige (Tafel/Beamer)

* zeigt Fragen, Timer und Antworten
* visualisiert verbleibende Spieler
* zeigt den Jackpot
* vermittelt Show-Feeling

---

## 📄 Fragenverwaltung

Fragen werden über eine **CSV-Datei importiert** und enthalten:

* Frage
* Antworttyp (MC oder Text)
* Antwortmöglichkeiten (optional)
* richtige Antwort
* Schwierigkeitslevel

---

## ⚡ Technische Umsetzung

Die Anwendung ist:

* **webbasiert** (läuft im Browser)
* **in Echtzeit synchronisiert**
* **als statische Web-App hostbar**

### Frontend / Hosting

* GitHub Pages hostet das Frontend
* Die App wird als statische Seite gebaut, z. B. mit Vite
* Es gibt keinen eigenen Node-/Express-Server auf GitHub Pages
* Alle dynamischen Daten laufen über Supabase

### Backend

* Supabase wird als Backend verwendet
* Supabase stellt bereit:

  * PostgreSQL-Datenbank für Räume, Spieler, Fragen, Antworten und Spielstatus
  * Realtime-Updates für Admin-, Teilnehmer- und Anzeige-Ansicht
  * Row Level Security (RLS), damit Teilnehmer nur erlaubte Daten sehen und schreiben
  * optional Edge Functions für spätere serverseitige Prüfungen

---

## 🌐 Architektur mit GitHub Pages + Supabase

Damit das Projekt mit GitHub Pages möglich ist, wird die Anwendung sauber getrennt:

* **GitHub Pages** liefert nur HTML, CSS und JavaScript aus
* **Supabase** übernimmt Datenbank, Realtime-Synchronisierung und Sicherheit
* Der Browser verbindet sich direkt mit Supabase über `@supabase/supabase-js`

Erlaubt im Frontend:

* `SUPABASE_URL`
* `SUPABASE_ANON_KEY`

Nicht erlaubt im Frontend:

* Supabase Service Role Key
* geheime Admin-Keys
* Datenbankpasswörter

Die Sicherheit muss deshalb über Supabase-RLS-Regeln und Datenbank-Constraints umgesetzt werden.

---

## 🗂️ Empfohlene Projektstruktur

```text
1prozent-quiz/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.js
│   ├── supabaseClient.js
│   ├── router.js
│   ├── views/
│   │   ├── admin.js
│   │   ├── player.js
│   │   └── display.js
│   ├── game/
│   │   ├── state.js
│   │   ├── csvImport.js
│   │   └── scoring.js
│   └── styles/
│       └── style.css
└── supabase/
    └── schema.sql
```

---

## 🧱 Supabase-Datenmodell

### Tabellen

```sql
rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  admin_pin text not null,
  jackpot integer not null default 100,
  current_question_index integer not null default 0,
  status text not null default 'lobby',
  created_at timestamptz default now()
)

players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  joined_at timestamptz default now()
)

questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  question_order integer not null,
  difficulty text not null,
  type text not null,
  question text not null,
  options jsonb,
  correct_answer text not null
)

answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  answer text not null,
  is_correct boolean,
  submitted_at timestamptz default now(),
  unique (player_id, question_id)
)
```

### Realtime

Realtime wird für diese Tabellen aktiviert:

* `rooms`
* `players`
* `questions`
* `answers`

Dadurch aktualisieren sich Admin-, Teilnehmer- und Anzeigeansicht automatisch, sobald sich der Spielstatus ändert.

---

## 🔐 Sicherheit im Schulkontext

Für eine erste stabile Version reicht:

* Raumcode für Teilnehmer
* Admin-PIN für Lehrer
* RLS-Regeln, die Schreibzugriffe begrenzen
* pro Spieler und Frage nur eine Antwort durch `unique (player_id, question_id)`
* Antworten nach Ablauf des Timers im Frontend sperren
* endgültige Auswertung über den Admin-Status in Supabase speichern

Für eine spätere sicherere Version kann Supabase Auth ergänzt werden.

---

## 🚀 Deployment über GitHub Pages

Empfohlenes Setup mit Vite:

```bash
npm create vite@latest . -- --template vanilla
npm install
npm install @supabase/supabase-js
npm run build
```

In `vite.config.js` muss bei GitHub Pages der Repository-Name als `base` gesetzt werden:

```js
export default {
  base: '/1prozent-quiz/'
}
```

Für Deployment per GitHub Actions:

```yaml
name: Deploy GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Im GitHub-Repository muss danach unter **Settings → Pages** GitHub Actions als Quelle ausgewählt werden.

---

## ✅ Minimaler MVP

Der erste funktionsfähige Stand sollte enthalten:

* Raum erstellen
* Spieler per Raumcode beitreten lassen
* CSV-Fragen importieren
* Spiel starten
* Frage und Timer anzeigen
* Antworten speichern
* falsche oder fehlende Antworten eliminieren
* Anzeigeansicht live aktualisieren
* Gewinner und Jackpot anzeigen

Damit ist das Projekt vollständig mit GitHub Pages und Supabase realisierbar.

---

## 🧠 Fazit

Ihr habt ein System definiert, das:

* sich stark an der echten Show orientiert
* aber für den Schulkontext optimiert ist
* mit moderner Webtechnologie umgesetzt wird
* ohne eigenen Server auf GitHub Pages laufen kann
* Supabase für alle Backend- und Realtime-Funktionen nutzt

Der nächste sinnvolle Schritt ist eine konkrete Projektstruktur mit Vite, Supabase-Client, Datenbankschema und den drei Ansichten `Admin`, `Teilnehmer` und `Anzeige`.
