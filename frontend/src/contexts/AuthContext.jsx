import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

function sanitizeUserData(user) {
  if (!user || typeof user !== 'object') return user;
  const clone = { ...user };
  if (typeof clone.name === 'string') {
    clone.name = clone.name.replace(/LandPin/gi, 'PlotPin').replace(/landpin/gi, 'plotpin');
  }
  if (typeof clone.email === 'string') {
    clone.email = clone.email.replace(/LandPin/gi, 'PlotPin').replace(/landpin/gi, 'plotpin');
  }
  return clone;
}

export function AuthProvider({ children }) {
  // Current user loaded from localStorage if token exists
  const [currentUser, setCurrentUser] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
        const stored = localStorage.getItem('auth_user');
        if (token && stored) {
          const parsed = JSON.parse(stored);
          const sanitized = sanitizeUserData(parsed);
          if (JSON.stringify(sanitized) !== stored) {
            try {
              localStorage.setItem('auth_user', JSON.stringify(sanitized));
            } catch (e) {}
          }
          return sanitized;
        }
      } catch (e) {
        console.warn('Error reading stored auth user:', e);
      }
    }
    return null;
  });

  const [activeRole, setActiveRoleState] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const storedRole = localStorage.getItem('auth_role');
      if (storedRole === 'admin') return 'admin';
    }
    return 'user';
  });

  // Modal triggers
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login'); // 'login' | 'signup' | 'forgot' | 'reset'
  const [authResetEmail, setAuthResetEmail] = useState('');
  const [authResetToken, setAuthResetToken] = useState('');
  const [authResetOtp, setAuthResetOtp] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4000);
  }, []);

  const isLoggedIn = useMemo(() => {
    return Boolean(
      currentUser &&
      currentUser._id &&
      currentUser._id !== 'usr_guest' &&
      (typeof localStorage !== 'undefined' ? Boolean(localStorage.getItem('auth_token')) : false)
    );
  }, [currentUser]);

  const hasAdminPrivilege = useMemo(() => {
    return Boolean(
      isLoggedIn &&
      currentUser &&
      Array.isArray(currentUser.roles) &&
      currentUser.roles.includes('admin')
    );
  }, [isLoggedIn, currentUser]);

  const isAdmin = useMemo(() => {
    return Boolean(hasAdminPrivilege && activeRole === 'admin');
  }, [hasAdminPrivilege, activeRole]);

  const userInitials = useMemo(() => {
    if (!currentUser || !currentUser.name) return 'PP';
    const cleanName = currentUser.name.replace(/LandPin/gi, 'PlotPin');
    const parts = cleanName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }, [currentUser]);

  // Ensure any cached user state is aggressively sanitized
  useEffect(() => {
    if (currentUser && currentUser.name && /LandPin/i.test(currentUser.name)) {
      const clean = sanitizeUserData(currentUser);
      setCurrentUser(clean);
      try {
        localStorage.setItem('auth_user', JSON.stringify(clean));
      } catch (e) {}
    }
  }, [currentUser]);

  const setActiveRole = useCallback(async (newRole) => {
    setActiveRoleState(newRole);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('auth_role', newRole);
    }
    await api.setRole(newRole);
    if (newRole === 'user') {
      showToast('Switched to Citizen Mode');
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
        window.location.href = '/explore';
      }
    } else {
      showToast('Switched to Admin Workspace');
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin')) {
        window.location.href = '/admin/dashboard';
      }
    }
  }, [showToast]);

  const loginUser = useCallback((user, token) => {
    const cleanUser = sanitizeUserData(user);
    setCurrentUser(cleanUser);
    const isUserAdmin = Array.isArray(cleanUser?.roles) && cleanUser.roles.includes('admin');
    const userRole = isUserAdmin ? 'admin' : 'user';
    setActiveRoleState(userRole);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_role', userRole);
      localStorage.setItem('auth_user', JSON.stringify(cleanUser));
      if (isUserAdmin) {
        localStorage.setItem('admin_auth_token', token);
      }
    }
  }, []);

  const logout = useCallback((redirectTo = '/explore') => {
    api.logout();
    setCurrentUser(null);
    setActiveRoleState('user');
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_role');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('admin_auth_token');
      localStorage.removeItem('plotpin_admin_called_ids');
      localStorage.setItem('auth_role', 'user');
    }
    showToast('👋 Signed out. Switched to normal user mode.');

    // Force hard reload and redirect to ensure clean normal citizen session
    if (typeof window !== 'undefined') {
      window.location.href = redirectTo || '/explore';
    }
  }, [showToast]);

  const requireAuth = useCallback((reason = 'Please sign in with your mobile number to continue') => {
    if (!isLoggedIn) {
      showToast(`🔒 ${reason}`);
      setAuthModalMode('login');
      setShowAuthModal(true);
      return false;
    }
    return true;
  }, [isLoggedIn, showToast]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        isLoggedIn,
        hasAdminPrivilege,
        isAdmin,
        activeRole,
        setActiveRole,
        userInitials,
        showAuthModal,
        setShowAuthModal,
        authModalMode,
        setAuthModalMode,
        authResetEmail,
        setAuthResetEmail,
        authResetToken,
        setAuthResetToken,
        authResetOtp,
        setAuthResetOtp,
        showProfileModal,
        setShowProfileModal,
        toastMessage,
        showToast,
        requireAuth,
        loginUser,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

