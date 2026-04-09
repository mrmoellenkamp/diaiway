"use client"

import { useState } from "react"
import { CheckCircle2, Circle, ChevronDown, ChevronRight, Rocket, Apple, Smartphone, ShieldCheck, Camera, FileText, Wrench } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"

type CheckItem = {
  id: string
  label: string
  detail?: string
  link?: string
  done: boolean
}

type Section = {
  id: string
  title: string
  icon: React.ReactNode
  color: string
  items: CheckItem[]
}

const INITIAL_SECTIONS: Section[] = [
  {
    id: "screenshots",
    title: "Screenshots",
    icon: <Camera className="size-4" />,
    color: "text-violet-600",
    items: [
      { id: "sc1", label: "iOS 6,7\" Screenshots (1290×2796 px)", detail: "iPhone 15 Pro Max – mindestens 3, ideal 10 Screens", done: false },
      { id: "sc2", label: "iOS 5,5\" Screenshots (1242×2208 px)", detail: "iPhone 8 Plus – optional, aber empfohlen", done: false },
      { id: "sc3", label: "Android Smartphone-Screenshots (1080×1920)", detail: "Play Console „Telefon“, Hochformat 9:16, mindestens 2", done: false },
      { id: "sc3tab", label: "Android Tablet-Screenshots (Pflicht)", detail: "Play Console „Tablet“: min. 2, kurze Kante ≥1080 px; Ziel z. B. 1920×1200 Landscape – node scripts/frame-play-store-tablet-screenshots.mjs → assets/play-store-screenshots-tablet/", done: false },
      { id: "sc4", label: "Screenshots geframed / aufbereitet", detail: "Phone: frame-play-store-screenshots.mjs · Tablet: frame-play-store-tablet-screenshots.mjs (ideal: Aufnahmen vom Tablet-Layout)", done: false },
    ],
  },
  {
    id: "ios",
    title: "iOS – App Store Connect",
    icon: <Apple className="size-4" />,
    color: "text-blue-600",
    items: [
      { id: "ios1", label: "App-Eintrag in App Store Connect angelegt", detail: "Bundle ID: com.diaiway.app", done: false },
      { id: "ios2", label: "Store-Texte DE eingefügt", detail: "docs/APP-STORE-TEXTS-DE.md", done: false },
      { id: "ios3", label: "Store-Texte EN eingefügt", detail: "docs/APP-STORE-TEXTS-EN.md", done: false },
      { id: "ios4", label: "Store-Texte ES eingefügt", detail: "docs/APP-STORE-TEXTS-ES.md", done: false },
      { id: "ios5", label: "Screenshots hochgeladen", done: false },
      { id: "ios6", label: "App-Icon 1024×1024 hochgeladen", detail: "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", done: false },
      { id: "ios7", label: "Age Rating ausgefüllt (17+, Unrestricted Web Access)", done: false },
      { id: "ios8", label: "Privacy Policy URL hinterlegt", detail: "https://diaiway.com/legal/datenschutz", done: false },
      { id: "ios9", label: "Account Deletion URL hinterlegt (Apple Pflicht)", detail: "https://diaiway.com/profile/settings", done: false },
      { id: "ios10", label: "Support URL hinterlegt", detail: "https://diaiway.com/legal/kontakt", done: false },
      { id: "ios11", label: "Signing-Zertifikat + Provisioning Profile aktiv", done: false },
      { id: "ios12", label: "Binary per Xcode Archive hochgeladen", detail: "Product → Archive → Distribute → App Store Connect", done: false },
      { id: "ios13", label: "TestFlight-Testlauf abgeschlossen", done: false },
    ],
  },
  {
    id: "android",
    title: "Android – Google Play Console",
    icon: <Smartphone className="size-4" />,
    color: "text-green-600",
    items: [
      { id: "and1", label: "App in Play Console angelegt", done: false },
      { id: "and2", label: "Store-Texte DE eingefügt", detail: "docs/APP-STORE-TEXTS-DE.md", done: false },
      { id: "and3", label: "Store-Texte EN eingefügt", detail: "docs/APP-STORE-TEXTS-EN.md", done: false },
      { id: "and4", label: "Store-Texte ES eingefügt", detail: "docs/APP-STORE-TEXTS-ES.md", done: false },
      { id: "and5", label: "Smartphone-Screenshots hochgeladen (Telefon)", detail: "Mindestens 2, korrekte Sektion in der Play Console", done: false },
      { id: "and5tab", label: "Tablet-Screenshots hochgeladen (Tablet)", detail: "Pflicht bei Large-Screen-/Tablet-Support – eigene Sektion, nicht mit Phone verwechseln", done: false },
      { id: "and6", label: "App-Icon 512×512 hochgeladen", done: false },
      { id: "and7", label: "Feature Graphic 1024×500 hochgeladen", done: false },
      { id: "and8", label: "Data Safety Fragebogen ausgefüllt", detail: "docs/GOOGLE-PLAY-COMPLIANCE.md", done: false },
      { id: "and9", label: "IARC Inhaltsbewertung abgeschlossen (16+)", done: false },
      { id: "and10", label: "Privacy Policy URL hinterlegt", detail: "https://diaiway.com/legal/datenschutz", done: false },
      { id: "and11", label: "Keystore für Release-Build erstellt & gesichert", detail: "android/keystore.properties – NIEMALS in Git!", done: false },
      { id: "and12", label: "Signed AAB via Android Studio generiert", detail: "Build → Generate Signed Bundle", done: false },
      { id: "and13", label: "google-services.json für FCM vorhanden", detail: "android/app/google-services.json", done: false },
    ],
  },
  {
    id: "compliance",
    title: "DSGVO & Compliance",
    icon: <ShieldCheck className="size-4" />,
    color: "text-orange-600",
    items: [
      { id: "dsgvo1", label: "Konto-Löschung getestet (Anonymisierung)", detail: "Test-User anlegen, löschen, Admin prüfen → Badge 'Anonymisiert'", done: true },
      { id: "dsgvo2", label: "Datenexport (Art. 20 DSGVO) getestet", detail: "GET /api/user/export", done: true },
      { id: "dsgvo3", label: "Altersverifikation im Register-Flow aktiv (18+)", done: true },
      { id: "dsgvo4", label: "Marketing-Abmeldung funktioniert", detail: "DELETE /api/user/marketing", done: true },
      { id: "dsgvo5", label: "Dokument-Archivierung Cron aktiv", detail: "/api/cron/archive-documents täglich 01:00 UTC", done: true },
      { id: "dsgvo6", label: "Snapshot-Consent-Prüfung aktiv", detail: "/api/safety/snapshot → 403 ohne Consent", done: true },
      { id: "dsgvo7", label: "Datenschutzerklärung aktuell", detail: "app/legal/datenschutz/page.tsx", done: true },
      { id: "dsgvo8", label: "Deep Links getestet", detail: "https://diaiway.com/messages?waymail=...", done: false },
    ],
  },
  {
    id: "technical",
    title: "Technische Checks",
    icon: <Wrench className="size-4" />,
    color: "text-slate-600",
    items: [
      { id: "tech1", label: "npm run mobile:sync ausgeführt", detail: "Synct out/ zu iOS + Android", done: false },
      { id: "tech2", label: "Push Notifications auf echtem iOS-Gerät getestet", done: false },
      { id: "tech3", label: "Push Notifications auf echtem Android-Gerät getestet", done: false },
      { id: "tech4", label: "Video-Call End-to-End auf echtem Gerät getestet", done: false },
      { id: "tech5", label: "Stripe Zahlung auf echtem Gerät getestet", done: false },
      { id: "tech6", label: "Wallet-Aufladung zeigt Web-Verweis auf iOS (kein Native IAP)", done: false },
      { id: "tech7", label: "App-Version auf 1.0.0 gesetzt (iOS + Android)", detail: "MARKETING_VERSION / versionName", done: false },
      { id: "tech8", label: "CFBundleDisplayName / app_name geprüft", detail: "Sollte 'diaiway' oder 'diAIway' sein", done: false },
      { id: "tech9", label: "Vercel Cron Jobs alle 200 OK", done: true },
      { id: "tech10", label: "Upstash Redis Rate-Limiting aktiv", done: true },
    ],
  },
  {
    id: "docs",
    title: "Dokumente & Texte",
    icon: <FileText className="size-4" />,
    color: "text-teal-600",
    items: [
      { id: "doc1", label: "Store-Texte DE gespeichert", detail: "docs/APP-STORE-TEXTS-DE.md ✅", done: true },
      { id: "doc2", label: "Store-Texte EN gespeichert", detail: "docs/APP-STORE-TEXTS-EN.md ✅", done: true },
      { id: "doc3", label: "Store-Texte ES gespeichert", detail: "docs/APP-STORE-TEXTS-ES.md ✅", done: true },
      { id: "doc4", label: "App-Icons iOS generiert", done: true },
      { id: "doc5", label: "App-Icons Android generiert", done: true },
      { id: "doc6", label: "Splash Screens generiert", done: true },
      { id: "doc7", label: "AGB + Impressum + Datenschutz live auf Website", done: false },
    ],
  },
]

