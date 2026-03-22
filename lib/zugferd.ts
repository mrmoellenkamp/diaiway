/**
 * ZUGFeRD / Factur-X: Einbettung maschinenlesbarer Rechnungsdaten (E-Rechnung B2B 2025).
 * Erzeugt factur-x.xml im CII-Format und bettet sie in das PDF ein.
 */

import { PDFDocument } from "pdf-lib"

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/**
 * Erzeugt ein minimales Factur-X/CII XML (EN 16931-kompatibel).
 */
export function buildFacturXXml(opts: {
  invoiceNumber: string
  issueDate: string // YYYYMMDD
  sellerName: string
  sellerStreet: string
  sellerZip: string
  sellerCity: string
  sellerCountry: string
  sellerVatId?: string
  buyerName: string
  buyerEmail: string
  /** z. B. Kundennummer (KD-…) im BuyerTradeParty */
  buyerReference?: string
  lineItemDesc: string
  lineQuantity: number
  lineUnitPriceCents: number
  lineAmountCents: number
  totalAmountCents: number
  currency: string
  vatPercent: number
}): string {
  const {
    invoiceNumber,
    issueDate,
    sellerName,
    sellerStreet,
    sellerZip,
    sellerCity,
    sellerCountry,
    sellerVatId,
    buyerName,
    buyerEmail: _buyerEmail,
    buyerReference,
    lineItemDesc,
    lineQuantity,
    lineUnitPriceCents: _lineUnitPriceCents,
    lineAmountCents,
    totalAmountCents,
    currency,
    vatPercent,
  } = opts

  const total = (totalAmountCents / 100).toFixed(2)
  const lineAmount = (lineAmountCents / 100).toFixed(2)
  const vatBaseCents = totalAmountCents / (1 + vatPercent / 100)
  const vatBase = (vatBaseCents / 100).toFixed(2)
  const vatAmount = ((totalAmountCents - vatBaseCents) / 100).toFixed(2)

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CrossIndustryInvoice xmlns="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100 urn:cen.eu:en16931:2017">
  <ExchangedDocumentContext>
    <GuidelineSpecifiedDocumentContextParameter>
      <ID>urn:cen.eu:en16931:2017</ID>
    </GuidelineSpecifiedDocumentContextParameter>
  </ExchangedDocumentContext>
  <ExchangedDocument>
    <ID>${escapeXml(invoiceNumber)}</ID>
    <Name>Rechnung</Name>
    <TypeCode>380</TypeCode>
    <IssueDateTime>
      <DateTimeString format="102">${issueDate}</DateTimeString>
    </IssueDateTime>
  </ExchangedDocument>
  <SupplyChainTradeTransaction>
    <IncludedSupplyChainTradeLineItem>
      <AssociatedDocumentLineDocument>
        <LineID>1</LineID>
      </AssociatedDocumentLineDocument>
      <SpecifiedTradeProduct>
        <Name>${escapeXml(lineItemDesc)}</Name>
      </SpecifiedTradeProduct>
      <SpecifiedLineTradeDelivery>
        <BilledQuantity unitCode="C62">${lineQuantity}</BilledQuantity>
      </SpecifiedLineTradeDelivery>
      <SpecifiedLineTradeSettlement>
        <ApplicableTradeTax>
          <CategoryCode>S</CategoryCode>
          <RateApplicablePercent>${vatPercent}</RateApplicablePercent>
        </ApplicableTradeTax>
        <SpecifiedLineTradeSettlementLineMonetarySummation>
          <LineTotalAmount>${lineAmount}</LineTotalAmount>
        </SpecifiedLineTradeSettlementLineMonetarySummation>
      </SpecifiedLineTradeSettlement>
    </IncludedSupplyChainTradeLineItem>
    <ApplicableHeaderTradeAgreement>
      <SellerTradeParty>
        <Name>${escapeXml(sellerName)}</Name>
        <PostalTradeAddress>
          <PostcodeCode>${escapeXml(sellerZip)}</PostcodeCode>
          <LineOne>${escapeXml(sellerStreet)}</LineOne>
          <CityName>${escapeXml(sellerCity)}</CityName>
          <CountryID>${escapeXml(sellerCountry.slice(0, 2).toUpperCase())}</CountryID>
        </PostalTradeAddress>
        ${sellerVatId ? `<SpecifiedTaxRegistration><ID schemeID="VA">${escapeXml(sellerVatId)}</ID></SpecifiedTaxRegistration>` : ""}
      </SellerTradeParty>
      <BuyerTradeParty>
        <Name>${escapeXml(buyerName)}</Name>
        ${
          buyerReference
            ? `<SpecifiedLegalOrganization><ID>${escapeXml(buyerReference)}</ID></SpecifiedLegalOrganization>`
            : ""
        }
      </BuyerTradeParty>
    </ApplicableHeaderTradeAgreement>
    <ApplicableHeaderTradeSettlement>
      <InvoiceCurrencyCode>${currency}</InvoiceCurrencyCode>
      <ApplicableTradeTax>
        <CategoryCode>S</CategoryCode>
        <RateApplicablePercent>${vatPercent}</RateApplicablePercent>
        <CalculatedAmount>${vatAmount}</CalculatedAmount>
        <BasisAmount>${vatBase}</BasisAmount>
      </ApplicableTradeTax>
      <SpecifiedTradeSettlementHeaderMonetarySummation>
        <TaxBasisTotalAmount>${vatBase}</TaxBasisTotalAmount>
        <TaxTotalAmount currencyID="${currency}">${vatAmount}</TaxTotalAmount>
        <GrandTotalAmount>${total}</GrandTotalAmount>
      </SpecifiedTradeSettlementHeaderMonetarySummation>
    </ApplicableHeaderTradeSettlement>
  </SupplyChainTradeTransaction>
</CrossIndustryInvoice>`
  return xml
}

/**
 * Bettet factur-x.xml in ein bestehendes PDF ein (ZUGFeRD-hybrid).
 * Das PDF wird als PDF/A-3-kompatibel erweitert (XML-Anhang).
 */
export async function embedFacturXInPdf(pdfBuffer: ArrayBuffer | Buffer, facturXXml: string): Promise<ArrayBuffer> {
  const doc = await PDFDocument.load(pdfBuffer instanceof Buffer ? pdfBuffer : new Uint8Array(pdfBuffer), {
    ignoreEncryption: true,
  })
  const xmlBytes = new TextEncoder().encode(facturXXml)
  doc.attach(xmlBytes, "factur-x.xml", {
    mimeType: "application/xml",
    description: "Factur-X invoice data",
    // @ts-expect-error - pdf-lib AFRelationship type may not include "Alternative"
    afRelationship: "Alternative",
  })
  const outBytes = await doc.save()
  return outBytes.buffer as ArrayBuffer
}
