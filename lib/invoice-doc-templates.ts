/**
 * Pro Belegtyp editierbare PDF-Texte (Admin). Merge: Patch aus DB → globale Fallbacks → Code-Defaults.
 */

export const INVOICE_DOC_KEYS = ["re_session", "gbl", "gs", "sr", "sg", "re_commission"] as const
export type InvoiceDocKey = (typeof INVOICE_DOC_KEYS)[number]

export const DOC_TYPE_LABELS: Record<InvoiceDocKey, string> = {
  re_session: "Rechnung (Session)",
  gbl: "Guthabenbeleg (Wallet-Einzahlung)",
  gs: "Gutschrift",
  sr: "Storno-Rechnung",
  sg: "Storno-Gutschrift",
  re_commission: "Provisionsrechnung (diAiway → Takumi)",
}

/** In documentTemplates JSON gespeicherte Overrides (alle optional) */
export type InvoiceDocTemplatePatch = {
  title?: string | null
  documentNumberLabel?: string | null
  recipientLabel?: string | null
  sectionLabel?: string | null
  /** Betreff-Zeile unter dem Adressblock (nur RE / Wallet-RE) */
  subjectLine?: string | null
  /** Einleitungstext vor der Leistungstabelle (nur RE / Wallet-RE) */
  introductionText?: string | null
  /** Hinweis zu maschineller Erstellung / Unterschrift (nur RE / Wallet-RE) */
  signatureNote?: string | null
  walletLineText?: string | null
  serviceName?: string | null
  customerNumberLabel?: string | null
  paymentNote?: string | null
  closingLine?: string | null
  footerText?: string | null
  stornoNumberLabel?: string | null
  storniertLabel?: string | null
  dateLabel?: string | null
  detailBruttoPrefix?: string | null
  detailFeePrefix?: string | null
  detailNetPrefix?: string | null
  stornoBetragPrefix?: string | null
}

export type DocumentTemplatesStored = Partial<Record<InvoiceDocKey, InvoiceDocTemplatePatch>>

export type ResolvedInvoiceDocTemplate = {
  title: string
  documentNumberLabel: string
  recipientLabel: string
  sectionLabel: string
  subjectLine: string
  introductionText: string
  signatureNote: string
  walletLineText: string
  serviceName: string
  customerNumberLabel: string
  paymentNote: string
  closingLine: string
  footerText: string | null
  stornoNumberLabel: string
  storniertLabel: string
  dateLabel: string
  detailBruttoPrefix: string
  detailFeePrefix: string
  detailNetPrefix: string
  stornoBetragPrefix: string
}

/** Zusatzfelder nur für Provisionsrechnung */
export type InvoiceDocTemplatePatchExtended = InvoiceDocTemplatePatch & {
  commissionRateLabel?: string | null
  commissionNoteText?: string | null
}

