"use client"

import { useState } from "react"
import Image from "next/image"
import { useNativeBridge } from "@/hooks/use-native-bridge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Camera, Fingerprint, Bell, Loader2 } from "lucide-react"

/**
 * Test-Komponente für native Features (Biometrie, Kamera, Push).
 * Nur sichtbar in der Capacitor-App, nicht im Browser.
 */
export function NativeTestCenter() {
  const { isNative, runBiometric, runTakePhoto, runRegisterPush } = useNativeBridge()
  const [loading, setLoading] = useState<"biometric" | "camera" | "push" | null>(null)
  const [lastPhoto, setLastPhoto] = useState<string | null>(null)
  const [pushToken, setPushToken] = useState<string | null>(null)

  if (!isNative) return null

  async function handleBiometric() {
    setLoading("biometric")
    try {
      const r = await runBiometric()
      if (r.ok && r.success) toast.success("Biometrie erfolgreich!")
      else if (r.ok && !r.success) toast.info("Abgebrochen.")
      else toast.error(r.error)
    } finally {
      setLoading(null)
    }
  }

  async function handleCamera() {
    setLoading("camera")
    try {
      const r = await runTakePhoto()
      if (r.ok && r.dataUrl) {
        setLastPhoto(r.dataUrl)
        toast.success("Foto aufgenommen!")
      } else if (r.ok && !r.dataUrl) toast.info("Abgebrochen.")
      else toast.error(r.error)
    } finally {
      setLoading(null)
    }
  }

  async function handlePush() {
    setLoading("push")
    try {
      const r = await runRegisterPush()
      if (r.ok) {
        if (r.token) {
          setPushToken(r.token)
          console.log("[NativeTestCenter] Push-Token:", r.token)
          toast.success("Push-Token in Konsole ausgegeben.")
        } else {
          toast.info("Kein Token (Simulator? Push evtl. nicht verfügbar)")
        }
      } else toast.error(r.error ?? "Push-Registrierung fehlgeschlagen.")
    } finally {
      setLoading(null)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Native Features testen</CardTitle>
        <p className="text-xs text-muted-foreground">
          Nur in der App sichtbar. Prüfe Biometrie, Kamera und Push.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={handleBiometric}
          disabled={!!loading}
        >
          {loading === "biometric" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Fingerprint className="size-4" />
          )}
          Face ID / Fingerprint
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={handleCamera}
          disabled={!!loading}
        >
          {loading === "camera" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Camera className="size-4" />
          )}
          Foto aufnehmen
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={handlePush}
          disabled={!!loading}
        >
          {loading === "push" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Bell className="size-4" />
          )}
          Push-Token holen
        </Button>
        {pushToken && (
          <p className="text-xs text-muted-foreground break-all">
            Token (auch in Konsole): {pushToken.slice(0, 40)}…
          </p>
        )}
        {lastPhoto && (
          <Image
            src={lastPhoto}
            alt="Letztes Foto"
            width={320}
            height={128}
            unoptimized
            className="mt-2 max-h-32 w-auto rounded-lg object-cover"
          />
        )}
      </CardContent>
    </Card>
  )
}
