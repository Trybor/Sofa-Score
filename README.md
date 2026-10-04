# Täglicher SOFA Score

Lokale Web-App zur täglichen SOFA-Erhebung (Sepsis / Organfunktion). Einstieg: `sepsiscalculator3.html`.

Keine Server-Anbindung — Daten bleiben im Browser (`localStorage`) bzw. in exportierten Dateien.

## Refactoring (Fork)

Die App war eine ~1200-Zeilen-Monolith-HTML-Datei. Technisch aufgeteilt, **ohne bewusste Feature- oder Fachlogik-Änderungen**:

```
sepsiscalculator3.html   # Markup + Script-Einbindung
css/app.css
js/
  lab.js                 # Excel-Import, Normalisierung
  scoring.js             # SOFA-Mapper, Score, Ampel
  storage.js             # localStorage, JSON/CSV Export/Import
  chart.js               # SVG-Verlaufskurve
  ui.js                  # DOM, Events, Init
vendor/xlsx.full.min.js  # SheetJS 0.18.5 (lokal, statt CDN)
```

Zusätzlich bereinigt: doppelte `renderHistory`, tote `renderChart`/`#chartContainer`, doppelte Event-Listener, doppeltes CSS.

Namespace: `window.SofaApp`. Scripts ohne Bundler — Ordner lokal öffnen oder per einfachem HTTP-Server.

## Bekannte Bugs / Unebenheiten

Bitte selbst entscheiden, was korrigiert werden soll. Stand vor dem Refactor, bewusst unverändert gelassen:

### UI / Beschriftung

1. **„Erster erhobener Score“** zeigt den **Vortags-Score**, nicht den ersten Wert der Akte.
2. **„Delta zum Erstwert“** ist faktisch **Delta zum vorherigen Tag** (auch CSV-Spalte so benannt, aber so berechnet).
3. Grüner Status-Text lautet immer **„0 · keine Zunahme“**, unabhängig vom Kontext.

### Labor-Import / Mapper

4. **Horowitz &lt; 200** mappt immer auf Stufe **2** — Stufen 3/4 (mit Beatmung) kommen aus Excel nicht automatisch.
5. **Kreislauf aus Excel:** kein Dobutamin, kein Adrenalin (nur Noradrenalin). Jede Noradrenalin-Dosis &gt; 0 → Stufe 3.
6. **Niere:** geringer Urin (&lt; 500 / &lt; 200 ml/d) überschreibt Kreatinin.
7. Spalten-Alias `'pao2f i o2'` (Leerzeichen) matcht praktisch nie — eher Tippfehler.
8. 8-stellige **Zahl** aus Excel wird als **DDMMYYYY** gelesen; `20261004` (YYYYMMDD) wird falsch.

### Sonstiges

9. `Date` → `toISOString()` kann je nach Zeitzone das Kalenderdatum verschieben.
10. Gespeichert wird nur der **Gesamtscore**, nicht die 6 Einzelkriterien — nach Reload keine Organ-Details mehr.

## Kurztest

1. Kriterien ändern → Live-Score  
2. Speichern → Tabelle + Kurve  
3. Zweiter Tag mit Delta ≥ 2 → Warn-Modal  
4. Reload behält Akte; „Neuer Patient“ leert UI  
5. JSON export/import  
6. CSV-Export / Excel-Laborimport mit echten Dateien  