const BASE: Record<InvoiceDocKey, ResolvedInvoiceDocTemplate> = {
  re_session: {
    title: "Rechnung",
    documentNumberLabel: "Rechnungsnummer:",
    recipientLabel: "Rechnungsempfänger:",
    sectionLabel: "Block erhaltene Dienstleistungen",
    subjectLine: "Rechnung Video/Voicecall",
    introductionText:
      "Guten Tag {{firstName}} {{lastName}} ({{username}}),\nfolgende erbrachte Leistung dürfen wir in Rechnung stellen:",
    signatureNote:
      "Hinweis: Dieses Schreiben würde maschinell unterschrieben und ist daher ohne Unterschrift gültig.",
    walletLineText: "",
    serviceName: "Video/Voicecall mit Takumi",
    customerNumberLabel: "Kundennummer:",
    paymentNote: "Der Betrag wird entsprechend des gewählten Zahlungsmittels beglichen.",
    closingLine: "Vielen Dank, wir freuen uns über den nächsten Besuch auf diAIway\n\nTeam - diAiway",
    footerText: null,
    stornoNumberLabel: "Storno-Nr.:",
    storniertLabel: "Storniert:",
    dateLabel: "Datum:",
    detailBruttoPrefix: "Bruttobetrag:",
    detailFeePrefix: "Plattformgebühr (15%):",
    detailNetPrefix: "Netto-Auszahlung:",
    stornoBetragPrefix: "Storno-Betrag:",
  },
  gbl: {
    title: "Guthabenbeleg",
    documentNumberLabel: "Belegnummer:",
    recipientLabel: "Empfänger:",
    sectionLabel: "Einzahlungsdetails",
    subjectLine: "Einzahlungsbeleg — Guthaben-Aufladung",
    introductionText:
      "Guten Tag {{firstName}} {{lastName}} ({{username}}),\nIhr Guthaben wurde um den folgenden Betrag aufgeladen:",
    signatureNote:
      "Dieser Beleg wurde maschinell erstellt und ist ohne Unterschrift gültig.",
    walletLineText: "Guthaben-Aufladung",
    serviceName: "",
    customerNumberLabel: "Kundennummer:",
    paymentNote: "Der Betrag wurde Ihrem Guthaben gutgeschrieben und steht ab sofort zur Verfügung.",
    closingLine: "Vielen Dank, wir freuen uns über den nächsten Besuch auf diAIway\n\nTeam - diAiway",
    footerText: null,
    stornoNumberLabel: "Storno-Nr.:",
    storniertLabel: "Storniert:",
    dateLabel: "Datum:",
    detailBruttoPrefix: "Bruttobetrag:",
    detailFeePrefix: "Plattformgebühr (15%):",
    detailNetPrefix: "Netto-Auszahlung:",
    stornoBetragPrefix: "Storno-Betrag:",
  },
  gs: {
    title: "Gutschrift",
    documentNumberLabel: "Gutschrift-Nr.:",
    recipientLabel: "Empfänger:",
    sectionLabel: "Abrechnung",
    subjectLine: "Gutschrift Video/Voicecall",
    introductionText: "",
    signatureNote:
      "Hinweis: Dieses Schreiben würde maschinell unterschrieben und ist daher ohne Unterschrift gültig.",
    walletLineText: "",
    serviceName: "Expertensitzung",
    customerNumberLabel: "Kundennummer:",
    paymentNote: "",
    closingLine: "Dieser Betrag wurde Ihrem Wallet-Guthaben gutgeschrieben.\n\nTeam - diAiway",
    footerText: null,
    stornoNumberLabel: "Storno-Nr.:",
    storniertLabel: "Storniert:",
    dateLabel: "Datum:",
    detailBruttoPrefix: "Bruttobetrag:",
    detailFeePrefix: "Plattformgebühr (15%):",
    detailNetPrefix: "Netto-Auszahlung:",
    stornoBetragPrefix: "Storno-Betrag:",
  },
  sr: {
    title: "Storno-Rechnung",
    documentNumberLabel: "Rechnungsnummer:",
    recipientLabel: "Rechnungsempfänger:",
    sectionLabel: "Stornierte Position",
    subjectLine: "Storno-Rechnung",
    introductionText: "",
    signatureNote:
      "Hinweis: Dieses Schreiben würde maschinell unterschrieben und ist daher ohne Unterschrift gültig.",
    walletLineText: "",
    serviceName: "Video/Voicecall mit Takumi",
    customerNumberLabel: "Kundennummer:",
    paymentNote: "",
    closingLine:
      "Diese Storno-Rechnung hebt die Rechnung mit der o. g. Rechnungsnummer auf.\n\nTeam - diAiway",
    footerText: null,
    stornoNumberLabel: "Storno-Nr.:",
    storniertLabel: "Storniert:",
    dateLabel: "Datum:",
    detailBruttoPrefix: "Bruttobetrag:",
    detailFeePrefix: "Plattformgebühr (15%):",
    detailNetPrefix: "Netto-Auszahlung:",
    stornoBetragPrefix: "Storno-Betrag:",
  },
  sg: {
    title: "Storno-Gutschrift",
    documentNumberLabel: "Gutschrift-Nr.:",
    recipientLabel: "Empfänger:",
    sectionLabel: "Stornierte Abrechnung",
    subjectLine: "Storno-Gutschrift",
    introductionText: "",
    signatureNote:
      "Hinweis: Dieses Schreiben würde maschinell unterschrieben und ist daher ohne Unterschrift gültig.",
    walletLineText: "",
    serviceName: "Expertensitzung",
    customerNumberLabel: "Kundennummer:",
    paymentNote: "",
    closingLine:
      "Diese Storno-Gutschrift hebt die Gutschrift mit der o. g. Nummer auf.\n\nTeam - diAiway",
    footerText: null,
    stornoNumberLabel: "Storno-Nr.:",
    storniertLabel: "Storniert:",
    dateLabel: "Datum:",
    detailBruttoPrefix: "Bruttobetrag:",
    detailFeePrefix: "Plattformgebühr (15%):",
    detailNetPrefix: "Netto-Storno:",
    stornoBetragPrefix: "Storno-Betrag:",
  },
  re_commission: {
    title: "Provisionsrechnung",
    documentNumberLabel: "Rechnungsnummer:",
    recipientLabel: "Rechnungsempfänger:",
    sectionLabel: "Vermittlungsprovision",
    subjectLine: "Provisionsrechnung — Vermittlungsgebühr diAiway",
    introductionText:
      "gemäß unserer Vereinbarung (AGB diAiway) stellen wir Ihnen folgende Vermittlungsprovision in Rechnung:",
    signatureNote:
      "Hinweis: Dieses Schreiben wurde maschinell erstellt und ist daher ohne Unterschrift gültig.",
    walletLineText: "",
    serviceName: "Vermittlungsprovision (15 %)",
    customerNumberLabel: "Kundennummer:",
    paymentNote: "Die Provision wurde bereits durch Stripe direkt vom Zahlungseingang einbehalten.",
    closingLine: "Vielen Dank für Ihre Zusammenarbeit mit diAiway.\n\nTeam - diAiway",
    footerText: null,
    stornoNumberLabel: "Storno-Nr.:",
    storniertLabel: "Storniert:",
    dateLabel: "Datum:",
    detailBruttoPrefix: "Bruttobetrag (Kundenzahlung):",
    detailFeePrefix: "Vermittlungsprovision (15 %):",
    detailNetPrefix: "Ihr Auszahlungsbetrag:",
    stornoBetragPrefix: "Storno-Betrag:",
  },
}

