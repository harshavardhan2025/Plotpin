import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Unified Login Redirector:
 * Eliminates separate administrator login screen.
 * All users and administrators authenticate through the unified AuthModal dialog.
 */
export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { isAdmin, setShowAuthModal, setAuthModalMode } = useAuth();

  useEffect(() => {
    if (isAdmin) {
      navigate('/admin/verifications', { replace: true });
    } else {
      setAuthModalMode('login');
      setShowAuthModal(true);
      navigate('/explore', { replace: true });
    }
  }, [isAdmin, navigate, setShowAuthModal, setAuthModalMode]);

  return null;
}
