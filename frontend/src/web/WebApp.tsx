import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { LangProvider } from '../i18n/LangContext'
import { Navbar } from './components/Navbar'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { WebDashboard } from './pages/WebDashboard'

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  )
}

export function WebApp() {
  return (
    <AuthProvider>
      <LangProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<PublicLayout><LandingPage /></PublicLayout>} />
            <Route path="/login" element={<PublicLayout><LoginPage /></PublicLayout>} />
            <Route path="/register" element={<PublicLayout><RegisterPage /></PublicLayout>} />
            <Route
              path="/dashboard/*"
              element={<ProtectedRoute><WebDashboard /></ProtectedRoute>}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </LangProvider>
    </AuthProvider>
  )
}
