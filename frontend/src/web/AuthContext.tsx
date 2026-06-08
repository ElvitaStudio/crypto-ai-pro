import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

const BASE = '/api'
const TOKEN_KEY = 'mp_jwt'

export interface WebUser {
  id: number
  email: string | null
  displayName: string | null
  avatarUrl: string | null
}

interface AuthContextValue {
  user: WebUser | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName?: string) => Promise<void>
  loginWithGoogle: (idToken: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function apiPost(path: string, body: unknown, token?: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Request failed')
  return data
}

async function apiGet(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Unauthorized')
  return res.json()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<WebUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount: restore session from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY)
    if (!saved) {
      setIsLoading(false)
      return
    }
    apiGet('/auth/me', saved)
      .then((u: WebUser) => {
        setToken(saved)
        setUser(u)
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const _handleAuthResponse = useCallback((data: { accessToken: string; user: WebUser }) => {
    localStorage.setItem(TOKEN_KEY, data.accessToken)
    setToken(data.accessToken)
    setUser(data.user)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiPost('/auth/login', { email, password })
    _handleAuthResponse(data)
  }, [_handleAuthResponse])

  const register = useCallback(async (email: string, password: string, displayName?: string) => {
    const data = await apiPost('/auth/register', { email, password, displayName })
    _handleAuthResponse(data)
  }, [_handleAuthResponse])

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const data = await apiPost('/auth/google', { idToken })
    _handleAuthResponse(data)
  }, [_handleAuthResponse])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
