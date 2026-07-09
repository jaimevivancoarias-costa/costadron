import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import FormularioJornada from './pages/FormularioJornada'
import Dashboard from './pages/Dashboard'
import Reporte from './pages/Reporte'
import CostosFijos from './pages/CostosFijos'
import YTD from './pages/YTD'
import Historial from './pages/Historial'
import Eficiencia from './pages/Eficiencia'

function ProtectedRoute({ children, roles }) {
  const { session, usuario } = useAuth()
  if (session === undefined || usuario === undefined)
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Cargando...</div>
  if (!session) return <Navigate to="/login" replace />
  if (!usuario) return <Navigate to="/login" replace />
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/" replace />
  return children
}

function RootRedirect() {
  const { session, usuario } = useAuth()
  if (session === undefined || usuario === undefined)
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Cargando...</div>
  if (!session) return <Navigate to="/login" replace />
  if (!usuario) return <Navigate to="/login" replace />
  return <Navigate to={usuario.rol === 'piloto' ? '/jornada' : '/dashboard'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRedirect />} />
          <Route path="/jornada" element={
            <ProtectedRoute roles={['piloto']}><FormularioJornada /></ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute roles={['jefe', 'contador']}><Dashboard /></ProtectedRoute>
          } />
          <Route path="/reporte/:anio/:mes" element={
            <ProtectedRoute roles={['jefe', 'contador']}><Reporte /></ProtectedRoute>
          } />
          <Route path="/costos-fijos" element={
            <ProtectedRoute roles={['jefe', 'contador']}><CostosFijos /></ProtectedRoute>
          } />
          <Route path="/ytd" element={
            <ProtectedRoute roles={['jefe', 'contador']}><YTD /></ProtectedRoute>
          } />
          <Route path="/historial" element={
            <ProtectedRoute roles={['jefe', 'contador', 'super_admin']}><Historial /></ProtectedRoute>
          } />
          <Route path="/eficiencia" element={
            <ProtectedRoute roles={['jefe', 'super_admin']}><Eficiencia /></ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