/** Code-Defaults (ohne DB / globale Branding-Felder) — z. B. Placeholder im Admin. */
export function getInvoiceDocTemplateDefaults(key: InvoiceDocKey): ResolvedInvoiceDocTemplate {
  return BASE[key]
}

function parseStoredTemplates(raw: unknown): DocumentTemplatesStored {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const o = raw as Record<string, unknown>
  const out: DocumentTemplatesStored = {}
  for (const k of INVOICE_DOC_KEYS) {
    const v = o[k]
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = v as InvoiceDocTemplatePatch
    }
  }
  return out
}

function pickStr(
  patch: string | null | undefined,
  globalFallback: string | null | undefined,
  base: string
): string {
  if (typeof patch === "string" && patch.trim() !== "") return patch.trim()
  if (typeof globalFallback === "string" && globalFallback.trim() !== "") return globalFallback.trim()
  return base
}

function pickStrNullable(
  patch: string | null | undefined,
  globalFallback: string | null | undefined,
  base: string | null
): string | null {
  if (typeof patch === "string") {
    const t = patch.trim()
    if (t !== "") return t
    return null
  }
  if (patch === null) return null
  if (typeof globalFallback === "string" && globalFallback.trim() !== "") return globalFallback.trim()
  return base
}

function ov(
  patch: InvoiceDocTemplatePatch,
  k: keyof InvoiceDocTemplatePatch,
  fallback: string
): string {
  const v = patch[k]
  if (typeof v === "string" && v.trim() !== "") return v.trim()
  return fallback
}

/**
 * Liefert die vollständig aufgelösten Texte für einen Belegtyp.
 */
export function resolveInvoiceDocTemplate(
  key: InvoiceDocKey,
  branding: {
    footerText: string | null
    paymentNote: string | null
    closingLine: string | null
    documentTemplates: unknown
  }
): ResolvedInvoiceDocTemplate {
  const base = BASE[key]
  const patch = parseStoredTemplates(branding.documentTemplates)[key] ?? {}

  const paymentNote =
    key === "re_session" || key === "gbl"
      ? pickStr(patch.paymentNote, branding.paymentNote, base.paymentNote)
      : base.paymentNote

  return {
    title: ov(patch, "title", base.title),
    documentNumberLabel: ov(patch, "documentNumberLabel", base.documentNumberLabel),
    recipientLabel: ov(patch, "recipientLabel", base.recipientLabel),
    sectionLabel: ov(patch, "sectionLabel", base.sectionLabel),
    subjectLine: ov(patch, "subjectLine", base.subjectLine),
    introductionText: ov(patch, "introductionText", base.introductionText),
    signatureNote: ov(patch, "signatureNote", base.signatureNote),
    walletLineText: ov(patch, "walletLineText", base.walletLineText),
    serviceName: ov(patch, "serviceName", base.serviceName),
    customerNumberLabel: ov(patch, "customerNumberLabel", base.customerNumberLabel),
    paymentNote,
    closingLine: pickStr(patch.closingLine, branding.closingLine, base.closingLine),
    footerText: pickStrNullable(patch.footerText, branding.footerText, base.footerText),
    stornoNumberLabel: ov(patch, "stornoNumberLabel", base.stornoNumberLabel),
    storniertLabel: ov(patch, "storniertLabel", base.storniertLabel),
    dateLabel: ov(patch, "dateLabel", base.dateLabel),
    detailBruttoPrefix: ov(patch, "detailBruttoPrefix", base.detailBruttoPrefix),
    detailFeePrefix: ov(patch, "detailFeePrefix", base.detailFeePrefix),
    detailNetPrefix: ov(patch, "detailNetPrefix", base.detailNetPrefix),
    stornoBetragPrefix: ov(patch, "stornoBetragPrefix", base.stornoBetragPrefix),
  }
}

