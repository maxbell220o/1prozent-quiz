# 1% Quiz

Realtime-Quiz fuer den Unterricht. Das Frontend laeuft statisch auf GitHub Pages, Supabase uebernimmt Datenbank und Realtime-Synchronisierung.

## Start

1. Supabase-Projekt erstellen.
2. `supabase/schema.sql` im SQL Editor ausfuehren.
3. In `src/supabaseClient.js` `SUPABASE_URL` und `SUPABASE_ANON_KEY` eintragen.
4. `index.html` direkt oeffnen oder mit Vite starten.

```bash
npm install
npm run dev
```

## Ansichten

- `#/admin`: Raum erstellen, Fragen importieren, Spiel steuern
- `#/player`: per Raumcode beitreten und antworten
- `#/display`: Beamer-/Tafelansicht
