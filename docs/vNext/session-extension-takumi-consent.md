# Session-Verlängerung mit Takumi-Zustimmung

**Slug / Prompt-Name:** `session-extension-takumi-consent`  
**Status:** Idee (bewusst noch nicht umgesetzt)  
**Letzte Anmerkung:** 2026-03-31 — Nutzer möchte nicht neu buchen; Takumi muss frei sein und zustimmen.

## Problem / Nutzen

- **Geplante Calls:** Hartes Ende über Slot (`endTime`); Auto-Ende + Toast existieren im Client.
- **Instant:** Ende über Wallet-Restzeit / Freeze.
- **Wunsch:** **Verlängerung** ohne neue Buchung: beide Parteien einig, Takumi **verfügbar** (kein Parallel-Call, ggf. Live-Status / Kalender).

## Scope

- **In:** Produktlogik + UI (Anfrage/Annahme/Ablehnung), API, ggf. DB-Felder oder Audit-Log; Unterscheidung **scheduled** vs **instant**.
- **Out:** Detaillierte Preisgestaltung kann später kommen; hier nur Rahmen festhalten.

## Offene Entscheidungen

- **Preis:** Weiter Minutenpreis? Pauschal? Nachzahlung vor Verlängerung?
- **Scheduled:** Kalenderkonflikte, `endTime` in DB anpassen, Stripe-Hold?
- **Instant:** Nur „weiterreden“ mit Wallet vs. explizites Zeitkontingent?
- **Timeout:** Wie lange wartet die Anfrage auf Takumi-Antwort?
- **Daily.co:** Ob Raum einfach offen bleiben darf vs. serverseitige Session-Flags.

## Technische Anker (Startpunkte)

- `components/video-call/DailyCallContainer.tsx` — In-Call-UI für Buttons/Modals.
- `app/api/bookings/[id]/route.ts` — PATCH-Aktionen (neue Actions `request-extension`, `accept-extension`, …).
- `prisma/schema.prisma` — ggf. Felder für angefragte Verlängerung / Ablauf.
- Kalender/Availability für Takumi bei geplanten Slots.

## Akzeptanzkriterien (wenn umgesetzt)

- [ ] Shugyo kann Verlängerung anfragen (Dauer vorgegeben oder wählbar).
- [ ] Takumi sieht Anfrage, kann annehmen/ablehnen; bei Ablehnung klares UI.
- [ ] Bei Annahme: Abrechnungs-/Slot-Regeln konsistent mit Server; kein „stilles“ Weiterlaufen ohne Erfassung.
