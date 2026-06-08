import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../web/AuthContext'
import type { AccessInfo, AccessStatus } from './useAccess'

export type { AccessStatus }

export function useWebAccess(): AccessInfo & { telegramId: number; refresh: () => void } {
  const { token } = useAuth()
  const [info, setInfo] = useState<AccessInfo>({
    status: 'loading',
    hoursLeft: null,
    hoursUntilExpiry: null,
    expiresAt: null,
    paymentAmount: null,
    wallet: null,
    priceUsdt: 19.99,
  })

  const check = useCallback(async () => {
    if (!token) {
      setInfo(prev => ({ ...prev, status: 'expired', hoursLeft: 0 }))
      return
    }

    try {
      const res = await fetch('/api/access/web/check', {
        headers: { Authorization: `Bearer ${token}` },
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
        priceUsdt:        data.price_usdt ?? 19.99,
      })
    } catch {
      setInfo(prev => ({ ...prev, status: 'expired', hoursLeft: 0 }))
    }
  }, [token])

  useEffect(() => {
    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [check])

  return { ...info, telegramId: 0, refresh: check }
}