export function emptyDocumentTemplatesPayload(): DocumentTemplatesStored {
  return {}
}

/** Reihenfolge der Felder im Admin-Formular */
export const DOC_TEMPLATE_FIELD_ORDER: (keyof InvoiceDocTemplatePatch)[] = [
  "title",
  "documentNumberLabel",
  "stornoNumberLabel",
  "storniertLabel",
  "dateLabel",
  "recipientLabel",
  "customerNumberLabel",
  "sectionLabel",
  "subjectLine",
  "introductionText",
  "signatureNote",
  "walletLineText",
  "serviceName",
  "paymentNote",
  "detailBruttoPrefix",
  "detailFeePrefix",
  "detailNetPrefix",
  "stornoBetragPrefix",
  "closingLine",
  "footerText",
]

/** Kurzbeschriftungen für Admin-UI */
export const DOC_TEMPLATE_FIELD_LABELS: Record<keyof InvoiceDocTemplatePatch, string> = {
  title: "PDF-Titel (Kopfzeile)",
  documentNumberLabel: "Label Belegnummer (z. B. Rechnungsnummer:)",
  stornoNumberLabel: "Label Storno-Nr.",
  storniertLabel: "Label „Storniert“ (Referenz auf Originalbeleg)",
  dateLabel: "Label Datum",
  recipientLabel: "Label Empfänger",
  customerNumberLabel: "Label Kundennummer",
  sectionLabel: "Überschrift Leistungsblock (z. B. Erhaltene Dienstleistungen)",
  subjectLine: "Betreff (eine Zeile unter Adresse)",
  introductionText: "Einleitungstext (vor der Tabelle)",
  signatureNote: "Hinweis maschinelle Erstellung / ohne Unterschrift",
  walletLineText: "Text Positionszeile Wallet-Aufladung",
  serviceName: "Leistungstext vor Takumi-Name (z. B. Video/Voicecall mit Takumi)",
  paymentNote: "Zahlungshinweis (nur RE / Wallet-RE)",
  detailBruttoPrefix: "Zeile Bruttobetrag (Präfix)",
  detailFeePrefix: "Zeile Plattformgebühr (Präfix)",
  detailNetPrefix: "Zeile Netto (Präfix)",
  stornoBetragPrefix: "Zeile Storno-Betrag (Präfix)",
  closingLine: "Abschlusszeile (unten)",
  footerText: "Zusätzlicher Fußtext (optional, pro Belegtyp)",
}

/** Felder, die pro Belegtyp sinnvoll sind (andere ausblenden) */
export const DOC_TEMPLATE_FIELDS_BY_KEY: Record<InvoiceDocKey, (keyof InvoiceDocTemplatePatch)[]> = {
  re_session: [
    "title",
    "documentNumberLabel",
    "dateLabel",
    "recipientLabel",
    "customerNumberLabel",
    "sectionLabel",
    "subjectLine",
    "introductionText",
    "serviceName",
    "paymentNote",
    "signatureNote",
    "closingLine",
    "footerText",
  ],
  gbl: [
    "title",
    "documentNumberLabel",
    "dateLabel",
    "recipientLabel",
    "customerNumberLabel",
    "sectionLabel",
    "subjectLine",
    "introductionText",
    "walletLineText",
    "paymentNote",
    "signatureNote",
    "closingLine",
    "footerText",
  ],
  gs: [
    "title",
    "documentNumberLabel",
    "dateLabel",
    "recipientLabel",
    "customerNumberLabel",
    "sectionLabel",
    "detailBruttoPrefix",
    "detailFeePrefix",
    "detailNetPrefix",
    "signatureNote",
    "closingLine",
    "footerText",
  ],
  sr: [
    "title",
    "stornoNumberLabel",
    "storniertLabel",
    "dateLabel",
    "recipientLabel",
    "customerNumberLabel",
    "sectionLabel",
    "serviceName",
    "stornoBetragPrefix",
    "signatureNote",
    "closingLine",
    "footerText",
  ],
  sg: [
    "title",
    "stornoNumberLabel",
    "storniertLabel",
    "dateLabel",
    "recipientLabel",
    "customerNumberLabel",
    "sectionLabel",
    "detailBruttoPrefix",
    "detailFeePrefix",
    "detailNetPrefix",
    "signatureNote",
    "closingLine",
    "footerText",
  ],
  re_commission: [
    "title",
    "documentNumberLabel",
    "dateLabel",
    "recipientLabel",
    "customerNumberLabel",
    "sectionLabel",
    "subjectLine",
    "introductionText",
    "detailBruttoPrefix",
    "detailFeePrefix",
    "detailNetPrefix",
    "signatureNote",
    "closingLine",
    "footerText",
  ],
}
