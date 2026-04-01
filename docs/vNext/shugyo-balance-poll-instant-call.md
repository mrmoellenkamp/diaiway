# Shugyo: Wallet-Guthaben während Instant-Call synchronisieren

**Slug / Prompt-Name:** `shugyo-balance-poll-instant-call`  
**Status:** Idee (bewusst noch nicht umgesetzt)  
**Letzte Anmerkung:** 2026-03-31 — Shugyo soll während des Calls aufladen können; Takumi-Seite pollt Booking bereits.

## Problem / Nutzen

- Instant-Timer = **Guthaben ÷ Minutenpreis** minus verstrichene Zeit (`DailyCallContainer`, `balanceCentsRef`).
- **Freeze-Flow:** Shugyo kann nach 0-Restzeit per Top-up wieder einsteigen; Balance kommt u. a. von `/api/user/balance`.
- **Lücke:** Wenn Shugyo **während** des laufenden Calls **ohne** Freeze woanders auflädt (anderer Tab/Gerät), sieht der Call-Tab das neue Guthaben ggf. **verzögert** oder gar nicht.
- **Ziel:** Regelmäßiges Aktualisieren des Shugyo-Guthabens im Call (analog zum bestehenden Takumi-Poll auf `GET /api/bookings/[id]` mit `userBalanceCents`).

## Scope

- **In:** Instant-Call, Rolle Shugyo, Phase `IN_CALL`; optional nur wenn `useInstantWalletTimer`.
- **Out:** Neue Zahlungsflows; Änderung der Abrechnungslogik auf dem Server.

## Offene Entscheidungen

- Intervall (z. B. 3 s wie Takumi vs. seltener zum Traffic).
- Ob **nur** Booking-GET oder auch `/api/user/balance` (Booking liefert bereits Shugyo-Balance für Experten-Ansicht).
- Ob bei **geplanten** Calls mit Wallet-Bezug nötig (derzeit primär Instant).

## Technische Anker

- `components/video-call/DailyCallContainer.tsx` — Takumi-Poll aktualisiert `userBalanceCents`; Shugyo-Zweig ergänzen.
- `app/api/bookings/[id]/route.ts` — GET liefert `userBalanceCents` für Instant (Bucher + Experte).

## Akzeptanzkriterien (wenn umgesetzt)

- [ ] Nach externem Top-up steigt die **angezeigte Restzeit** im Shugyo-Call ohne vollständigen Reload.
- [ ] Kein Doppel-Interval ohne Cleanup; keine spürbare CPU-Last.
