# vNext — Backlog & Prompt-Specs

**Zweck:** Kurze, stabile Spezifikationen für Features, die **noch nicht** produktiv sind (oder nur teilweise). Verweis in Cursor per Pfad oder Slug, ohne Kontext neu zu tippen.

---

## So nutzt du das

1. **Prompt in Cursor:** Datei anhängen oder Pfad nennen, z. B.  
   `Implementiere laut @docs/vNext/shugyo-balance-poll-instant-call.md`
2. **Kurzprompt (nur Slug):** z. B.  
   *„Setze um: vNext → shugyo-balance-poll-instant-call“*
3. **Neues Thema:** Neue Markdown-Datei nach Vorlage unten; Eintrag in die Tabelle **Index** aufnehmen.

---

## Konvention Dateinamen

| Muster | Bedeutung |
|--------|-----------|
| Kleinbuchstaben, Bindestriche | `thema-unterthema.md` |
| Keine Leerzeichen | gut für Links und Git |
| Ein Thema = eine Datei | bei großen Themen Unterdateien oder Abschnitte |

---

## Index (alle Einträge)

| Prompt-Name (Slug) | Datei | Kurzbeschreibung | Status |
|--------------------|--------|------------------|--------|
| `shugyo-balance-poll-instant-call` | [shugyo-balance-poll-instant-call.md](./shugyo-balance-poll-instant-call.md) | Shugyo: Guthaben während Instant-Call per Poll aktualisieren (z. B. Top-up auf anderem Gerät) | Idee |
| `session-extension-takumi-consent` | [session-extension-takumi-consent.md](./session-extension-takumi-consent.md) | Verlängerung geplanter/Instant-Calls mit Takumi-Verfügbarkeit + Zustimmung | Idee |

---

## Vorlage für neue Dateien

Kopieren und `TITLE` / Slug anpassen:

```markdown
# TITLE

**Slug / Prompt-Name:** `dein-slug-hier`  
**Status:** Idee | in Klärung | geplant | verworfen  
**Letzte Anmerkung:** YYYY-MM-DD — kurz wer/was

## Problem / Nutzen
- …

## Scope
- In: …
- Out: …

## Offene Entscheidungen
- …

## Technische Anker (falls bekannt)
- Dateien / APIs: …

## Akzeptanzkriterien (wenn umsetzbar)
- [ ] …
```

---

## Pflege

- Nach **Umsetzung:** Status in der Datei auf „erledigt“, Verweis auf PR/Commit; Inhalt ggf. in `docs/` Hauptdoku übernehmen oder verlinken.
- **`docs/vNext/`** bewusst **klein** halten; lange Diskussionen in Issues/Notion, hier nur komprimierte Spec.
