import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import FormularioJornada from './pages/FormularioJornada'
import Dashboard from './pages/Dashboard'
import Reporte from './pages/Reporte'
import CostosFijos from './pages/CostosFijos'
import YTD from './pages/YTD'

function ProtectedRoute({ children, rol }) {
  const { session, usuario } = useAuth()
  if (session === undefined || usuario === undefined)
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Cargando...</div>
  if (!session) return <Navigate to="/login" replace />
  if (!usuario) return <Navigate to="/login" replace />
  if (rol && usuario && usuario.rol !== rol) return <Navigate to="/" replace />
  return children
}

function RootRedirect() {
  const { session, usuario } = useAuth()
  if (session === undefined || usuario === undefined)
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Cargando...</div>
  if (!session) return <Navigate to="/login" replace />
  if (!usuario) return <Navigate to="/login" replace />
  return <Navigate to={usuario.rol === 'jefe' ? '/dashboard' : '/jornada'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRedirect />} />
          <Route path="/jornada" element={
            <ProtectedRoute rol="piloto"><FormularioJornada /></ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute rol="jefe"><Dashboard /></ProtectedRoute>
          } />
          <Route path="/reporte/:anio/:mes" element={
            <ProtectedRoute rol="jefe"><Reporte /></ProtectedRoute>
          } />
        <Route path="/costos-fijos" element={
           <ProtectedRoute rol="jefe"><CostosFijos /></ProtectedRoute>
         } />
       <Route path="/ytd" element={
         <ProtectedRoute rol="jefe"><YTD /></ProtectedRoute>
         } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}