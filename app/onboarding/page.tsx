"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useApp } from "@/lib/app-context"
import { useI18n } from "@/lib/i18n"
import { useCategories } from "@/lib/categories-i18n"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { ArrowRight, ArrowLeft, Camera, Check } from "lucide-react"

export default function OnboardingPage() {
  const router = useRouter()
  const { role } = useApp()
  const { t } = useI18n()
  const categories = useCategories()
  const [step, setStep] = useState(0)
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [bio, setBio] = useState("")

  const isTakumi = role === "takumi"
  const totalSteps = isTakumi ? 4 : 3

  const toggleCat = (slug: string) => {
    setSelectedCats((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    )
  }

  const next = () => {
    if (step < totalSteps - 1) setStep(step + 1)
    else {
      toast.success(t("onboarding.profileCreated"))
      router.push("/home")
    }
  }

  const back = () => {
    if (step > 0) setStep(step - 1)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-safe">
      {/* Progress */}
      <div className="sticky top-0 z-10 bg-background px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={back} disabled={step === 0} className="text-muted-foreground disabled:opacity-0">
            <ArrowLeft className="size-5" />
          </button>
          <span className="text-xs text-muted-foreground">
            {step + 1} / {totalSteps}
          </span>
          <button onClick={() => router.push("/home")} className="text-xs text-muted-foreground hover:text-foreground">
            {t("onboarding.skip")}
          </button>
        </div>
        <div className="h-1 w-full rounded-full bg-muted">
          <div
            className="h-1 rounded-full bg-primary transition-all duration-300"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col px-6 pb-8">
        {/* Step 0: Avatar */}
        {step === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <p className="font-jp text-4xl text-[rgba(6,78,59,0.3)]">
                {isTakumi ? "匠" : "修行"}
              </p>
              <h1 className="text-2xl font-bold text-foreground">
                {isTakumi ? t("onboarding.becomeTakumi") : t("onboarding.welcomeShugyo")}
              </h1>
              <p className="text-sm text-muted-foreground text-center">
                {isTakumi ? t("onboarding.shareKnowledge") : t("onboarding.uploadAvatar")}
              </p>
            </div>
            <button
              type="button"
              className="flex size-28 items-center justify-center rounded-full border-2 border-dashed border-border bg-[rgba(245,245,244,0.5)] transition-colors hover:border-[rgba(6,78,59,0.3)] hover:bg-[rgba(6,78,59,0.05)]"
            >
              <Camera className="size-8 text-muted-foreground" />
            </button>
            <p className="text-xs text-muted-foreground">{t("onboarding.tapToUpload")}</p>
          </div>
        )}

        {/* Step 1: Interests / Category */}
        {step === 1 && (
          <div className="flex flex-1 flex-col gap-6 pt-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-foreground">
                {isTakumi ? t("onboarding.expertise") : t("onboarding.interests")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isTakumi ? t("onboarding.expertiseDesc") : t("onboarding.interestsDesc")}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => {
                const selected = selectedCats.includes(cat.slug)
                return (
                  <button
                    key={cat.slug}
                    onClick={() => toggleCat(cat.slug)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border-2 p-3 text-left transition-all text-sm",
                      selected
                        ? "border-primary bg-[rgba(6,78,59,0.05)]"
                        : "border-border hover:border-[rgba(6,78,59,0.3)]"
                    )}
                  >
                    {selected && <Check className="size-4 shrink-0 text-primary" />}
                    <span className={cn("text-xs", selected ? "font-medium text-primary" : "text-foreground")}>
                      {cat.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 2: Bio (Takumi) or Welcome (Shugyo) */}
        {step === 2 && !isTakumi && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
            <p className="font-jp text-5xl text-[rgba(34,197,94,0.6)]">道</p>
            <h2 className="text-2xl font-bold text-foreground">{t("onboarding.allReady")}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {t("onboarding.allReadyDesc")}
            </p>
          </div>
        )}

        {step === 2 && isTakumi && (
          <div className="flex flex-1 flex-col gap-6 pt-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-foreground">{t("onboarding.aboutYou")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("onboarding.aboutDesc")}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bio">Bio</Label>
              <textarea
                id="bio"
                rows={4}
                placeholder={t("onboarding.bioPlaceholder")}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full rounded-xl border border-input bg-transparent px-3 py-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[rgba(6,78,59,0.5)] focus-visible:ring-[3px] outline-none resize-none"
                autoCorrect="on"
                spellCheck={true}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="price">{t("onboarding.price")}</Label>
              <Input
                id="price"
                type="number"
                inputMode="decimal"
                placeholder="29"
                className="h-12 rounded-xl"
              />
            </div>
          </div>
        )}

        {/* Step 3: Welcome (Takumi) */}
        {step === 3 && isTakumi && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
            <p className="font-jp text-5xl text-[rgba(34,197,94,0.6)]">匠</p>
            <h2 className="text-2xl font-bold text-foreground">{t("onboarding.youAreTakumi")}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {t("onboarding.youAreTakumiDesc")}
            </p>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="sticky bottom-0 bg-background px-6 pb-8 pt-4 border-t border-border">
        <Button
          onClick={next}
          className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-[rgba(6,78,59,0.9)]"
        >
          {step === totalSteps - 1 ? t("onboarding.done") : t("onboarding.next")}
          <ArrowRight className="ml-1 size-4" />
        </Button>
      </div>
    </div>
  )
}
