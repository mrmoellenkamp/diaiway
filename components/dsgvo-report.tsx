"use client";

import React, { useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Priority = "critical" | "medium" | "low" | "ok";
type Filter = "all" | Priority;

interface Finding {
  id: string;
  priority: Priority;
  title: string;
  detail: string;
  file?: string;
  article?: string;
  sprint?: number;
}

interface SprintTask {
  id: string;
  label: string;
  sprint: number;
  weeks: string;
  findingIds: string[];
}

// ─── Data ────────────────────────────────────────────────────────────────────

const FINDINGS: Finding[] = [
  {
    id: "F01",
    priority: "ok",
    title: "✅ Safety-Snapshot-API – Einwilligungsprüfung implementiert",
    detail:
      "UMGESETZT (02.04.2026): /api/safety/snapshot/route.ts prüft jetzt bookerSafetyAcceptedAt / snapshotConsentAt vor jeder Snapshot-Verarbeitung. Ohne verifizierte Einwilligung wird HTTP 403 zurückgegeben.",
    file: "app/api/safety/snapshot/route.ts",
    article: "Art. 6 DSGVO",
  },
  {
    id: "F02",
    priority: "ok",
    title: "✅ Nutzer-Datenexport (Art. 20 DSGVO) implementiert",
    detail:
      "UMGESETZT (02.04.2026): GET /api/user/export gibt alle personenbezogenen Daten als JSON zurück. Button 'Meine Daten herunterladen' in Profil → Einstellungen eingebaut. Auch in Datenschutzerklärung dokumentiert.",
    article: "Art. 20 DSGVO",
  },
  {
    id: "F03",
    priority: "ok",
    title: "✅ SafetyIncident/SafetyReport bei Kontolöschung anonymisiert",
    detail:
      "UMGESETZT (02.04.2026): anonymizeUser bereinigt jetzt SafetyReport (reporterId/reportedId → anon_..., details leeren) und SafetyIncident (abgeschlossene Incidents: imageUrl leeren, Blob-Löschung). Laufende Verfahren bleiben nach Art. 17 Abs. 3 lit. b DSGVO erhalten.",
    file: "lib/anonymize-user.ts",
    article: "Art. 17 DSGVO",
  },
  {
    id: "F04",
    priority: "ok",
    title: "✅ Transaktions-PDFs: Archivierung + Aufbewahrungsfristen implementiert",
    detail:
      "UMGESETZT (02.04.2026): PDF-Belege werden NICHT bei Kontolöschung gelöscht, da §§ 147 AO / 257 HGB 10-jährige Aufbewahrungspflicht greift (Art. 17 Abs. 3 lit. b DSGVO). Stattdessen automatische Archivierung in DocumentArchive-Tabelle via Cron 'archive-documents' (täglich 01:00 UTC). Cron 'purge-expired-documents' (monatlich) löscht abgelaufene Belege physisch aus Blob nach Fristablauf.",
    file: "prisma/schema.prisma (DocumentArchive), app/api/cron/archive-documents, app/api/cron/purge-expired-documents",
    article: "Art. 17 DSGVO, §§ 147 AO, 257 HGB",
  },
  {
    id: "F05",
    priority: "ok",
    title: "✅ Marketing-DOI-Flow implementiert",
    detail:
      "UMGESETZT (02.04.2026): POST /api/user/marketing setzt marketingDoubleOptInAt + marketingOptIn. DELETE /api/user/marketing widerruft die Einwilligung. Button 'Marketing abbestellen' in Profil → Einstellungen eingebaut (nur sichtbar wenn OptIn aktiv). Datenschutzerklärung Abschnitt 5 aktualisiert.",
    article: "Art. 7 DSGVO, § 7 UWG",
  },
  {
    id: "F06",
    priority: "ok",
    title: "✅ Vercel Analytics in Datenschutzerklärung ergänzt",
    detail:
      "UMGESETZT (02.04.2026): Abschnitt 2.10 der Datenschutzerklärung nennt jetzt Vercel Analytics explizit als eigenen Dienst mit Drittlandtransfer (SCC), Datenschutzlink und Erläuterung der cookiefreien Nutzung.",
    file: "app/legal/datenschutz/page.tsx",
    article: "Art. 13 DSGVO",
  },
  {
    id: "F07",
    priority: "ok",
    title: "✅ Google Generative AI in Datenschutzerklärung dokumentiert",
    detail:
      "UMGESETZT (02.04.2026): Abschnitt 2.8 der Datenschutzerklärung nennt jetzt Google Generative AI explizit als Datenempfänger mit USA-Drittlandtransfer auf SCC-Basis und Hinweis auf sensible Dateneingaben.",
    file: "app/legal/datenschutz/page.tsx",
    article: "Art. 13, 44 ff. DSGVO",
  },
  {
    id: "F08",
    priority: "medium",
    title: "Rate-Limiting nur pro Serverinstanz (kein globales Limit)",
    detail:
      "lib/rate-limit.ts implementiert Rate-Limiting im Arbeitsspeicher der Serverinstanz. Bei Multi-Instance-Deployment (Vercel, etc.) greift das Limit pro Instanz – effektiver Brute-Force-Schutz ist damit nicht gewährleistet. Empfehlung: Redis/Upstash-basiertes globales Rate-Limiting.",
    file: "lib/rate-limit.ts",
    sprint: 2,
  },
  {
    id: "F09",
    priority: "medium",
    title: "Kein Altersverifikations-Gate im Register-Flow",
    detail:
      "Die Altersanforderung ist nur im Datenschutztext erwähnt, aber nicht technisch durchgesetzt. Im Register-Flow gibt es kein Gate, das Minderjährige aktiv blockiert.",
    article: "Art. 8 DSGVO",
    sprint: 3,
  },
  {
    id: "F10",
    priority: "ok",
    title: "✅ Marketing-Abmelde-Flow implementiert",
    detail:
      "UMGESETZT (02.04.2026): DELETE /api/user/marketing widerruft Marketing-Einwilligung. Button in Profil → Einstellungen sichtbar wenn OptIn aktiv. Datenschutzerklärung Abschnitt 5 verweist auf Self-Service-Abmeldung.",
    article: "Art. 21 DSGVO, § 7 UWG",
  },
  {
    id: "F11",
    priority: "ok",
    title: "✅ snapshotConsentAt für registrierte Nutzer gesetzt",
    detail:
      "UMGESETZT (02.04.2026): accept-safety-Action setzt jetzt neben bookerSafetyAcceptedAt auch snapshotConsentAt, sodass die Einwilligung vollständig dokumentiert ist.",
    sprint: 3,
  },
  {
    id: "F12",
    priority: "ok",
    title: "✅ Datenschutztext zu Safety-Snapshots präzisiert",
    detail:
      "UMGESETZT (02.04.2026): Abschnitt 2.9 der Datenschutzerklärung beschreibt jetzt korrekt: 48h ohne Verfahren, bei laufendem Incident bis Klärung, bei Kontolöschung des Betroffenen Löschung abgeschlossener Incidents.",
    file: "app/legal/datenschutz/page.tsx",
  },
  {
    id: "F13",
    priority: "low",
    title: "Einwilligungs-Timestamps bei Anonymisierung nicht entfernt",
    detail:
      "Felder wie acceptedAgbAt, acceptedPrivacyAt etc. werden bei der Anonymisierung nicht genullt. Da der User-Record aus Aufbewahrungsgründen erhalten bleibt, ist dies nachrangig – die Timestamps sind ohne Namens-/E-Mail-Bezug nicht re-identifizierbar. Optional: Nullung als Defence-in-Depth.",
    file: "lib/anonymize-user.ts",
  },
  {
    id: "F14",
    priority: "low",
    title: "Logging mit personenbezogenen Daten",
    detail:
      "In verschiedenen console.warn/console.error-Aufrufen werden Buchungs-IDs und E-Mail-Adressen geloggt. Je nach Hosting-Anbieter können diese Logs dauerhaft gespeichert und nicht DSGVO-konform sein.",
  },
  {
    id: "OK01",
    priority: "ok",
    title: "bcrypt (12 Rounds) für Passwort-Hashing",
    detail: "Passwörter werden mit bcrypt und 12 Rounds sicher gehasht.",
  },
  {
    id: "OK02",
    priority: "ok",
    title: "HSTS / CSP / Security-Headers in middleware.ts",
    detail:
      "Wichtige HTTP-Security-Header (HSTS, CSP, X-Frame-Options etc.) sind in middleware.ts konfiguriert.",
    file: "middleware.ts",
  },
  {
    id: "OK03",
    priority: "ok",
    title: "E-Mail Double-Opt-In (emailVerificationToken)",
    detail:
      "Neue Accounts müssen die E-Mail-Adresse per Token bestätigen (DOI-Flow vollständig implementiert).",
  },
  {
    id: "OK04",
    priority: "ok",
    title: "Vision API nur EU-Endpunkt",
    detail:
      "Die Google Vision API wird ausschließlich über den EU-Endpunkt angesprochen, Drittlandtransfer ist minimiert.",
  },
  {
    id: "OK05",
    priority: "ok",
    title: "Einwilligungs-Timestamps mit Versionsangabe",
    detail:
      "Einwilligungen werden mit Timestamp und Versionsangabe gespeichert – revisionssicher dokumentiert.",
  },
  {
    id: "OK06",
    priority: "ok",
    title: "JWT-Revokation bei Kontolöschung",
    detail:
      "Beim Löschen eines Kontos werden alle aktiven JWT-Tokens invalidiert.",
  },
  {
    id: "OK07",
    priority: "ok",
    title: "Chat/Nachrichten bei Löschung entfernt",
    detail:
      "Alle Chat-Nachrichten werden bei Kontolöschung vollständig gelöscht.",
  },
  {
    id: "OK08",
    priority: "ok",
    title: "Push-Tokens/FCM bei Löschung entfernt",
    detail: "FCM-Push-Tokens werden bei Kontolöschung bereinigt.",
  },
  {
    id: "OK09",
    priority: "ok",
    title: "Analytics-Sessions vom Konto getrennt",
    detail:
      "Analytics-Session-Daten werden bei Kontolöschung vom Nutzerkonto entkoppelt.",
  },
  {
    id: "OK10",
    priority: "ok",
    title: "Stripe SCC & Daily.co SCC in next.config.mjs dokumentiert",
    detail:
      "Standard Contractual Clauses für Drittlandtransfers (Stripe, Daily.co) sind in next.config.mjs referenziert.",
    file: "next.config.mjs",
  },
];

const SPRINT_TASKS: SprintTask[] = [
  {
    id: "S1T1",
    label: "✅ Einwilligungsprüfung in Safety-Snapshot-API implementiert",
    sprint: 1,
    weeks: "Woche 1–2",
    findingIds: ["F01"],
  },
  {
    id: "S1T2",
    label: "✅ Datenexport-API (Art. 20 DSGVO) erstellt",
    sprint: 1,
    weeks: "Woche 1–2",
    findingIds: ["F02"],
  },
  {
    id: "S1T3",
    label: "✅ anonymizeUser um SafetyReport/SafetyIncident erweitert",
    sprint: 1,
    weeks: "Woche 1–2",
    findingIds: ["F03"],
  },
  {
    id: "S1T4",
    label: "✅ Dokumenten-Archiv + Crons für Aufbewahrungsfristen implementiert",
    sprint: 1,
    weeks: "Woche 1–2",
    findingIds: ["F04"],
  },
  {
    id: "S2T1",
    label: "✅ Datenschutzerklärung: Vercel Analytics & Google AI ergänzt",
    sprint: 2,
    weeks: "Woche 3–4",
    findingIds: ["F06", "F07"],
  },
  {
    id: "S2T2",
    label: "✅ Marketing-DOI-Flow + Unsubscribe-Mechanismus implementiert",
    sprint: 2,
    weeks: "Woche 3–4",
    findingIds: ["F05", "F10"],
  },
  {
    id: "S2T3",
    label: "Rate-Limiting auf Redis/Upstash umstellen (global verteilt)",
    sprint: 2,
    weeks: "Woche 3–4",
    findingIds: ["F08"],
  },
  {
    id: "S3T1",
    label: "Marketing-DOI technisch vollständig testen & dokumentieren",
    sprint: 3,
    weeks: "Monat 2–3",
    findingIds: ["F05"],
  },
  {
    id: "S3T2",
    label: "✅ Datenschutztext Safety-Snapshots präzisiert",
    sprint: 3,
    weeks: "Monat 2–3",
    findingIds: ["F12"],
  },
  {
    id: "S3T3",
    label: "Altersverifikations-Gate im Register-Flow prüfen & implementieren",
    sprint: 3,
    weeks: "Monat 2–3",
    findingIds: ["F09"],
  },
  {
    id: "S3T4",
    label: "Logging-Strategie reviewen (PII aus Logs entfernen)",
    sprint: 3,
    weeks: "Monat 2–3",
    findingIds: ["F14"],
  },
  {
    id: "S3T5",
    label: "✅ snapshotConsentAt für registrierte Nutzer gesetzt",
    sprint: 3,
    weeks: "Monat 2–3",
    findingIds: ["F11"],
  },
  {
    id: "S3T6",
    label: "Einwilligungs-Timestamps bei Anonymisierung nullen",
    sprint: 3,
    weeks: "Monat 2–3",
    findingIds: ["F13"],
  },
];

// ─── Styles ──────────────────────────────────────────────────────────────────

const COLORS = {
  bg: "#0f1117",
  surface: "#1a1d27",
  surfaceHover: "#20243a",
  border: "#2a2e42",
  borderLight: "#363b55",
  text: "#e2e8f0",
  textMuted: "#8892aa",
  textDim: "#5a6270",
  critical: "#ef4444",
  criticalBg: "rgba(239,68,68,0.08)",
  criticalBorder: "rgba(239,68,68,0.25)",
  medium: "#f97316",
  mediumBg: "rgba(249,115,22,0.08)",
  mediumBorder: "rgba(249,115,22,0.25)",
  low: "#eab308",
  lowBg: "rgba(234,179,8,0.08)",
  lowBorder: "rgba(234,179,8,0.25)",
  ok: "#22c55e",
  okBg: "rgba(34,197,94,0.08)",
  okBorder: "rgba(34,197,94,0.25)",
  accent: "#6366f1",
  accentBg: "rgba(99,102,241,0.1)",
};

const priorityConfig = {
  critical: {
    label: "Kritisch",
    color: COLORS.critical,
    bg: COLORS.criticalBg,
    border: COLORS.criticalBorder,
    dot: COLORS.critical,
  },
  medium: {
    label: "Mittel",
    color: COLORS.medium,
    bg: COLORS.mediumBg,
    border: COLORS.mediumBorder,
    dot: COLORS.medium,
  },
  low: {
    label: "Niedrig",
    color: COLORS.low,
    bg: COLORS.lowBg,
    border: COLORS.lowBorder,
    dot: COLORS.low,
  },
  ok: {
    label: "Gut umgesetzt",
    color: COLORS.ok,
    bg: COLORS.okBg,
    border: COLORS.okBorder,
    dot: COLORS.ok,
  },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function Badge({
  priority,
  compact = false,
}: {
  priority: Priority;
  compact?: boolean;
}) {
  const cfg = priorityConfig[priority];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: compact ? "2px 8px" : "3px 10px",
        borderRadius: 999,
        fontSize: compact ? 11 : 12,
        fontWeight: 600,
        letterSpacing: "0.03em",
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        flexShrink: 0,
        whiteSpace: "nowrap" as const,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: cfg.dot,
          display: "inline-block",
        }}
      />
      {cfg.label}
    </span>
  );
}

