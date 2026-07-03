import { AnimatePresence } from 'framer-motion'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AuthSplash from './components/auth/AuthSplash.jsx'
import ProtectedRoute from './components/auth/ProtectedRoute.jsx'
import MainLayout from './components/layout/MainLayout.jsx'
import AuthProvider from './context/AuthProvider.jsx'
import AvatarViewerProvider from './context/AvatarViewerProvider.jsx'
import LanguageProvider from './context/LanguageProvider.jsx'
import SocketProvider from './context/SocketProvider.jsx'
import ThemeProvider from './context/ThemeProvider.jsx'
import { ROLE_DASHBOARDS, useAuth } from './context/auth.js'
const Login = lazy(() => import('./pages/Login.jsx'))
const CreateOrder = lazy(() => import('./pages/CreateOrder.jsx'))
const MerchantDashboard = lazy(() => import('./pages/MerchantDashboard.jsx'))
const MerchantCatalog = lazy(() => import('./pages/MerchantCatalog.jsx'))
const Profile = lazy(() => import('./pages/Profile.jsx'))
const Register = lazy(() => import('./pages/Register.jsx'))
const PublicShop = lazy(() => import('./pages/PublicShop.jsx'))
const Tracking = lazy(() => import('./pages/Tracking.jsx'))
const DeliveriesPage = lazy(() => import('./pages/WorkspacePages.jsx').then((module) => ({ default: module.DeliveriesPage })))
const DriverMapPage = lazy(() => import('./pages/WorkspacePages.jsx').then((module) => ({ default: module.DriverMapPage })))

function DashboardRedirect() {
  const { user } = useAuth()
  return <Navigate to={ROLE_DASHBOARDS[user?.role] || '/login'} replace />
}

function AnimatedRoutes() {
  const location = useLocation()
  const routeKey = ['/login', '/register'].includes(location.pathname)
    ? location.pathname
    : 'authenticated-app'

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={routeKey}>
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="shop/:slug" element={<PublicShop />} />
        <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index element={<DashboardRedirect />} />
          <Route path="orders" element={<MerchantDashboard />} />
          <Route path="create" element={<CreateOrder />} />
          <Route path="catalog" element={<MerchantCatalog />} />
          <Route path="orders/new" element={<MerchantDashboard />} />
          <Route path="tracking" element={<Tracking />} />
          <Route path="tracking/:orderId" element={<Tracking />} />
          <Route path="deliveries" element={<DeliveriesPage />} />
          <Route path="map" element={<DriverMapPage />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<DashboardRedirect />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AnimatePresence>
  )
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <AvatarViewerProvider>
            <SocketProvider>
              <BrowserRouter>
                <Suspense fallback={<AuthSplash />}>
                  <AnimatedRoutes />
                </Suspense>
              </BrowserRouter>
            </SocketProvider>
          </AvatarViewerProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}

export default App
