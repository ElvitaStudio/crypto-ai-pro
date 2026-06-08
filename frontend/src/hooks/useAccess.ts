import { useState, useEffect, useCallback } from 'react'

export type AccessStatus = 'loading' | 'trial' | 'active' | 'expired'

export interface AccessInfo {
  status: AccessStatus
  hoursLeft: number | null          // for trial — hours left in trial
  hoursUntilExpiry: number | null   // for active — hours until subscription ends
  expiresAt: string | null
  paymentAmount: number | null
  wallet: string | null
  priceUsdt: number
}

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000'

function getTelegramId(): number {
  const tg = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id
  if (tg) return tg
  return 999999999
}

export function useAccess() {
  const [info, setInfo] = useState<AccessInfo>({
    status: 'loading',
    hoursLeft: null,
    hoursUntilExpiry: null,
    expiresAt: null,
    paymentAmount: null,
    wallet: null,
    priceUsdt: 10,
  })

  const telegramId = getTelegramId()

  const check = useCallback(async () => {
    try {
      const res = await fetch(`${API}/access/check`, {
        headers: { 'x-telegram-id': String(telegramId) },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setInfo({
        status:           data.status as AccessStatus,
        hoursLeft:        data.hours_left ?? null,
        hoursUntilExpiry: data.hours_until_expiry ?? null,
        expiresAt:        data.expires_at ?? null,
        paymentAmount:    data.payment_amount ?? null,
        wallet:           data.wallet ?? null,
        priceUsdt:        data.price_usdt ?? 10,
      })
    } catch {
      setInfo(prev => ({
        ...prev,
        status:    'trial',
        hoursLeft: 23.5,
        hoursUntilExpiry: null,
        paymentAmount: 10 + (getTelegramId() % 900) / 10000,
        wallet:    'TRC20_WALLET_ADDRESS_HERE',
        priceUsdt: 10,
      }))
    }
  }, [telegramId])

  useEffect(() => {
    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [check])

  return { ...info, telegramId, refresh: check }
}