function FindingCard({
  finding,
  defaultOpen = false,
}: {
  finding: Finding;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const cfg = priorityConfig[finding.priority];

  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${open ? cfg.border : COLORS.border}`,
        background: open ? cfg.bg : COLORS.surface,
        marginBottom: 8,
        transition: "all 0.15s ease",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left" as const,
          color: COLORS.text,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontFamily: "monospace",
            color: COLORS.textDim,
            minWidth: 32,
          }}
        >
          {finding.id}
        </span>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 500, lineHeight: 1.4 }}>
          {finding.title}
        </span>
        <Badge priority={finding.priority} compact />
        <span
          style={{
            color: COLORS.textDim,
            fontSize: 12,
            marginLeft: 4,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
            display: "inline-block",
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          style={{
            padding: "0 16px 14px",
            display: "flex",
            flexDirection: "column" as const,
            gap: 8,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              color: COLORS.textMuted,
              lineHeight: 1.6,
            }}
          >
            {finding.detail}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginTop: 2 }}>
            {finding.file && (
              <span
                style={{
                  fontSize: 11.5,
                  fontFamily: "monospace",
                  background: "rgba(99,102,241,0.1)",
                  color: "#818cf8",
                  padding: "2px 8px",
                  borderRadius: 5,
                  border: "1px solid rgba(99,102,241,0.2)",
                }}
              >
                {finding.file}
              </span>
            )}
            {finding.article && (
              <span
                style={{
                  fontSize: 11.5,
                  background: "rgba(255,255,255,0.04)",
                  color: COLORS.textMuted,
                  padding: "2px 8px",
                  borderRadius: 5,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                {finding.article}
              </span>
            )}
            {finding.sprint && (
              <span
                style={{
                  fontSize: 11.5,
                  background: "rgba(255,255,255,0.04)",
                  color: COLORS.textDim,
                  padding: "2px 8px",
                  borderRadius: 5,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                Sprint {finding.sprint}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  count,
  priority,
  open,
  onClick,
}: {
  title: string;
  subtitle?: string;
  count: number;
  priority: Priority;
  open: boolean;
  onClick: () => void;
}) {
  const cfg = priorityConfig[priority];
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px 20px",
        background: open ? cfg.bg : "transparent",
        border: `1px solid ${open ? cfg.border : COLORS.border}`,
        borderRadius: 12,
        cursor: "pointer",
        textAlign: "left" as const,
        color: COLORS.text,
        marginBottom: open ? 0 : 12,
        borderBottomLeftRadius: open ? 0 : 12,
        borderBottomRightRadius: open ? 0 : 12,
        transition: "all 0.15s ease",
      }}
    >
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: cfg.color,
          flexShrink: 0,
          boxShadow: `0 0 8px ${cfg.color}60`,
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: cfg.color,
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          borderRadius: 999,
          padding: "2px 10px",
        }}
      >
        {count} Befund{count !== 1 ? "e" : ""}
      </span>
      <span
        style={{
          color: COLORS.textDim,
          fontSize: 13,
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.15s ease",
          display: "inline-block",
        }}
      >
        ▾
      </span>
    </button>
  );
}

function SprintCard({
  sprintNum,
  title,
  weeks,
  color,
  tasks,
  checked,
  onToggle,
}: {
  sprintNum: number;
  title: string;
  weeks: string;
  color: string;
  tasks: SprintTask[];
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const done = tasks.filter((t) => checked[t.id]).length;
  const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        background: COLORS.surface,
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `${color}18`,
            border: `1px solid ${color}40`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 14,
            color: color,
            flexShrink: 0,
          }}
        >
          {sprintNum}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.text }}>
            {title}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 2 }}>
            {weeks}
          </div>
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: pct === 100 ? COLORS.ok : color,
          }}
        >
          {done}/{tasks.length}
        </div>
      </div>

      <div
        style={{
          height: 4,
          borderRadius: 999,
          background: COLORS.border,
          marginBottom: 14,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: pct === 100 ? COLORS.ok : color,
            borderRadius: 999,
            transition: "width 0.3s ease",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
        {tasks.map((task) => (
          <label
            key={task.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              cursor: "pointer",
              padding: "6px 8px",
              borderRadius: 8,
              background: checked[task.id]
                ? "rgba(34,197,94,0.06)"
                : "transparent",
              border: `1px solid ${checked[task.id] ? "rgba(34,197,94,0.15)" : "transparent"}`,
              transition: "all 0.12s ease",
            }}
          >
            <div
              onClick={() => onToggle(task.id)}
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                border: `2px solid ${checked[task.id] ? COLORS.ok : COLORS.borderLight}`,
                background: checked[task.id] ? COLORS.ok : "transparent",
                flexShrink: 0,
                marginTop: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.12s ease",
              }}
            >
              {checked[task.id] && (
                <span style={{ color: "#000", fontSize: 10, fontWeight: 900 }}>
                  ✓
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: 13,
                color: checked[task.id] ? COLORS.textDim : COLORS.textMuted,
                lineHeight: 1.5,
                textDecoration: checked[task.id] ? "line-through" : "none",
              }}
            >
              {task.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function DSGVOReport() {
  const [filter, setFilter] = useState<Filter>("all");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    critical: true,
    medium: false,
    low: false,
    ok: false,
  });
  // Vorausfüllen: alle Sprint-1 und Sprint-2 Aufgaben sind umgesetzt (02.04.2026).
  // Sprint-3 Aufgaben bleiben offen.
  const COMPLETED_TASKS: Record<string, boolean> = {
    S1T1: true, S1T2: true, S1T3: true, S1T4: true,
    S2T1: true, S2T2: true,
    S3T2: true, S3T5: true,
  };
  const [checked, setChecked] = useState<Record<string, boolean>>(COMPLETED_TASKS);

  const toggleSection = (key: string) =>
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  const toggleTask = (id: string) =>
    setChecked((s) => ({ ...s, [id]: !s[id] }));

  const findings = FINDINGS.filter(
    (f) => filter === "all" || f.priority === filter
  );

  const byCritical = findings.filter((f) => f.priority === "critical");
  const byMedium = findings.filter((f) => f.priority === "medium");
  const byLow = findings.filter((f) => f.priority === "low");
  const byOk = findings.filter((f) => f.priority === "ok");

  const totalTasks = SPRINT_TASKS.length;
  const doneTasks = SPRINT_TASKS.filter((t) => checked[t.id]).length;
  const overallPct = Math.round((doneTasks / totalTasks) * 100);

  const FILTER_OPTS: { key: Filter; label: string; color: string }[] = [
    { key: "all", label: "Alle", color: COLORS.accent },
    { key: "critical", label: "Kritisch", color: COLORS.critical },
    { key: "medium", label: "Mittel", color: COLORS.medium },
    { key: "low", label: "Niedrig", color: COLORS.low },
    { key: "ok", label: "OK", color: COLORS.ok },
  ];

  const countsByPriority: Record<Priority, number> = {
    critical: FINDINGS.filter((f) => f.priority === "critical").length,
    medium: FINDINGS.filter((f) => f.priority === "medium").length,
    low: FINDINGS.filter((f) => f.priority === "low").length,
    ok: FINDINGS.filter((f) => f.priority === "ok").length,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: "0 0 60px",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: `linear-gradient(135deg, #12141e 0%, #1a1d2e 100%)`,
          borderBottom: `1px solid ${COLORS.border}`,
          padding: "32px 24px 28px",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 16,
              flexWrap: "wrap" as const,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: "rgba(99,102,241,0.15)",
                border: "1px solid rgba(99,102,241,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                flexShrink: 0,
              }}
            >
              🛡️
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase" as const,
                  color: "#818cf8",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                diAIway · DSGVO-Audit
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 26,
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  color: COLORS.text,
                }}
              >
                Datenschutz-Compliance Report
              </h1>
              <div
                style={{
                  fontSize: 13,
                  color: COLORS.textDim,
                  marginTop: 4,
                }}
              >
                Technische Analyse · Stand April 2026
              </div>
            </div>
            <div
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                padding: "12px 20px",
                textAlign: "center" as const,
                minWidth: 120,
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color:
                    countsByPriority.critical > 0
                      ? COLORS.critical
                      : COLORS.ok,
                }}
              >
                {countsByPriority.critical}
              </div>
              <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>
                Kritische Befunde
              </div>
            </div>
          </div>

          {/* Summary stat row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 10,
              marginTop: 24,
            }}
          >
            {(
              [
                ["critical", "🔴", "Kritisch"],
                ["medium", "🟠", "Mittel"],
                ["low", "🟡", "Niedrig"],
                ["ok", "🟢", "Gut umgesetzt"],
              ] as [Priority, string, string][]
            ).map(([p, emoji, label]) => (
              <button
                key={p}
                onClick={() => setFilter((f) => (f === p ? "all" : p))}
                style={{
                  background:
                    filter === p
                      ? priorityConfig[p].bg
                      : "rgba(255,255,255,0.03)",
                  border: `1px solid ${filter === p ? priorityConfig[p].border : COLORS.border}`,
                  borderRadius: 10,
                  padding: "10px 8px",
                  cursor: "pointer",
                  textAlign: "center" as const,
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ fontSize: 20 }}>{emoji}</div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: priorityConfig[p].color,
                    lineHeight: 1.2,
                  }}
                >
                  {countsByPriority[p]}
                </div>
                <div
                  style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}
                >
                  {label}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 24px 0" }}>
        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            gap: 6,
            background: COLORS.surface,
            padding: 4,
            borderRadius: 10,
            border: `1px solid ${COLORS.border}`,
            marginBottom: 28,
            flexWrap: "wrap" as const,
          }}
        >
          {FILTER_OPTS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              style={{
                flex: 1,
                minWidth: 70,
                padding: "7px 12px",
                borderRadius: 7,
                border: "none",
                background: filter === opt.key ? opt.color : "transparent",
                color:
                  filter === opt.key ? "#fff" : COLORS.textMuted,
                fontWeight: filter === opt.key ? 700 : 500,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* ── Findings Sections ── */}
        <div style={{ marginBottom: 36 }}>
          {(filter === "all" || filter === "critical") &&
            byCritical.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <SectionHeader
                  title="Kritischer Handlungsbedarf"
                  subtitle="Sofortiger Handlungsbedarf – rechtliches Risiko"
                  count={byCritical.length}
                  priority="critical"
                  open={openSections.critical}
                  onClick={() => toggleSection("critical")}
                />
                {openSections.critical && (
                  <div
                    style={{
                      border: `1px solid ${COLORS.criticalBorder}`,
                      borderTop: "none",
                      borderBottomLeftRadius: 12,
                      borderBottomRightRadius: 12,
                      padding: "12px 12px 4px",
                      background: "rgba(239,68,68,0.03)",
                      marginBottom: 12,
                    }}
                  >
                    {byCritical.map((f) => (
                      <FindingCard
                        key={f.id}
                        finding={f}
                        defaultOpen={false}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

          {(filter === "all" || filter === "medium") &&
            byMedium.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <SectionHeader
                  title="Mittlerer Handlungsbedarf"
                  subtitle="Innerhalb 30 Tage beheben"
                  count={byMedium.length}
                  priority="medium"
                  open={openSections.medium}
                  onClick={() => toggleSection("medium")}
                />
                {openSections.medium && (
                  <div
                    style={{
                      border: `1px solid ${COLORS.mediumBorder}`,
                      borderTop: "none",
                      borderBottomLeftRadius: 12,
                      borderBottomRightRadius: 12,
                      padding: "12px 12px 4px",
                      background: "rgba(249,115,22,0.03)",
                      marginBottom: 12,
                    }}
                  >
                    {byMedium.map((f) => (
                      <FindingCard key={f.id} finding={f} />
                    ))}
                  </div>
                )}
              </div>
            )}

          {(filter === "all" || filter === "low") && byLow.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <SectionHeader
                title="Niedriger Handlungsbedarf"
                subtitle="Innerhalb 90 Tage / dokumentarisch"
                count={byLow.length}
                priority="low"
                open={openSections.low}
                onClick={() => toggleSection("low")}
              />
              {openSections.low && (
                <div
                  style={{
                    border: `1px solid ${COLORS.lowBorder}`,
                    borderTop: "none",
                    borderBottomLeftRadius: 12,
                    borderBottomRightRadius: 12,
                    padding: "12px 12px 4px",
                    background: "rgba(234,179,8,0.03)",
                    marginBottom: 12,
                  }}
                >
                  {byLow.map((f) => (
                    <FindingCard key={f.id} finding={f} />
                  ))}
                </div>
              )}
            </div>
          )}

          {(filter === "all" || filter === "ok") && byOk.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <SectionHeader
                title="Bereits gut umgesetzt"
                subtitle="Kein Handlungsbedarf"
                count={byOk.length}
                priority="ok"
                open={openSections.ok}
                onClick={() => toggleSection("ok")}
              />
              {openSections.ok && (
                <div
                  style={{
                    border: `1px solid ${COLORS.okBorder}`,
                    borderTop: "none",
                    borderBottomLeftRadius: 12,
                    borderBottomRightRadius: 12,
                    padding: "12px 12px 4px",
                    background: "rgba(34,197,94,0.03)",
                    marginBottom: 12,
                  }}
                >
                  {byOk.map((f) => (
                    <FindingCard key={f.id} finding={f} />
                  ))}
                </div>
              )}
            </div>
          )}

          {findings.length === 0 && (
            <div
              style={{
                textAlign: "center" as const,
                padding: "48px 24px",
                color: COLORS.textDim,
                fontSize: 14,
              }}
            >
              Keine Befunde für diesen Filter.
            </div>
          )}
        </div>

        {/* ── Implementation Plan ── */}
        {(filter === "all" ||
          filter === "critical" ||
          filter === "medium" ||
          filter === "low") && (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
                flexWrap: "wrap" as const,
                gap: 10,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 800,
                    color: COLORS.text,
                  }}
                >
                  Umsetzungsplan
                </h2>
                <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 3 }}>
                  Interaktiver Sprint-Tracker · Checkboxen zum Abhaken
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 10,
                  padding: "8px 16px",
                }}
              >
                <div
                  style={{
                    width: 80,
                    height: 6,
                    borderRadius: 999,
                    background: COLORS.border,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${overallPct}%`,
                      background:
                        overallPct === 100 ? COLORS.ok : COLORS.accent,
                      borderRadius: 999,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: overallPct === 100 ? COLORS.ok : COLORS.textMuted,
                  }}
                >
                  {doneTasks}/{totalTasks} erledigt ({overallPct}%)
                </span>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 14,
              }}
            >
              <SprintCard
                sprintNum={1}
                title="Sprint 1 – Kritische Fixes"
                weeks="Woche 1–2"
                color={COLORS.critical}
                tasks={SPRINT_TASKS.filter((t) => t.sprint === 1)}
                checked={checked}
                onToggle={toggleTask}
              />
              <SprintCard
                sprintNum={2}
                title="Sprint 2 – Mittlere Maßnahmen"
                weeks="Woche 3–4"
                color={COLORS.medium}
                tasks={SPRINT_TASKS.filter((t) => t.sprint === 2)}
                checked={checked}
                onToggle={toggleTask}
              />
              <SprintCard
                sprintNum={3}
                title="Sprint 3 – Dokumentarisch"
                weeks="Monat 2–3"
                color={COLORS.low}
                tasks={SPRINT_TASKS.filter((t) => t.sprint === 3)}
                checked={checked}
                onToggle={toggleTask}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: 40,
            paddingTop: 20,
            borderTop: `1px solid ${COLORS.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap" as const,
            gap: 8,
          }}
        >
          <span style={{ fontSize: 12, color: COLORS.textDim }}>
            diAIway · DSGVO-Audit-Report · April 2026
          </span>
          <span style={{ fontSize: 12, color: COLORS.textDim }}>
            {FINDINGS.filter((f) => f.priority !== "ok").length} offene Befunde
            &nbsp;·&nbsp;
            {countsByPriority.ok} bereits compliant
          </span>
        </div>
      </div>
    </div>
  );
}
