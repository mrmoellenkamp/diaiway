"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import {
  Camera, Loader2, Tag, Box, Type, Shield, Palette, Smile, Globe,
  Upload, RefreshCw, Check, AlertCircle, ChevronRight, X, Zap, ImageIcon,
} from "lucide-react"
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from "@capacitor/camera"
import { Capacitor } from "@capacitor/core"
import {
  analyzeImage,
  type VisionFeature,
  type VisionAnalysisResult,
} from "@/app/actions/vision"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// ─── Feature-Definitionen ─────────────────────────────────────────────────────

const FEATURES: {
  id: VisionFeature
  label: string
  icon: React.ElementType
  desc: string
  activeClass: string
}[] = [
  { id: "labels",     label: "Labels",      icon: Tag,     desc: "Objekte, Szenen, Konzepte",   activeClass: "border-blue-300 bg-blue-50 text-blue-700" },
  { id: "objects",    label: "Objekte",     icon: Box,     desc: "Lokalisierung & Bounding-Box", activeClass: "border-violet-300 bg-violet-50 text-violet-700" },
  { id: "text",       label: "Text / OCR",  icon: Type,    desc: "Text im Bild lesen",           activeClass: "border-emerald-300 bg-emerald-50 text-emerald-700" },
  { id: "safeSearch", label: "Safe Search", icon: Shield,  desc: "Problematische Inhalte",       activeClass: "border-amber-300 bg-amber-50 text-amber-700" },
  { id: "colors",     label: "Farben",      icon: Palette, desc: "Dominante Farben",             activeClass: "border-pink-300 bg-pink-50 text-pink-700" },
  { id: "faces",      label: "Gesichter",   icon: Smile,   desc: "Gesichter & Emotionen",        activeClass: "border-orange-300 bg-orange-50 text-orange-700" },
  { id: "web",        label: "Web",         icon: Globe,   desc: "Web-Entitäten & Best-Guess",   activeClass: "border-teal-300 bg-teal-50 text-teal-700" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function confClass(v: number) {
  if (v >= 80) return "bg-green-100 text-green-800"
  if (v >= 50) return "bg-yellow-100 text-yellow-800"
  return "bg-slate-100 text-slate-500"
}

function safeClass(v: string) {
  if (["Sehr unwahrscheinlich", "Unwahrscheinlich"].includes(v)) return "text-green-700 font-medium"
  if (v === "Möglich") return "text-yellow-700 font-medium"
  return "text-red-700 font-semibold"
}

function ConfBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="h-1.5 w-20 shrink-0 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${value >= 80 ? "bg-green-500" : value >= 50 ? "bg-yellow-400" : "bg-slate-300"}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={`w-9 shrink-0 text-right text-xs font-bold rounded px-1 ${confClass(value)}`}>
        {value}%
      </span>
    </div>
  )
}

// ─── Ergebnis-Panels ──────────────────────────────────────────────────────────

function LabelsPanel({ labels }: { labels: NonNullable<VisionAnalysisResult["labels"]> }) {
  if (!labels.length) return <Empty text="Keine Labels erkannt" />
  return (
    <div className="space-y-1.5">
      {labels.map((l, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
          <span className="w-5 shrink-0 text-center text-[11px] text-slate-400 font-mono">{i + 1}</span>
          <span className="flex-1 text-sm font-medium text-slate-800">{l.description}</span>
          <ConfBar value={l.confidence} />
        </div>
      ))}
    </div>
  )
}

