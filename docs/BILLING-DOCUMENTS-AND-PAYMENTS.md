# Belege, Zahlungen und Marktplatz-Abrechnung

**Stand:** März 2026  

Dieses Dokument beschreibt **die technische und fachliche Implementierung** im Code (PDFs, Nummern, Flows). Es ist **keine Steuer- oder Rechtsberatung**; finale Prüfung obliegt Steuerberater und Anwalt.

---

## 1. Kurzüberblick

| Thema | Kurzbeschreibung |
|-------|------------------|
| **Marktplatz** | Shugyo zahlt für eine **reale Dienstleistung** eines Takumi; die Plattform vermittelt und erhebt eine **Provision** (15 %). |
| **Stripe** | Buchungszahlungen nutzen **Stripe Connect** (Express), sodass der Großteil des Betrags dem **Connected Account** des Takumi zugeordnet wird; die Plattform erhält die **Application Fee** (Provision). Zusätzlich: **Hold & Capture** wo im Flow vorgesehen. |
| **Wallet (Guthaben)** | Internes **Guthaben** für Shugyo; Aufladung per Stripe Checkout. **Keine** Umsatzsteuer-Rechnung bei Aufladung — siehe **GBL** (Guthabenbeleg). |
| **PDF-Belege** | jsPDF + Branding aus DB (`InvoiceBranding`), Textvorlagen pro Belegtyp (`documentTemplates` JSON). |
| **Gutschriftverfahren** | Rechnung an den Shugyo (RE): **Aussteller im Sinne der Darstellung** ist der **Takumi**; diAiway stellt im Auftrag aus (**§ 14 Abs. 2 UStG** — Hinweis auf dem PDF). |

---

## 2. Belegtypen und Nummernkreise

### 2.1 Datenbank: `InvoiceCounter`

Implementierung: `lib/billing.ts` — `getNextDocumentNumber(type)`.

| `type` (Prisma) | Anzeige-Format | Verwendung |
|-----------------|----------------|------------|
| `KD` | `KD-00001` (5-stellig) | Kundennummer User (einmalig) |
| `RE` | `RE-100001` … | Rechnung an Shugyo (Session-Leistung) |
| `GS` | `GS-100001` … | Gutschrift an Takumi (Auszahlungsnachweis / Abrechnung) |
| `PR` | `PR-100001` … | **Provisionsrechnung** Plattform → Takumi (Provision 15 %) |
| `SR` | `SR-100001` … | Storno-Rechnung (Storno der RE an Shugyo) |
| `SG` | `SG-100001` … | Storno-Gutschrift (Storno der GS an Takumi) |
| `GBL` | `GBL-100001` … | **Guthabenbeleg** (Wallet-Aufladung — **kein** §14-UStG-Rechnungsdokument) |

Startwerte für neue Installationen: siehe `INITIAL_VALUES` in `lib/billing.ts` (u. a. `RE`/`GS`/… ab 100000, `KD` ab 1).

Dokumentation nur KD: ergänzend [kundennummer-zaehler.md](./kundennummer-zaehler.md).

### 2.2 PDF-Dokument-Schlüssel (Admin-Texte)

Konstante `INVOICE_DOC_KEYS` in `lib/invoice-doc-templates.ts`:

| Schlüssel | Label (Admin) | PDF-Funktion (Hauptaufruf) |
|-----------|---------------|----------------------------|
| `re_session` | Rechnung (Session) | `generateInvoicePdf` |
| `gbl` | Guthabenbeleg (Wallet-Einzahlung) | `generateWalletTopupReceiptPdf` |
| `gs` | Gutschrift | `generateCreditNotePdf` |
| `sr` | Storno-Rechnung | `generateStornoInvoicePdf` |
| `sg` | Storno-Gutschrift | `generateStornoCreditNotePdf` |
| `re_commission` | Provisionsrechnung | `generateCommissionInvoicePdf` |

**Hinweis:** Früher hieß der Wallet-Beleg `re_wallet` („Rechnung Wallet“). Das wurde durch **`gbl`** ersetzt, da bei reiner Guthabenaufladung **noch keine steuerbare Leistung** vorliegt.

---

## 3. Ablauf nach Session-Abschluss (Case B, ≥ 5 Min)

Server Action: `app/actions/process-completion.ts` (`processCompletion`).

Typischer Ablauf (vereinfacht):

1. Zahlung **capturen** bzw. Wallet abbuchen (je nach `Transaction`/Stripe-Metadaten).
2. Parallele Vergabe der Belegnummern: `RE`, `GS`, `PR` (Provision wird **immer** mitgeführt, unabhängig vom Zahlungskanal).
3. PDF-Erzeugung:
   - **RE** an Shugyo: `generateInvoicePdf` mit `takumiSenderName` (Takumi als Aussteller-Zeile), `takumiVatStatus`, optional ZUGFeRD wenn Shugyo **Unternehmen**.
   - **GS** an Takumi: `generateCreditNotePdf` mit `takumiVatStatus` (Hinweiszeilen bei Kleinunternehmer/Privat).
   - **PR** an Takumi: `generateCommissionInvoicePdf` mit `takumiVatStatus`.
