"use client"

import { useState, useRef, useCallback } from "react"
import NextImage from "next/image"
import {
  Camera, Loader2, Tag, Box, Type, Shield, Palette, Smile, Globe,
  Upload, RefreshCw, Check, AlertCircle, X, Zap, ImageIcon, ChevronDown, ChevronUp,
} from "lucide-react"
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from "@capacitor/camera"
import { Capacitor } from "@capacitor/core"
import type { VisionFeature, VisionAnalysisResult } from "@/app/actions/vision"

// ─── Feature-Definitionen ─────────────────────────────────────────────────────

const FEATURES: {
  id: VisionFeature
  label: string
  icon: React.ElementType
  color: string
  activeClass: string
}[] = [
  { id: "labels",     label: "Labels",      icon: Tag,     color: "blue",    activeClass: "border-blue-300 bg-blue-50 text-blue-700" },
  { id: "objects",    label: "Objekte",     icon: Box,     color: "violet",  activeClass: "border-violet-300 bg-violet-50 text-violet-700" },
  { id: "text",       label: "Text / OCR",  icon: Type,    color: "emerald", activeClass: "border-emerald-300 bg-emerald-50 text-emerald-700" },
  { id: "safeSearch", label: "Safe Search", icon: Shield,  color: "amber",   activeClass: "border-amber-300 bg-amber-50 text-amber-700" },
  { id: "colors",     label: "Farben",      icon: Palette, color: "pink",    activeClass: "border-pink-300 bg-pink-50 text-pink-700" },
  { id: "faces",      label: "Gesichter",   icon: Smile,   color: "orange",  activeClass: "border-orange-300 bg-orange-50 text-orange-700" },
  { id: "web",        label: "Web",         icon: Globe,   color: "teal",    activeClass: "border-teal-300 bg-teal-50 text-teal-700" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function confClass(v: number) {
  if (v >= 80) return "bg-green-100 text-green-700 font-semibold"
  if (v >= 50) return "bg-yellow-100 text-yellow-700 font-semibold"
  return "bg-slate-100 text-slate-500"
}

function safeClass(v: string) {
  if (["Sehr unwahrscheinlich", "Unwahrscheinlich"].includes(v)) return "text-green-700 font-medium"
  if (v === "Möglich") return "text-yellow-700 font-medium"
  return "text-red-700 font-semibold"
}

function ConfBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${value >= 80 ? "bg-green-500" : value >= 50 ? "bg-yellow-400" : "bg-slate-300"}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={`min-w-[2.5rem] text-right text-xs rounded px-1 py-0.5 ${confClass(value)}`}>
        {value}%
      </span>
    </div>
  )
}

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

// ─── Collapsible Result Section ───────────────────────────────────────────────