export default function LaunchChecklist() {
  const [sections, setSections] = useState<Section[]>(INITIAL_SECTIONS)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    screenshots: true,
    ios: true,
    android: true,
    compliance: false,
    technical: true,
    docs: false,
  })

  const totalItems = sections.flatMap((s) => s.items).length
  const doneItems = sections.flatMap((s) => s.items).filter((i) => i.done).length
  const progress = Math.round((doneItems / totalItems) * 100)

  function toggle(sectionId: string, itemId: string) {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, items: s.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) }
          : s
      )
    )
  }

  function toggleSection(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const statusBadge = progress === 100
    ? <Badge className="bg-green-500 text-white">Launch-ready 🚀</Badge>
    : progress >= 70
    ? <Badge className="bg-yellow-500 text-white">Fast bereit</Badge>
    : <Badge variant="outline">In Vorbereitung</Badge>

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="size-5 text-primary" />
            <h1 className="text-lg font-semibold">Launch-Checkliste</h1>
          </div>
          {statusBadge}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{doneItems} von {totalItems} Punkten erledigt</span>
            <span className="font-medium text-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => setExpanded(Object.fromEntries(sections.map((s) => [s.id, true])))}
        >
          Alle aufklappen
        </Button>
      </div>

      {/* Sections */}
      {sections.map((section) => {
        const sectionDone = section.items.filter((i) => i.done).length
        const isOpen = expanded[section.id]
        return (
          <div key={section.id} className="rounded-xl border bg-card overflow-hidden">
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className={section.color}>{section.icon}</span>
                <span className="font-medium text-sm">{section.title}</span>
                <span className="text-xs text-muted-foreground">
                  {sectionDone}/{section.items.length}
                </span>
                {sectionDone === section.items.length && (
                  <Badge className="bg-green-100 text-green-700 text-xs px-1.5 py-0">✓</Badge>
                )}
              </div>
              {isOpen ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
            </button>

            {isOpen && (
              <div className="divide-y">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggle(section.id, item.id)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                  >
                    {item.done
                      ? <CheckCircle2 className="size-4 mt-0.5 text-green-500 shrink-0" />
                      : <Circle className="size-4 mt-0.5 text-muted-foreground shrink-0" />}
                    <div className="space-y-0.5 min-w-0">
                      <p className={`text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>
                        {item.label}
                      </p>
                      {item.detail && (
                        <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
