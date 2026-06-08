import { useState, useEffect } from 'react'
import { AdminLogin } from './AdminLogin'
import { AdminLayout } from './AdminLayout'

const TOKEN_KEY = 'admin_token'

export function AdminApp() {
  const [token, setToken] = useState<string | null>(
    () => sessionStorage.getItem(TOKEN_KEY)
  )

  const logout = () => {
    sessionStorage.removeItem(TOKEN_KEY)
    setToken(null)
  }

  const onLogin = (t: string) => {
    sessionStorage.setItem(TOKEN_KEY, t)
    setToken(t)
  }

  if (!token) return <AdminLogin onLogin={onLogin} />
  return <AdminLayout token={token} onLogout={logout} />
}
