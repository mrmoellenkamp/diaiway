"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { WalletTopupModal } from "@/components/wallet-topup-modal"

interface WalletTopupContextType {
  openWalletTopup: (onSuccess?: () => void) => void
}

const WalletTopupContext = createContext<WalletTopupContextType | undefined>(
  undefined
)

export function WalletTopupProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [onSuccessCallback, setOnSuccessCallback] = useState<(() => void) | undefined>()

  const openWalletTopup = useCallback((onSuccess?: () => void) => {
    setOnSuccessCallback(() => onSuccess)
    setOpen(true)
  }, [])

  const handleSuccess = useCallback(() => {
    onSuccessCallback?.()
    setOnSuccessCallback(undefined)
  }, [onSuccessCallback])

  const handleOpenChange = useCallback((o: boolean) => {
    setOpen(o)
    if (!o) setOnSuccessCallback(undefined)
  }, [])

  return (
    <WalletTopupContext.Provider value={{ openWalletTopup }}>
      {children}
      <WalletTopupModal
        open={open}
        onOpenChange={handleOpenChange}
        onSuccess={handleSuccess}
      />
    </WalletTopupContext.Provider>
  )
}

export function useWalletTopup() {
  const ctx = useContext(WalletTopupContext)
  if (!ctx) return { openWalletTopup: () => {} }
  return ctx
}
