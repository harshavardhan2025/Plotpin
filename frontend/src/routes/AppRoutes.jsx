import React, { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Route-level code splitting with React.lazy
const ExplorePage = lazy(() => import('../pages/explore/ExplorePage'));
const MapPage = lazy(() => import('../pages/map/MapPage'));
const AIRecommendationsPage = lazy(() => import('../pages/ai/AIRecommendationsPage'));
const PropertyDetailPage = lazy(() => import('../pages/properties/PropertyDetailPage'));
const MyListingsPage = lazy(() => import('../pages/portfolio/MyListingsPage'));
const MyBuyingsPage = lazy(() => import('../pages/portfolio/MyBuyingsPage'));
const SavedPropertiesPage = lazy(() => import('../pages/saved/SavedPropertiesPage'));
const SiteVisitsPage = lazy(() => import('../pages/visits/SiteVisitsPage'));
const SupportPage = lazy(() => import('../pages/support/SupportPage'));

// Super Admin Pages
const AdminLoginPage = lazy(() => import('../pages/admin/AdminLoginPage'));
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const SuperAdminOverview = lazy(() => import('../pages/admin/subpages/SuperAdminOverview'));
const PropertyInventory = lazy(() => import('../pages/admin/subpages/PropertyInventory'));
const BookingManagement = lazy(() => import('../pages/admin/subpages/BookingManagement'));
const CallManagement = lazy(() => import('../pages/admin/subpages/CallManagement'));
const CustomerSupportManagement = lazy(() => import('../pages/admin/subpages/CustomerSupportManagement'));
const CustomerManagement = lazy(() => import('../pages/admin/subpages/CustomerManagement'));
const ReportsManagement = lazy(() => import('../pages/admin/subpages/ReportsManagement'));
const AdminSettings = lazy(() => import('../pages/admin/subpages/AdminSettings'));

// Auxiliary Admin Views
const VerificationQueue = lazy(() => import('../pages/admin/subpages/VerificationQueue'));
const MediationCenter = lazy(() => import('../pages/admin/subpages/MediationCenter'));
const EscrowDashboard = lazy(() => import('../pages/admin/subpages/EscrowDashboard'));
const AuditLogs = lazy(() => import('../pages/admin/subpages/AuditLogs'));

const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-slate-500 text-xs font-bold">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
        <span>Loading PlotPin...</span>
      </div>
    </div>
  );
}

/**
 * Route guard that requires authentication.
 * If user is not logged in, redirects to /explore and triggers sign-in dialog.
 */
function ProtectedUserRoute({ children, label = 'this section' }) {
  const { isLoggedIn, setShowAuthModal, setAuthModalMode, showToast } = useAuth();

  useEffect(() => {
    if (!isLoggedIn) {
      setAuthModalMode('login');
      setShowAuthModal(true);
      showToast(`Please sign in to access ${label}`);
    }
  }, [isLoggedIn, setShowAuthModal, setAuthModalMode, showToast, label]);

  if (!isLoggedIn) {
    return <Navigate to="/explore" replace />;
  }

  return children;
}

export default function AppRoutes() {
  const { isAdmin } = useAuth();

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to={isAdmin ? "/admin/dashboard" : "/explore"} replace />} />
          
          {/* Public Routes (Accessible without login) */}
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/ai" element={<AIRecommendationsPage />} />
          <Route path="/properties/:id" element={<PropertyDetailPage />} />

          {/* Authenticated Citizen Routes (Login required) */}
          <Route
            path="/portfolio/my-listings"
            element={
              isAdmin ? (
                <Navigate to="/admin/properties" replace />
              ) : (
                <ProtectedUserRoute label="My Listings">
                  <MyListingsPage />
                </ProtectedUserRoute>
              )
            }
          />
          <Route
            path="/portfolio/my-buyings"
            element={
              isAdmin ? (
                <Navigate to="/admin/dashboard" replace />
              ) : (
                <ProtectedUserRoute label="Purchased Deeds">
                  <MyBuyingsPage />
                </ProtectedUserRoute>
              )
            }
          />
          <Route
            path="/saved"
            element={
              isAdmin ? (
                <Navigate to="/admin/dashboard" replace />
              ) : (
                <ProtectedUserRoute label="Saved Properties">
                  <SavedPropertiesPage />
                </ProtectedUserRoute>
              )
            }
          />
          <Route
            path="/visits"
            element={
              isAdmin ? (
                <Navigate to="/admin/bookings" replace />
              ) : (
                <ProtectedUserRoute label="Site Visits & Calls">
                  <SiteVisitsPage />
                </ProtectedUserRoute>
              )
            }
          />
          <Route
            path="/support"
            element={
              isAdmin ? (
                <Navigate to="/admin/support" replace />
              ) : (
                <ProtectedUserRoute label="Support & Helpdesk">
                  <SupportPage />
                </ProtectedUserRoute>
              )
            }
          />

          {/* Super Admin - Full Platform Governance Routes */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={isAdmin ? <AdminDashboard /> : <Navigate to="/explore" replace />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<SuperAdminOverview />} />
            <Route path="properties" element={<PropertyInventory />} />
            <Route path="inventory" element={<Navigate to="/admin/properties" replace />} />
            <Route path="bookings" element={<BookingManagement />} />
            <Route path="calls" element={<Navigate to="/admin/bookings" replace />} />
            <Route path="support" element={<CustomerSupportManagement />} />
            <Route path="customers" element={<CustomerManagement />} />
            <Route path="reports" element={<ReportsManagement />} />
            <Route path="settings" element={<AdminSettings />} />

            {/* Auxiliary routes */}
            <Route path="verifications" element={<VerificationQueue />} />
            <Route path="mediation" element={<MediationCenter />} />
            <Route path="escrows" element={<EscrowDashboard />} />
            <Route path="audit" element={<AuditLogs />} />
          </Route>

          {/* 404 Catch-All */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