function ResultSection({ title, icon: Icon, count, colorClass, children }: {
  title: string
  icon: React.ElementType
  count?: number
  colorClass: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${colorClass}`}>
          <Icon className="size-3.5" />
        </div>
        <span className="flex-1 text-sm font-semibold text-slate-800">{title}</span>
        {count !== undefined && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {count}
          </span>
        )}
        {open ? <ChevronUp className="size-4 text-slate-400 shrink-0" /> : <ChevronDown className="size-4 text-slate-400 shrink-0" />}
      </button>
      {open && <div className="border-t border-slate-100 px-4 pb-4 pt-3">{children}</div>}
    </div>
  )
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export function VisionScannerTab() {
  const [selected, setSelected] = useState<Set<VisionFeature>>(new Set(["labels", "objects", "text"]))
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VisionAnalysisResult | null>(null)
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
      const res = await fetch("/api/admin/vision-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: compressed, features: [...selected] }),
      })
      const data: VisionAnalysisResult = await res.json()
      setResult(data)
    } catch (e) {
      setResult({ error: `Netzwerkfehler: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setLoading(false)
    }
  }, [selected])

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { setImageDataUrl(reader.result as string); setResult(null) }
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
      if (photo.dataUrl) { setImageDataUrl(photo.dataUrl); setResult(null) }
    } catch (e) {
      setResult({ error: `Kamera-Fehler: ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  const hasImage = !!imageDataUrl

  return (
    <div className="space-y-4">
      {/* ── Row 1: Bild + Features nebeneinander auf Desktop ── */}
      <div className="grid gap-4 sm:grid-cols-2">

        {/* Bild auswählen */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">1 · Bild auswählen</p>
          {!hasImage ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-8 transition-colors hover:border-blue-400 hover:bg-blue-50 active:bg-blue-100"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100">
                  <ImageIcon className="size-5 text-blue-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-600">Klicken zum Auswählen</p>
                  <p className="text-xs text-slate-400">JPG, PNG, WebP</p>
                </div>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
              {isNative && (
                <button
                  type="button"
                  onClick={handleCamera}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Camera className="size-4" />
                  Kamera öffnen
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <NextImage
                  src={imageDataUrl}
                  alt="Ausgewähltes Bild"
                  width={800}
                  height={160}
                  unoptimized
                  className="max-h-[160px] w-full rounded-lg border border-slate-200 bg-slate-100 object-contain"
                />
                <button
                  type="button"
                  onClick={() => { setImageDataUrl(null); setResult(null) }}
                  className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-[rgba(255,255,255,0.9)] shadow hover:bg-red-50 hover:text-red-600"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
              >
                <Upload className="size-3" />
                Anderes Bild
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
            </div>
          )}
        </div>

        {/* Features auswählen */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
            <span>2 · Features wählen</span>
            <span className="normal-case font-normal">{selected.size} aktiv</span>
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {FEATURES.map(f => {
              const Icon = f.icon
              const active = selected.has(f.id)
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggleFeature(f.id)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all active:scale-95 ${
                    active ? f.activeClass : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span className="flex-1 text-left leading-tight">{f.label}</span>
                  {active && <Check className="size-3 shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Analyse-Button + Ergebnisse direkt darunter ── */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => imageDataUrl && runAnalysis(imageDataUrl)}
          disabled={!hasImage || loading}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-blue-600 py-4 text-base font-bold text-white shadow transition-all hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <><Loader2 className="size-5 animate-spin" />Analysiert…</>
          ) : (
            <><Zap className="size-5" />Jetzt analysieren · {selected.size} Feature{selected.size !== 1 ? "s" : ""}</>
          )}
        </button>
        {!hasImage && !result && (
          <p className="text-center text-xs text-slate-400">Zuerst ein Bild auswählen.</p>
        )}

      {/* ── Ergebnisse direkt unter dem Button ── */}
      <div ref={resultsRef}>

        {/* Lade-Zustand */}
        {loading && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 py-10">
            <Loader2 className="size-8 animate-spin text-blue-600" />
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">Google Vision analysiert…</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {[...selected].map(f => FEATURES.find(x => x.id === f)?.label).join(" · ")}
              </p>
            </div>
          </div>
        )}

        {/* Fehler */}
        {result?.error && !loading && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-semibold text-red-700">Analyse fehlgeschlagen</p>
              <p className="mt-0.5 text-xs text-red-600">{result.error}</p>
            </div>
          </div>
        )}

        {/* Ergebnis-Box */}
        {result && !result.error && !loading && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Analyseergebnisse</h3>
              <button
                type="button"
                onClick={() => imageDataUrl && runAnalysis(imageDataUrl)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
              >
                <RefreshCw className="size-3" />
                Erneut
              </button>
            </div>

            {/* Labels */}
            {result.labels && result.labels.length > 0 && (
              <ResultSection title="Labels" icon={Tag} count={result.labels.length} colorClass="bg-blue-100 text-blue-600">
                <div className="space-y-1.5">
                  {result.labels.map((l, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
                      <span className="w-4 shrink-0 text-center text-[10px] font-mono text-slate-400">{i + 1}</span>
                      <span className="flex-1 text-sm text-slate-800">{l.description}</span>
                      <ConfBar value={l.confidence} />
                    </div>
                  ))}
                </div>
              </ResultSection>
            )}

            {/* Objekte */}
            {result.objects && result.objects.length > 0 && (
              <ResultSection title="Objekte" icon={Box} count={result.objects.length} colorClass="bg-violet-100 text-violet-600">
                <div className="space-y-2">
                  {result.objects.map((o, i) => (
                    <div key={i} className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-800">{o.name}</span>
                        <span className={`rounded px-1.5 py-0.5 text-xs ${confClass(o.confidence)}`}>{o.confidence}%</span>
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
              </ResultSection>
            )}

            {/* Text / OCR */}
            {(result.fullText || (result.textBlocks && result.textBlocks.length > 0)) && (
              <ResultSection title="Text / OCR" icon={Type} colorClass="bg-emerald-100 text-emerald-600">
                <div className="space-y-3">
                  {result.fullText && (
                    <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 leading-relaxed font-sans">
                      {result.fullText}
                    </pre>
                  )}
                  {result.textBlocks && result.textBlocks.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {result.textBlocks.map((t, i) => (
                        <span key={i} className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </ResultSection>
            )}

            {/* Safe Search */}
            {result.safeSearch && (
              <ResultSection title="Safe Search" icon={Shield} colorClass="bg-amber-100 text-amber-600">
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
                  {(["adult","spoof","medical","violence","racy"] as const).map(key => (
                    <div key={key} className="flex items-center justify-between bg-white px-4 py-2.5">
                      <span className="text-sm text-slate-600 capitalize">{key}</span>
                      <span className={`text-sm ${safeClass(result.safeSearch![key])}`}>{result.safeSearch![key]}</span>
                    </div>
                  ))}
                </div>
              </ResultSection>
            )}

            {/* Farben */}
            {result.colors && result.colors.length > 0 && (
              <ResultSection title="Dominante Farben" icon={Palette} count={result.colors.length} colorClass="bg-pink-100 text-pink-600">
                <div className="space-y-3">
                  <div className="flex h-8 w-full overflow-hidden rounded-lg border border-slate-200">
                    {result.colors.map((c, i) => (
                      <div key={i} title={c.hex} className="h-full" style={{ backgroundColor: c.hex, flex: c.pixelFraction || 1 }} />
                    ))}
                  </div>
                  <div className="space-y-1">
                    {result.colors.map((c, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-1.5">
                        <div className="size-5 shrink-0 rounded border border-slate-200" style={{ backgroundColor: c.hex }} />
                        <span className="font-mono text-xs font-semibold text-slate-700 w-16">{c.hex.toUpperCase()}</span>
                        <span className="text-xs text-slate-500">RGB({c.r},{c.g},{c.b})</span>
                        <span className="ml-auto text-xs text-slate-400">{c.pixelFraction}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </ResultSection>
            )}

            {/* Gesichter */}
            {result.faces && result.faces.length > 0 && (
              <ResultSection title="Gesichter" icon={Smile} count={result.faces.length} colorClass="bg-orange-100 text-orange-600">
                <div className="space-y-3">
                  {result.faces.map((f, i) => (
                    <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-700">Gesicht #{i + 1}</span>
                        <span className={`rounded px-2 py-0.5 text-xs ${confClass(f.confidence)}`}>{f.confidence}% sicher</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[["Freude",f.joy],["Trauer",f.sorrow],["Wut",f.anger],["Überraschung",f.surprise],["Kopfbedeckung",f.headwear],["Unscharf",f.blurred]].map(([l,v]) => (
                          <div key={l} className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">{l}</span>
                            <span className={safeClass(v as string)}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ResultSection>
            )}

            {/* Web Entitäten */}
            {(result.webBestGuess?.length || result.webEntities?.length) && (
              <ResultSection title="Web / Best Guess" icon={Globe} colorClass="bg-teal-100 text-teal-600">
                <div className="space-y-3">
                  {result.webBestGuess && result.webBestGuess.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Google Best Guess</p>
                      <div className="flex flex-wrap gap-2">
                        {result.webBestGuess.map((g, i) => (
                          <span key={i} className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm font-medium text-teal-800">{g}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.webEntities && result.webEntities.length > 0 && (
                    <div className="space-y-1.5">
                      {result.webEntities.map((e, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
                          <span className="flex-1 text-sm text-slate-800">{e.description}</span>
                          <ConfBar value={e.score} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ResultSection>
            )}
          </div>
        )}
      </div>
      </div>{/* Ende Analyse-Button + Ergebnisse */}
    </div>
  )
}