4. Upload der PDFs zu Vercel Blob, URLs in der `Transaction`/Metadaten.
5. E-Mail-Versand der PDFs (Konfiguration SMTP).
6. In-App-Notification + Push an Shugyo (Session abgeschlossen).

Takumi-Steuerlogik: `resolveTakumiVatStatus` / `vatNoteForStatus` in `lib/invoice-requirements.ts`:

- **`standard`:** Unternehmen ohne Kleinunternehmer-Flag → 19 % MwSt.-Ausweis auf der RE (sofern im PDF vorgesehen).
- **`kleinunternehmer`:** Unternehmen mit `kleinunternehmer: true` → 0 %, Hinweis §19 UStG.
- **`privat`:** `invoiceData.type === "privat"` → 0 %, Hinweis Privatperson.

ZUGFeRD/Factur-X wird für **RE** nur erzeugt, wenn `useZugferd` und `takumiVatStatus === "standard"` (kein XML-Einbetten bei 0 %-Sonderfällen in der aktuellen Logik).

---

## 4. Guthaben-Aufladung (Wallet Top-up)

### 4.1 Beleg: GBL (Guthabenbeleg)

- Funktion: `generateWalletTopupReceiptPdf` in `lib/pdf-invoice.ts`.
- Alias: `generateWalletTopupInvoicePdf` (deprecated) leitet auf dieselbe Implementierung mit `receiptNumber` um.
- Nummer: `getNextDocumentNumber("GBL")` — **nicht** mehr `RE`.
- Inhalt: **kein** MwSt.-Split; Gesamtbetrag = Einzahlungsbetrag; Hinweistext, dass **kein** §14-UStG-Rechnungsdokument vorliegt und MwSt. mit der **Leistungsabrechnung** folgt.
- `WalletTransaction.metadata` (nach erfolgreicher PDF-Erzeugung): bevorzugt **`receiptNumber`**, **`receiptPdfUrl`** (ältere Einträge können noch `invoiceNumber`/`invoicePdfUrl` heißen).

### 4.2 Aufrufstellen

- `lib/wallet-service.ts`: `creditWalletTopup` (Stripe-Webhook-Pfad), `creditWalletAdmin` (Admin-Gutschrift).

---

## 5. Storno nach Capture (Wallet / Rückerstattung)

`lib/wallet-service.ts`: bei erstattungsfähiger Transaktion mit vorhandener `invoiceNumber` und `creditNoteNumber` werden **SR** und **SG** erzeugt.

- `generateStornoInvoicePdf`: Empfänger Shugyo, **`takumiSenderName`** + **`takumiVatStatus`** (wie RE).
- `generateStornoCreditNotePdf`: Empfänger Takumi, **`takumiVatStatus`**.

---

## 6. Kopfzeile RE / SR: Takumi als Aussteller (Gutschriftverfahren)

`lib/pdf-invoice-branding.ts` — `drawHtmlTemplateInvoiceHeader`:

- Parameter **`senderOverride`**: `{ name: string, street?, city?, country? }`.
- Wenn gesetzt: **kleingedruckte Absenderzeile** (DIN-5008-Bereich) zeigt den **Takumi-Namen** (und optional weitere Zeilen, falls später befüllt).
- Darunter graue zweite Zeile (mehrzeilig mit `splitTextToSize` + Zeilenloop):  
  **„Ausgestellt durch diAiway (JM faircharge UG) gemäß § 14 Abs. 2 UStG (Gutschriftverfahren)“**  
  Schrift: `helvetica` normal, Größe `INV_DE_LAYOUT.disclaimerPt`, Umbruch über `addrW` — vermeidet jsPDF-Rendering-Artefakte (gesperrte Schrift).

Vorschau/Test: `app/api/admin/invoice-branding/preview/route.ts` und `test-email/route.ts` setzen für **`re_session`** und **`sr`** bewusst `takumiSenderName: "Expertin Muster"`, damit das Layout im Admin überprüfbar ist.

---

## 7. PDF-Rendering: Hinweistexte und Zeilenumbruch

jsPDF kann bei **`doc.text(string[] | mehrzeilig)`** in Kombination mit kleinen Schriftgrößen **falsch rendern** (optisch „Buchstaben mit Abstand“).

**Regel im Code:**

- Lange Hinweise: **`splitTextToSize`** mit korrekter Breite, dann **Schleife** `doc.text(einzelzeile, x, y + i * lineHeight)`.
- Text mit **`\n`**: zuerst **`split("\n")`**, pro Absatz wrappen, dann zeilenweise ausgeben (siehe `drawHtmlTemplateInvoiceTableAndTotals` → `vatNote`).

---

## 8. Admin: Rechnungs-PDF / Branding