function ObjectsPanel({ objects }: { objects: NonNullable<VisionAnalysisResult["objects"]> }) {
  if (!objects.length) return <Empty text="Keine Objekte lokalisiert" />
  return (
    <div className="space-y-2">
      {objects.map((o, i) => (
        <div key={i} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <span className="text-sm font-semibold text-slate-800">{o.name}</span>
            <span className={`rounded px-2 py-0.5 text-xs font-bold ${confClass(o.confidence)}`}>{o.confidence}%</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {o.box.map((v, j) => (
              <span key={j} className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
                {["TL","TR","BR","BL"][j]}: {(v.x*100).toFixed(0)}%,{(v.y*100).toFixed(0)}%
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function TextPanel({ fullText, textBlocks }: { fullText?: string; textBlocks?: string[] }) {
  if (!fullText && !textBlocks?.length) return <Empty text="Kein Text erkannt" />
  return (
    <div className="space-y-4">
      {fullText && (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Volltext</p>
          <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 leading-relaxed font-sans max-h-48 overflow-auto">
            {fullText}
          </pre>
        </div>
      )}
      {textBlocks && textBlocks.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Wörter / Blöcke ({textBlocks.length})</p>
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-auto">
            {textBlocks.map((t, i) => (
              <span key={i} className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SafePanel({ ss }: { ss: NonNullable<VisionAnalysisResult["safeSearch"]> }) {
  const rows: { key: keyof typeof ss; label: string }[] = [
    { key: "adult", label: "Adult Content" },
    { key: "spoof", label: "Spoof / Fake" },
    { key: "medical", label: "Medizinisch" },
    { key: "violence", label: "Gewalt" },
    { key: "racy", label: "Anzüglich" },
  ]
  return (
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
      {rows.map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between bg-white px-4 py-3">
          <span className="text-sm text-slate-700">{label}</span>
          <span className={`text-sm ${safeClass(ss[key])}`}>{ss[key]}</span>
        </div>
      ))}
    </div>
  )
}

function ColorsPanel({ colors }: { colors: NonNullable<VisionAnalysisResult["colors"]> }) {
  if (!colors.length) return <Empty text="Keine Farben erkannt" />
  return (
    <div className="space-y-3">
      <div className="flex h-8 w-full overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        {colors.map((c, i) => (
          <div key={i} title={`${c.hex} · ${c.pixelFraction}%`} className="h-full" style={{ backgroundColor: c.hex, flex: c.pixelFraction || 1 }} />
        ))}
      </div>
      <div className="space-y-1.5">
        {colors.map((c, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5">
            <div className="size-5 shrink-0 rounded border border-slate-200" style={{ backgroundColor: c.hex }} />
            <span className="font-mono text-xs font-semibold text-slate-700 w-16">{c.hex.toUpperCase()}</span>
            <span className="text-xs text-slate-500">RGB({c.r}, {c.g}, {c.b})</span>
            <span className="ml-auto text-xs text-slate-400 shrink-0">{c.pixelFraction}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FacesPanel({ faces }: { faces: NonNullable<VisionAnalysisResult["faces"]> }) {
  if (!faces.length) return <Empty text="Keine Gesichter erkannt" />
  return (
    <div className="space-y-3">
      {faces.map((f, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold text-slate-800">Gesicht #{i + 1}</span>
            <span className={`rounded px-2 py-0.5 text-xs font-bold ${confClass(f.confidence)}`}>{f.confidence}% sicher</span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {[["Freude", f.joy],["Trauer", f.sorrow],["Wut", f.anger],["Überraschung", f.surprise],["Kopfbedeckung", f.headwear],["Unscharf", f.blurred]].map(([l,v]) => (
              <div key={l} className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{l}</span>
                <span className={`text-xs ${safeClass(v as string)}`}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function WebPanel({ webEntities, webBestGuess }: { webEntities?: NonNullable<VisionAnalysisResult["webEntities"]>; webBestGuess?: string[] }) {
  return (
    <div className="space-y-4">
      {webBestGuess && webBestGuess.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Google Best Guess</p>
          <div className="flex flex-wrap gap-2">
            {webBestGuess.map((g, i) => (
              <span key={i} className="flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm font-medium text-teal-800">
                <ChevronRight className="size-3" />{g}
              </span>
            ))}
          </div>
        </div>
      )}
      {webEntities && webEntities.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Web-Entitäten</p>
          <div className="space-y-1.5">
            {webEntities.map((e, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <span className="flex-1 text-sm text-slate-800">{e.description}</span>
                <ConfBar value={e.score} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-slate-400">{text}</p>
}

// ─── Step Badge ────────────────────────────────────────────────────────────────

function StepBadge({ n, done }: { n: number; done?: boolean }) {
  return (
    <div className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-green-500 text-white" : "bg-blue-600 text-white"}`}>
      {done ? <Check className="size-3.5" /> : n}
    </div>
  )
}

// ─── Bild-Kompression (client-side, canvas) ───────────────────────────────────

function compressImage(dataUrl: string, maxPx = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round((height / width) * maxPx); width = maxPx }
        else { width = Math.round((width / height) * maxPx); height = maxPx }
      }
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL("image/jpeg", quality))
    }
    img.src = dataUrl
  })
}

// ─── Hauptseite ────────────────────────────────────────────────────────────────

export default function VisionDashboardPage() {
  const [selected, setSelected] = useState<Set<VisionFeature>>(new Set(["labels", "objects", "text"]))
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VisionAnalysisResult | null>(null)
  const [activeTab, setActiveTab] = useState<VisionFeature>("labels")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const isNative = Capacitor.isNativePlatform()

  function toggleFeature(id: VisionFeature) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id) && next.size > 1) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const runAnalysis = useCallback(async (dataUrl: string) => {
    setLoading(true)
    setResult(null)
    try {
      const compressed = await compressImage(dataUrl)
      const res = await analyzeImage(compressed, [...selected] as VisionFeature[])
      setResult(res)
      const firstHit = [...selected].find(f => {
        if (f === "labels") return res.labels?.length
        if (f === "objects") return res.objects?.length
        if (f === "text") return res.fullText || res.textBlocks?.length
        if (f === "safeSearch") return res.safeSearch
        if (f === "colors") return res.colors?.length
        if (f === "faces") return res.faces?.length
        if (f === "web") return res.webEntities?.length || res.webBestGuess?.length
        return false
      })
      if (firstHit) setActiveTab(firstHit)
    } finally {
      setLoading(false)
    }
  }, [selected])

  useEffect(() => {
    if (result && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [result])

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setImageDataUrl(reader.result as string)
      setResult(null)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  async function handleCamera() {
    try {
      const photo = await CapacitorCamera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      })
      if (photo.dataUrl) {
        setImageDataUrl(photo.dataUrl)
        setResult(null)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setResult({ error: `Kamera-Fehler: ${msg}` })
    }
  }

  function clearImage() {
    setImageDataUrl(null)
    setResult(null)
  }

  function hasResult(f: VisionFeature): boolean {
    if (!result || result.error) return false
    if (f === "labels") return !!result.labels?.length
    if (f === "objects") return !!result.objects?.length
    if (f === "text") return !!(result.fullText || result.textBlocks?.length)
    if (f === "safeSearch") return !!result.safeSearch
    if (f === "colors") return !!result.colors?.length
    if (f === "faces") return !!result.faces?.length
    if (f === "web") return !!(result.webEntities?.length || result.webBestGuess?.length)
    return false
  }

  const hasImage = !!imageDataUrl
  const activeTabs = FEATURES.filter(f => selected.has(f.id))
  const hasAnyResult = result && !result.error && activeTabs.some(f => hasResult(f.id))

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <h1 className="text-base font-bold text-slate-900 sm:text-lg">Vision Dashboard</h1>
        <p className="text-xs text-slate-500 sm:text-sm">Google Cloud Vision · Bild → Features → Analysieren</p>
      </div>

      {/* Einspaltige Karten-Liste */}
      <div className="mx-auto max-w-xl space-y-4 p-4 sm:p-6">

        {/* ── Schritt 1: Bild auswählen ── */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3 pt-4 px-4 sm:px-5">
            <CardTitle className="flex items-center gap-2.5 text-sm font-semibold text-slate-700">
              <StepBadge n={1} done={hasImage} />
              Bild auswählen
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5 space-y-3">
            {!hasImage ? (
              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition-colors hover:border-blue-400 hover:bg-blue-50 active:bg-blue-100"
                >
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-100">
                    <ImageIcon className="size-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Bild auswählen</p>
                    <p className="mt-0.5 text-xs text-slate-400">JPG, PNG, WebP</p>
                  </div>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />

                {isNative && (
                  <button
                    type="button"
                    onClick={handleCamera}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                  >
                    <Camera className="size-4" />
                    Kamera öffnen
                  </button>
                )}
              </div>
            ) : (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div className="relative">
                  <img
                    src={imageDataUrl}
                    alt="Gewähltes Bild"
                    className="w-full rounded-xl border border-slate-200 object-contain bg-slate-100"
                    style={{ maxHeight: "140px" }}
                  />
                  <button
                    type="button"
                    onClick={clearImage}
                    title="Bild entfernen"
                    className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-white/90 shadow-md hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 active:bg-slate-100"
                  >
                    <Upload className="size-3" />
                    Anderes Bild wählen
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Schritt 2: Features wählen ── */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3 pt-4 px-4 sm:px-5">
            <CardTitle className="flex items-center gap-2.5 text-sm font-semibold text-slate-700">
              <StepBadge n={2} />
              Features wählen
              <span className="ml-auto text-xs font-normal text-slate-400">{selected.size} aktiv</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FEATURES.map(f => {
                const Icon = f.icon
                const active = selected.has(f.id)
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleFeature(f.id)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-all active:scale-95 ${
                      active ? f.activeClass + " ring-1 ring-inset ring-current/30" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    <span className="leading-none">{f.label}</span>
                    {active && <Check className="ml-auto size-3 shrink-0" />}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Schritt 3: Analyse starten ── */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3 pt-4 px-4 sm:px-5">
            <CardTitle className="flex items-center gap-2.5 text-sm font-semibold text-slate-700">
              <StepBadge n={3} done={!!hasAnyResult} />
              Analysieren
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5 space-y-2">
            <button
              type="button"
              onClick={() => imageDataUrl && runAnalysis(imageDataUrl)}
              disabled={!hasImage || loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-6 py-4 text-base font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Analysiert…
                </>
              ) : (
                <>
                  <Zap className="size-5" />
                  Jetzt analysieren ({selected.size})
                </>
              )}
            </button>

            {!hasImage && (
              <p className="text-center text-xs text-slate-400">
                Zuerst ein Bild in Schritt 1 auswählen.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Ergebnisse ── */}
        <div ref={resultsRef}>

          {/* Lade-Indikator */}
          {loading && (
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="flex flex-col items-center justify-center gap-3 px-4 py-10">
                <Loader2 className="size-9 animate-spin text-blue-600" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700">Analysiere…</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {[...selected].map(f => FEATURES.find(x => x.id === f)?.label).join(", ")}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fehler */}
          {result?.error && !loading && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{result.error}</p>
            </div>
          )}

          {/* Ergebnis-Tabs */}
          {result && !result.error && !loading && (
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4 sm:px-5">
                <CardTitle className="flex items-center justify-between text-sm font-semibold text-slate-700">
                  <span>Ergebnisse</span>
                  <span className="text-xs font-normal text-slate-400">
                    {activeTabs.filter(f => hasResult(f.id)).length}/{activeTabs.length} Features mit Daten
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
                <Tabs value={activeTab} onValueChange={v => setActiveTab(v as VisionFeature)}>
                  <TabsList className="mb-4 flex h-auto flex-wrap gap-1 bg-slate-100 p-1">
                    {activeTabs.map(f => {
                      const Icon = f.icon
                      return (
                        <TabsTrigger
                          key={f.id}
                          value={f.id}
                          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
                        >
                          <Icon className="size-3" />
                          {f.label}
                          {hasResult(f.id) && <span className="size-1.5 rounded-full bg-green-500" />}
                        </TabsTrigger>
                      )
                    })}
                  </TabsList>

                  {result.labels      !== undefined && <TabsContent value="labels"     className="mt-0"><LabelsPanel  labels={result.labels} /></TabsContent>}
                  {result.objects     !== undefined && <TabsContent value="objects"    className="mt-0"><ObjectsPanel objects={result.objects} /></TabsContent>}
                  {(result.fullText   !== undefined || result.textBlocks !== undefined) &&
                    <TabsContent value="text"       className="mt-0"><TextPanel   fullText={result.fullText} textBlocks={result.textBlocks} /></TabsContent>}
                  {result.safeSearch  !== undefined && <TabsContent value="safeSearch" className="mt-0"><SafePanel   ss={result.safeSearch} /></TabsContent>}
                  {result.colors      !== undefined && <TabsContent value="colors"     className="mt-0"><ColorsPanel colors={result.colors} /></TabsContent>}
                  {result.faces       !== undefined && <TabsContent value="faces"      className="mt-0"><FacesPanel  faces={result.faces} /></TabsContent>}
                  {(result.webEntities !== undefined || result.webBestGuess !== undefined) &&
                    <TabsContent value="web"        className="mt-0"><WebPanel    webEntities={result.webEntities} webBestGuess={result.webBestGuess} /></TabsContent>}
                </Tabs>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => imageDataUrl && runAnalysis(imageDataUrl)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 active:bg-slate-100"
                  >
                    <RefreshCw className="size-3" />
                    Erneut analysieren
                  </button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Abstand unten für mobile Safe Area */}
        <div className="h-6" />
      </div>
    </div>
  )
}
