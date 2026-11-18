import { AnimatePresence } from 'framer-motion'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AuthSplash from './components/auth/AuthSplash.jsx'
import ProtectedRoute from './components/auth/ProtectedRoute.jsx'
import MainLayout from './components/layout/MainLayout.jsx'
import PwaInstallButton from './components/pwa/PwaInstallButton.jsx'
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
const DeliveriesPage = lazy(() => import('./pages/WorkspacePages.jsx')
  .then((module) => ({ default: module.DeliveriesPage })))
const DriverMapPage = lazy(() => import('./pages/WorkspacePages.jsx')
  .then((module) => ({ default: module.DriverMapPage })))

// Portail public (marketplace) : charge a la demande, dans ses propres fichiers JS et CSS,
// pour ne pas alourdir l'espace prive.
const MarketplaceLayout = lazy(() => import('./marketplace/MarketplaceLayout.jsx'))
const MarketplaceHome = lazy(() => import('./marketplace/pages/HomePage.jsx'))
const MarketplaceCatalog = lazy(() => import('./marketplace/pages/CatalogPage.jsx'))
const MarketplaceProduct = lazy(() => import('./marketplace/pages/ProductPage.jsx'))
const MarketplaceShops = lazy(() => import('./marketplace/pages/ShopsPage.jsx'))
const MarketplaceTracking = lazy(() => import('./marketplace/pages/TrackingPage.jsx'))
const MarketplacePartner = lazy(() => import('./marketplace/pages/PartnerPage.jsx'))
const MarketplaceNotFound = lazy(() => import('./marketplace/pages/NotFoundPage.jsx'))

// Premier segment d'URL des pages qui ne relevent pas du portail public
const PRIVATE_SEGMENTS = new Set(['espace', 'orders', 'create', 'catalog', 'tracking', 'deliveries', 'map', 'profile', 'shop'])

// Ecran d'attente du portail : meme fond que le portail, sans l'ecran de demarrage de l'espace prive
const MarketplaceFallback = () => <div className="h-dvh bg-[#09090b]" />

function DashboardRedirect() {
  const { user } = useAuth()
  return <Navigate to={ROLE_DASHBOARDS[user?.role] || '/login'} replace />
}

function AnimatedRoutes() {
  const location = useLocation()
  const firstSegment = location.pathname.split('/')[1] || ''
  const routeKey = ['/login', '/register'].includes(location.pathname)
    ? location.pathname
    : PRIVATE_SEGMENTS.has(firstSegment) ? 'authenticated-app' : 'marketplace'

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={routeKey}>
        <Route path="login" element={<Login installControl={<PwaInstallButton />} />} />
        <Route path="register" element={<Register installControl={<PwaInstallButton />} />} />
        <Route path="shop/:slug" element={<PublicShop installControl={<PwaInstallButton />} />} />
        <Route element={<Suspense fallback={<MarketplaceFallback />}><MarketplaceLayout /></Suspense>}>
          <Route index element={<MarketplaceHome />} />
          <Route path="catalogue" element={<MarketplaceCatalog />} />
          <Route path="produits/:id" element={<MarketplaceProduct />} />
          <Route path="boutiques" element={<MarketplaceShops />} />
          <Route path="suivi" element={<MarketplaceTracking />} />
          <Route path="suivi/:code" element={<MarketplaceTracking />} />
          <Route path="devenir-partenaire" element={<MarketplacePartner />} />
          <Route path="devenir-vendeur" element={<MarketplacePartner role="merchant" />} />
          <Route path="devenir-livreur" element={<MarketplacePartner role="driver" />} />
          {/* Toute URL inconnue : page 404 publique (les routes privees ci-dessous restent prioritaires
              car explicites, et protegees par ProtectedRoute) */}
          <Route path="*" element={<MarketplaceNotFound />} />
        </Route>
        <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          {/* Ancienne entree « / » de l'espace prive : redirection vers le tableau de bord du role */}
          <Route path="espace" element={<DashboardRedirect />} />
          <Route path="orders" element={<MerchantDashboard />} />
          <Route path="create" element={<CreateOrder />} />
          <Route path="catalog" element={<MerchantCatalog />} />
          <Route path="orders/new" element={<MerchantDashboard />} />
          <Route path="tracking" element={<Tracking />} />
          <Route path="tracking/:orderId" element={<Tracking />} />
          <Route path="deliveries" element={<DeliveriesPage />} />
          <Route path="map" element={<DriverMapPage />} />
          <Route path="profile" element={<Profile />} />
        </Route>
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