**Pfad:** `/admin/invoice-branding` (`app/(app)/admin/invoice-branding/page.tsx`).

| Funktion | Beschreibung |
|----------|--------------|
| **Speichern** | `PATCH /api/admin/invoice-branding` — Logo-URL, Akzentfarbe, globale Texte, `documentTemplates` pro `INVOICE_DOC_KEYS`. |
| **Logo** | `POST /api/admin/invoice-branding/logo` → Vercel Blob. |
| **Vorschau** | `GET /api/admin/invoice-branding/preview?doc=…` — PDF inline; nutzt **gespeichertes** Branding aus der DB. |
| **Test-E-Mail** | `POST /api/admin/invoice-branding/test-email` — JSON `{ email, doc, zugferd? }`. |

**`doc`-Werte Test-E-Mail:** `re_session` \| `gbl` \| `gs_session`.  
**ZUGFeRD:** nur bei `re_session` und `zugferd: true`.

**Vorschau-Dateinamen** (Content-Disposition): u. a. `diaiway-vorschau-guthabenbeleg.pdf` für `gbl`.

---

## 9. Stripe-Webhooks (relevant für Wallet & Buchung)

Implementierung: `app/api/webhooks/stripe/route.ts` (Auszug — Details im Code):

- `checkout.session.completed` — u. a. Buchungszahlung, Wallet-Topup (`wallet_topup`), Gast-Call, Connect-Onboarding-Flows je nach Metadata.
- `payment_intent.payment_failed` — u. a. In-App-Notification + Push an Shugyo (`pushType: PAYMENT`).
- Weitere Events für Connect-Konten nach Bedarf (`account.updated`, …).

---

## 10. iOS / App Store (Kurzreferenz)

| Thema | Umsetzung (technisch) |
|-------|------------------------|
| **Guideline 3.1.1 (IAP)** | **Aufladung** des Guthabens in der **nativen iOS-App** nicht über externe Zahlung im App-UI — Nutzerhinweis, Website nutzen (siehe Checkout/Wallet-UI, `Capacitor.isNativePlatform()`). |
| **Guideline 3.1.3(d) (P2P / physische Dienste)** | Zahlung für **reale Person-zu-Person-Dienstleistung** extern möglich; **Bezahlung mit vorhandenem Guthaben** auf iOS kann zugelassen sein, wenn kein neuer „digitale Währung kaufen“-Flow in der App ausgelöst wird. |

Ausführlicher UI-/Store-Kontext: [IOS-APP-STORE-COMPLIANCE.md](./IOS-APP-STORE-COMPLIANCE.md), [STORE-COMPLIANCE-CHECKLIST.md](./STORE-COMPLIANCE-CHECKLIST.md).

---

## 11. Benachrichtigungen (Kurzüberblick)

- **In-App:** Prisma-Modell `Notification`; diverse Typen (z. B. `booking_request`, `booking_confirmed`, `session_completed`, `payment_failed`, `wallet_topup`).
- **Push:** `lib/push.ts` → Web Push + FCM; `lib/push-fcm.ts` — **`pushType`** (`BOOKING_REQUEST`, `BOOKING_UPDATE`, `MESSAGE`, `REMINDER`, `PAYMENT`, `GENERAL`) steuert Android-Channel und iOS-Category.
- **Waymail:** `lib/system-waymail.ts` — erzeugt **keine** doppelten Notifications mehr; aufrufende Stellen erzeugen gezielt DB/Push.

---

## 12. Wichtige Quellcode-Dateien (Referenz)

| Datei | Inhalt |
|-------|--------|
| `lib/billing.ts` | `DocType`, `getNextDocumentNumber`, `ensureCustomerNumber` |
| `lib/invoice-requirements.ts` | Rechnungsdaten-Validierung, `TakumiVatStatus`, `resolveTakumiVatStatus`, `vatNoteForStatus` |
| `lib/invoice-doc-templates.ts` | Defaults, Admin-Felder, Merge mit DB |
| `lib/pdf-invoice-branding.ts` | DIN-Layout, Header/Footer, Tabellen, Gutschriftverfahren-Hinweis |
| `lib/pdf-invoice.ts` | Alle `generate*Pdf`-Funktionen, ZUGFeRD-Einbettung |
| `app/actions/process-completion.ts` | Session-Finalisierung, PDFs, E-Mails, Notifications |
| `lib/wallet-service.ts` | Wallet, Topup-PDF, Storno-PDFs, Admin-Credit |
| `app/api/webhooks/stripe/route.ts` | Stripe-Events |
| `app/api/admin/invoice-branding/*` | Branding-API, Preview, Test-Mail |

---

## 13. Geplante / architektonische Erweiterungen (ohne Garantie)

Aus Konversationshistorie / Roadmap (nicht alle Teile müssen bereits produktiv sein):

- **Stripe Customer Balance** für Shugyo-Wallet statt reiner Plattform-Guthaben-Saldo — separates Schema/Flow.

---

*Letzte Aktualisierung: März 2026*
