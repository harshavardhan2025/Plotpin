import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { useAuth } from '../../contexts/AuthContext';
import { useProperty } from '../../contexts/PropertyContext';
import { api } from '../../lib/api';

// Modals
import PropertyDetailModal from '../property/PropertyDetailModal';
const PropertyViewer3DModal = React.lazy(() => import('../3d/PropertyViewer3DModal'));
import EscrowModal from '../property/EscrowModal';
import BookVisitModal from '../property/BookVisitModal';
import DirectCallModal from '../property/DirectCallModal';
import CreatePropertyModal from '../forms/CreatePropertyModal';
import LocationPickerModal from '../common/LocationPickerModal';
import DeedViewerModal from '../property/DeedViewerModal';
import RescheduleVisitModal from '../property/RescheduleVisitModal';
import PropertyComparisonModal from '../property/PropertyComparisonModal';
import AuthModal from '../auth/AuthModal';
import UserProfileModal from '../profile/UserProfileModal';

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminModule = location.pathname.startsWith('/admin');
  const {
    currentUser,
    setCurrentUser,
    isAdmin,
    loginUser,
    showAuthModal,
    setShowAuthModal,
    authModalMode,
    authResetEmail,
    authResetToken,
    authResetOtp,
    showProfileModal,
    setShowProfileModal,
    toastMessage,
    showToast,
    logout
  } = useAuth();

  const {
    isMobile,
    deviceMode,
    selectedProperty,
    showDetailModal,
    setShowDetailModal,
    show3DModal,
    setShow3DModal,
    selected3DProperty,
    showVisitModal,
    setShowVisitModal,
    showCallModal,
    setShowCallModal,
    showEscrowModal,
    setShowEscrowModal,
    showCreateModal,
    setShowCreateModal,
    showLocationPicker,
    setShowLocationPicker,
    userLocation,
    setUserLocation,
    radiusKm,
    setRadiusKm,
    showDeedModal,
    setShowDeedModal,
    selectedDeedProperty,
    setSelectedDeedProperty,
    showComparisonModal,
    setShowComparisonModal,
    comparisonList,
    setComparisonList,
    clearComparison,
    removeFromComparison,
    handleOpenDetailModal,
    handleOpenCallModal,
    handleOpenVisitModal,
    handleOpenEscrowModal,
    handleOpen3DModal,
    showRescheduleModal,
    setShowRescheduleModal,
    rescheduleTarget,
    setRescheduleTarget,
    refreshProperties,
    loadUserData,
    loadAdminData,
    submitNewPropertyListing
  } = useProperty();

  const [deedModalPage, setDeedModalPage] = useState(1);

  const handleSaveProperty = async (propertyData) => {
    try {
      showToast('Submitting property for administrative review...');
      if (typeof submitNewPropertyListing === 'function') {
        await submitNewPropertyListing(propertyData);
      } else {
        await api.createDraftProperty(propertyData);
      }
      setShowCreateModal(false);
      showToast('✅ Property submitted for Super Admin Cadastral Verification!');
      if (refreshProperties) await refreshProperties();
      if (loadUserData) await loadUserData();
      if (loadAdminData) await loadAdminData();
    } catch (err) {
      showToast(err.message || 'Failed to submit property');
    }
  };

  const handleAuthSuccess = async (userData, token) => {
    const user = userData?.user || userData;
    const isUserAdmin = Array.isArray(user?.roles) && user.roles.includes('admin');
    if (token && loginUser) {
      loginUser(user, token);
    } else if (setCurrentUser) {
      setCurrentUser(user);
    }
    setShowAuthModal(false);
    showToast(`Welcome, ${user?.name || (isUserAdmin ? 'Administrator' : 'Citizen')}!`);
    
    if (isUserAdmin) {
      if (loadAdminData) await loadAdminData();
      navigate('/admin/verifications');
    } else {
      if (loadUserData) await loadUserData();
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] dark:bg-[#0B132B] text-slate-800 dark:text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 pb-16 md:pb-0">
        <Outlet />
      </main>

      {!isAdminModule && <Footer />}

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900/95 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 z-[10002] animate-in fade-in slide-in-from-bottom-4">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Property Detail Modal */}
      {showDetailModal && selectedProperty && (
        <PropertyDetailModal
          property={selectedProperty}
          isOwner={Boolean(currentUser?._id && (selectedProperty.ownerId === currentUser._id || selectedProperty.owner_id === currentUser._id))}
          isAdmin={isAdmin}
          onClose={() => setShowDetailModal(false)}
          onBookVisit={() => {
            setShowDetailModal(false);
            handleOpenVisitModal(selectedProperty);
          }}
          onRequestCall={() => {
            setShowDetailModal(false);
            handleOpenCallModal(selectedProperty);
          }}
          onMakeOffer={() => {
            setShowDetailModal(false);
            handleOpenEscrowModal(selectedProperty);
          }}
          onLaunch3DTour={() => {
            setShowDetailModal(false);
            handleOpen3DModal(selectedProperty);
          }}
          onInspectDeeds={(prop) => {
            setShowDetailModal(false);
            handleOpenDeedModal(prop || selectedProperty);
          }}
          isMobile={isMobile}
        />
      )}

      {/* 3D Architectural Viewer Modal (Lazy loaded on demand) */}
      {show3DModal && selected3DProperty && (
        <React.Suspense fallback={null}>
          <PropertyViewer3DModal
            property={selected3DProperty}
            onClose={() => setShow3DModal(false)}
            onBookVisit={() => {
              setShow3DModal(false);
              handleOpenVisitModal(selected3DProperty);
            }}
            onRequestCall={() => {
              setShow3DModal(false);
              handleOpenCallModal(selected3DProperty);
            }}
            isMobile={isMobile}
          />
        </React.Suspense>
      )}

      {/* Token Escrow Modal */}
      {showEscrowModal && selectedProperty && (
        <EscrowModal
          property={selectedProperty}
          onClose={() => setShowEscrowModal(false)}
          onSuccess={async (offerData) => {
            try {
              await api.createOffer(offerData);
              setShowEscrowModal(false);
              showToast('✅ Direct offer & escrow token submitted successfully!');
              await loadUserData();
            } catch (err) {
              showToast(err.message || 'Failed to submit offer');
              throw err;
            }
          }}
        />
      )}

      {/* Global Reschedule Visit Modal */}
      {showRescheduleModal && rescheduleTarget && (
        <RescheduleVisitModal
          isOpen={showRescheduleModal}
          appointment={rescheduleTarget}
          onClose={() => {
            setShowRescheduleModal(false);
            setRescheduleTarget(null);
          }}
          onSuccess={(updated) => {
            setShowRescheduleModal(false);
            setRescheduleTarget(null);
            showToast('✅ Site visit rescheduled successfully!');
            loadUserData();
          }}
          showToast={showToast}
          isMobile={isMobile}
        />
      )}

      {/* Surveyor Escorted Site Visit Modal */}
      {showVisitModal && selectedProperty && (
        <BookVisitModal
          isOpen={showVisitModal}
          property={selectedProperty}
          onClose={() => setShowVisitModal(false)}
          onSuccess={() => {
            setShowVisitModal(false);
            loadUserData();
          }}
          isMobile={isMobile}
        />
      )}

      {/* Direct Call / Legal Concierge Modal */}
      {showCallModal && selectedProperty && (
        <DirectCallModal
          isOpen={showCallModal}
          property={selectedProperty}
          onClose={() => setShowCallModal(false)}
          onSuccess={() => {
            setShowCallModal(false);
            loadUserData();
          }}
          isMobile={isMobile}
        />
      )}

      {/* Create / Post Property Modal */}
      {showCreateModal && (
        <CreatePropertyModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleSaveProperty}
          isMobile={isMobile}
        />
      )}

      {/* Location Search & Proximity Radius Picker */}
      {showLocationPicker && (
        <LocationPickerModal
          isOpen={showLocationPicker}
          onClose={() => setShowLocationPicker(false)}
          currentLocation={userLocation}
          radiusKm={radiusKm || 50}
          isMobile={isMobile}
          onApplyLocation={({ location, radiusKm: selectedRadius }) => {
            if (location) setUserLocation(location);
            if (selectedRadius != null) setRadiusKm(selectedRadius);
            setShowLocationPicker(false);
            showToast(`📍 Proximity center set to ${location?.name || 'custom location'} (${selectedRadius || radiusKm || 50} km)!`);
          }}
        />
      )}

      {/* Official Andhra Pradesh Cadastral Title Deed Modal */}
      {showDeedModal && selectedDeedProperty && (
        <DeedViewerModal
          selectedDeedPreview={selectedDeedProperty}
          setSelectedDeedPreview={setSelectedDeedProperty}
          deedPreviewPage={deedModalPage}
          setDeedPreviewPage={setDeedModalPage}
        />
      )}

      {/* Side-by-Side Property Comparison Modal */}
      {showComparisonModal && (
        <PropertyComparisonModal
          isOpen={showComparisonModal}
          onClose={() => setShowComparisonModal(false)}
          properties={comparisonList}
          comparisonList={comparisonList}
          onRemoveProperty={(id) => {
            removeFromComparison(id);
            if (comparisonList.length <= 1) {
              setShowComparisonModal(false);
            }
          }}
          onClearAll={() => {
            clearComparison();
            setShowComparisonModal(false);
          }}
          onSelectProperty={(prop) => {
            setShowComparisonModal(false);
            handleOpenDetailModal(prop);
          }}
          onBookVisit={(prop) => {
            setShowComparisonModal(false);
            handleOpenVisitModal(prop);
          }}
          onRequestCall={(prop) => {
            setShowComparisonModal(false);
            handleOpenCallModal(prop);
          }}
          isMobile={isMobile}
        />
      )}

      {/* Global Comparison Floating Pill */}
      {comparisonList.length > 0 && !showComparisonModal && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-full shadow-2xl z-30 flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-4">
          <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>{comparisonList.length} / 3 in Comparison</span>
          </span>
          <button
            type="button"
            onClick={() => setShowComparisonModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black px-3.5 py-1 rounded-full transition-all shadow-sm cursor-pointer"
          >
            Compare Now
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clearComparison();
            }}
            className="text-slate-400 hover:text-rose-400 hover:bg-white/10 active:scale-95 text-xs font-bold px-2 py-1 rounded-lg transition-all cursor-pointer"
            title="Clear all from comparison"
          >
            Clear
          </button>
        </div>
      )}

      {/* Authentication Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        initialMode={authModalMode}
        initialEmail={authResetEmail}
        initialToken={authResetToken}
        initialOtp={authResetOtp}
        isMobile={deviceMode === 'mobile'}
      />

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        currentUser={currentUser}
        onLogout={logout}
      />
    </div>
  );
}

