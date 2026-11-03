import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { homePathForRole } from '../utils/routes'
import PlayerRoute from './PlayerRoute'
import PublicPlayerRoute from './PublicPlayerRoute'
import AdminRoute from './AdminRoute'
import OwnerRoute from './OwnerRoute'
import ScrollToTop from '../components/ScrollToTop'

// Owner layout & context
import OwnerLayout from '../components/layout/OwnerLayout'
import { OwnerVenueProvider } from '../context/OwnerVenueContext'

// Auth pages
import LoginPage          from '../pages/auth/LoginPage'
import RegisterPage       from '../pages/auth/RegisterPage'
import CheckEmailPage     from '../pages/auth/CheckEmailPage'
import VerifyEmailPage    from '../pages/auth/VerifyEmailPage'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage'
import ResetPasswordPage  from '../pages/auth/ResetPasswordPage'

// Player pages
import VenuesPage      from '../pages/player/VenuesPage'
import VenueDetailPage from '../pages/player/VenueDetailPage'
import EventsPage      from '../pages/player/EventsPage'
import MyBookingsPage  from '../pages/player/MyBookingsPage'
import ProfilePage     from '../pages/player/ProfilePage'
import HelpPage        from '../pages/help/HelpPage'

// Admin pages
import DashboardPage     from '../pages/admin/DashboardPage'
import AdminVenuesPage   from '../pages/admin/VenuesPage'
import OwnersPage        from '../pages/admin/OwnersPage'
import AdminReviewsPage  from '../pages/admin/ReviewsPage'
import AdminEventsPage   from '../pages/admin/AdminEventsPage'
import AdminBookingsPage from '../pages/admin/BookingsPage'
import AnalyticsPage     from '../pages/admin/AnalyticsPage'
import CommissionPage    from '../pages/admin/CommissionPage'

// Owner pages
import TodayPage       from '../pages/owner/TodayPage'
import ShopPage        from '../pages/owner/ShopPage'
import OwnerEventsPage from '../pages/owner/OwnerEventsPage'

// Shared Account page
import AccountPage from '../pages/account/AccountPage'

// Legal pages
import LegalPage from '../pages/legal/LegalPage'

import NotFoundPage from '../pages/NotFoundPage'

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/venues" replace />
  return <Navigate to={homePathForRole(user.role)} replace />
}

export default function AppRouter() {
  return (
    <>
      <ScrollToTop />
      <Routes>
      {/* Root → smart redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* Auth */}
      <Route path="/login"                 element={<LoginPage />} />
      <Route path="/register"              element={<RegisterPage />} />
      <Route path="/check-email"           element={<CheckEmailPage />} />
      <Route path="/verify-email/:token"   element={<VerifyEmailPage />} />
      <Route path="/forgot-password"       element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

      {/* Player */}
      <Route path="/venues" element={
        <PublicPlayerRoute><VenuesPage /></PublicPlayerRoute>
      } />
      <Route path="/venues/:id" element={
        <PublicPlayerRoute><VenueDetailPage /></PublicPlayerRoute>
      } />
      <Route path="/events" element={
        <PublicPlayerRoute><EventsPage /></PublicPlayerRoute>
      } />
      <Route path="/my-bookings" element={
        <PlayerRoute><MyBookingsPage /></PlayerRoute>
      } />
      <Route path="/profile" element={
        <PlayerRoute><ProfilePage /></PlayerRoute>
      } />
      <Route path="/help" element={
        <PublicPlayerRoute><HelpPage /></PublicPlayerRoute>
      } />

      {/* Admin */}
      <Route path="/admin/dashboard" element={
        <AdminRoute><DashboardPage /></AdminRoute>
      } />
      <Route path="/admin/venues" element={
        <AdminRoute><AdminVenuesPage /></AdminRoute>
      } />
      <Route path="/admin/owners" element={
        <AdminRoute><OwnersPage /></AdminRoute>
      } />
      <Route path="/admin/reviews" element={
        <AdminRoute><AdminReviewsPage /></AdminRoute>
      } />
      <Route path="/admin/events" element={
        <AdminRoute><AdminEventsPage /></AdminRoute>
      } />
      <Route path="/admin/bookings" element={
        <AdminRoute><AdminBookingsPage /></AdminRoute>
      } />
      <Route path="/admin/analytics" element={
        <AdminRoute><AnalyticsPage /></AdminRoute>
      } />
      <Route path="/admin/commission" element={
        <AdminRoute><CommissionPage /></AdminRoute>
      } />
      <Route path="/admin/account" element={
        <AdminRoute><AccountPage /></AdminRoute>
      } />

      {/* Owner Portal */}
      <Route
        path="/owner"
        element={
          <OwnerRoute>
            <OwnerVenueProvider>
              <OwnerLayout />
            </OwnerVenueProvider>
          </OwnerRoute>
        }
      >
        <Route index element={<Navigate to="today" replace />} />
        <Route path="today" element={<TodayPage />} />
        <Route path="bookings" element={<AdminBookingsPage noLayout />} />
        <Route path="venue" element={<AdminVenuesPage noLayout />} />
        <Route path="shop" element={<ShopPage />} />
        <Route path="events" element={<OwnerEventsPage />} />
        <Route path="reviews" element={<AdminReviewsPage noLayout />} />
        <Route path="insights" element={<AnalyticsPage noLayout />} />
        <Route path="account" element={<AccountPage noLayout />} />
      </Route>

      {/* Legal */}
      <Route path="/privacy" element={<LegalPage doc="privacy" />} />
      <Route path="/terms"   element={<LegalPage doc="terms" />} />

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </>
  )
}
