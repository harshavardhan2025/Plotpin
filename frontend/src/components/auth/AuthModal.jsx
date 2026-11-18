import React, { useState, useEffect } from 'react';
import { 
  X, Phone, Lock, Eye, EyeOff, User, ArrowRight, ShieldCheck, ShieldAlert,
  Sparkles, CheckCircle2, AlertCircle, Loader2, Mail, KeyRound,
  ArrowLeft
} from 'lucide-react';
import PlotPinLogo from '../common/PlotPinLogo';
import { api } from '../../lib/api';

export default function AuthModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  initialMode = 'login',
  initialEmail = '',
  initialToken = '',
  initialOtp = '',
  isMobile = false 
}) {
  if (!isOpen) return null;

  const [mode, setMode] = useState(initialMode === 'reset' ? 'forgot' : initialMode); // 'login' | 'signup' | 'forgot'
  
  // Login State
  const [loginIdentifier, setLoginIdentifier] = useState(initialEmail || '');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Signup State
  const [signupStep, setSignupStep] = useState(1); // 1 = Details, 2 = Email OTP Code
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState(initialEmail || '');
  const [signupMobile, setSignupMobile] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupOtp, setSignupOtp] = useState(initialOtp || '');
  const [mobileStatus, setMobileStatus] = useState({ checking: false, checked: false, available: true, error: null });

  // Forgot Password State
  const [forgotStep, setForgotStep] = useState(initialMode === 'reset' || initialToken || initialOtp ? 2 : 1);
  const [forgotEmail, setForgotEmail] = useState(initialEmail || '');
  const [forgotOtp, setForgotOtp] = useState(initialOtp || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Common UI State
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 60s cooldown timer
  useEffect(() => {
    let interval = null;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendCooldown]);

  useEffect(() => {
    if (initialMode) {
      if (initialMode === 'reset') {
        setMode('forgot');
        setForgotStep(2);
      } else {
        setMode(initialMode);
      }
    }
    if (initialEmail) {
      setForgotEmail(initialEmail);
      setSignupEmail(initialEmail);
      setLoginIdentifier(initialEmail);
    }
    if (initialOtp) {
      setForgotOtp(initialOtp);
      setSignupOtp(initialOtp);
      setForgotStep(2);
    }
  }, [initialMode, initialEmail, initialToken, initialOtp]);

  const isValidEmail = (email) => {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test((email || '').trim());
  };

  const formatMobileDisplay = (val) => {
    return (val || '').replace(/\D/g, '').slice(0, 10);
  };

  // Real-time mobile availability check
  const checkMobileAvailability = async (mobileVal, emailVal) => {
    const clean = (mobileVal || '').replace(/\D/g, '').slice(-10);
    if (!clean || clean.length < 10) {
      setMobileStatus({ checking: false, checked: false, available: true, error: null });
      return;
    }
    setMobileStatus(prev => ({ ...prev, checking: true }));
    try {
      const res = await api.checkMobile(clean, emailVal);
      if (res && res.available === false) {
        setMobileStatus({
          checking: false,
          checked: true,
          available: false,
          error: res.error || 'Mobile already registered. Sign in or use another number.'
        });
      } else {
        setMobileStatus({
          checking: false,
          checked: true,
          available: true,
          error: null
        });
      }
    } catch (err) {
      if (err.code === 'MOBILE_ALREADY_EXISTS') {
        setMobileStatus({
          checking: false,
          checked: true,
          available: false,
          error: err.message || 'Mobile already registered. Sign in or use another number.'
        });
      } else {
        setMobileStatus({ checking: false, checked: false, available: true, error: null });
      }
    }
  };

  // --------------------------------------------------------------------------
  // LOGIN FLOW (Email OR 10-Digit Mobile + Same Password)
  // --------------------------------------------------------------------------
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const query = loginIdentifier.trim();
    if (!query) {
      setErrorMsg('Please enter your email address or 10-digit mobile number.');
      return;
    }

    if (!loginPassword) {
      setErrorMsg('Please enter your password.');
      return;
    }

    const isEmail = query.includes('@');
    const cleanMobile = !isEmail ? query.replace(/\D/g, '').slice(-10) : undefined;

    if (!isEmail && (!cleanMobile || cleanMobile.length < 10)) {
      setErrorMsg('Please enter a valid 10-digit mobile number or email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.login({
        identifier: query,
        email: isEmail ? query.toLowerCase() : undefined,
        mobile: cleanMobile,
        password: loginPassword
      });

      setSuccessMsg(`Welcome back, ${res.user?.name || 'Citizen'}!`);
      setTimeout(() => {
        if (onSuccess) onSuccess(res.user, res.token);
        onClose();
      }, 600);
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED' || (err.message && err.message.toLowerCase().includes('not been verified'))) {
        setErrorMsg('Your email has not been verified yet. Please enter the 6-digit code or reset your password.');
      } else {
        setErrorMsg(err.message || 'Invalid email/mobile or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // SIGNUP STEP 1: Validate Details & Dispatch Email OTP
  // --------------------------------------------------------------------------
  const handleSignupStep1 = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanName = signupName.trim();
    if (!cleanName) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    const cleanEmail = signupEmail.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setErrorMsg('Please enter a valid email address (e.g. name@domain.com).');
      return;
    }

    const cleanMobile = signupMobile.replace(/\D/g, '').slice(-10);
    if (!cleanMobile || cleanMobile.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (mobileStatus.checked && !mobileStatus.available) {
      setErrorMsg(mobileStatus.error || 'This mobile number is already registered to another account. Please log in or use another number.');
      return;
    }

    if (!signupPassword || signupPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.sendEmailVerificationOtp({
        email: cleanEmail,
        mobile: cleanMobile,
        name: cleanName,
        password: signupPassword
      });

      if (res.alreadyVerified || res.state === 'VERIFIED_PROFILE_MISSING') {
        // If already verified in this session, immediately complete registration
        const regRes = await api.register({
          name: cleanName,
          email: cleanEmail,
          mobile: cleanMobile,
          password: signupPassword
        });
        setSuccessMsg(`Account created successfully! Welcome to PlotPin, ${regRes.user?.name || cleanName}!`);
        setTimeout(() => {
          if (onSuccess) onSuccess(regRes.user, regRes.token);
          onClose();
        }, 700);
        return;
      }

      setSignupStep(2);
      setResendCooldown(60);
      setSuccessMsg(`A 6-digit verification code has been sent to ${cleanEmail}. Please check your inbox.`);
    } catch (err) {
      if (err.code === 'MOBILE_ALREADY_EXISTS' || (err.message && err.message.toLowerCase().includes('mobile number already exists'))) {
        setMobileStatus({
          checking: false,
          checked: true,
          available: false,
          error: 'This mobile number is already registered to another account. Please log in or use another number.'
        });
        setErrorMsg('This mobile number is already registered to another account. Please log in or use another number.');
      } else if (err.code === 'EMAIL_ALREADY_EXISTS' || (err.message && err.message.toLowerCase().includes('email address already exists'))) {
        setErrorMsg('An account with this email address already exists. Please log in instead.');
      } else {
        setErrorMsg(err.message || 'Failed to dispatch verification code. Please check your details.');
      }
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // SIGNUP STEP 2: Enter Email OTP & Complete Account Creation
  // --------------------------------------------------------------------------
  const handleSignupStep2 = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanEmail = signupEmail.trim().toLowerCase();
    const cleanMobile = signupMobile.replace(/\D/g, '').slice(-10);
    const cleanCode = signupOtp.replace(/\D/g, '').slice(0, 6);

    if (!cleanCode || cleanCode.length < 6) {
      setErrorMsg('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.register({
        name: signupName.trim() || cleanEmail.split('@')[0],
        email: cleanEmail,
        mobile: cleanMobile,
        password: signupPassword,
        otp: cleanCode
      });

      setSuccessMsg(`Account created successfully! Welcome to PlotPin, ${res.user?.name || 'Citizen'}!`);
      setTimeout(() => {
        if (onSuccess) onSuccess(res.user, res.token);
        onClose();
      }, 700);
    } catch (err) {
      if (err.code === 'INVALID_OTP' || (err.message && err.message.toLowerCase().includes('verification code'))) {
        setErrorMsg('Invalid or expired verification code. Please check your code or click Resend.');
      } else if (err.code === 'MOBILE_ALREADY_EXISTS') {
        setErrorMsg('This mobile number is already registered to another account. Please log in or use another number.');
        setSignupStep(1);
      } else {
        setErrorMsg(err.message || 'Registration failed. Please check your code or try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendSignupOtp = async () => {
    const cleanEmail = signupEmail.trim().toLowerCase();
    const cleanMobile = signupMobile.replace(/\D/g, '').slice(-10);

    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.sendEmailVerificationOtp({
        email: cleanEmail,
        mobile: cleanMobile || undefined,
        name: signupName.trim() || undefined,
        password: signupPassword || undefined
      });
      setResendCooldown(60);
      setSuccessMsg(`A fresh 6-digit verification code has been dispatched to ${cleanEmail}.`);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to resend code. Please wait a moment and try again.');
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // FORGOT PASSWORD FLOW (Email OTP -> New Password)
  // --------------------------------------------------------------------------
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setErrorMsg('Please enter a valid registered email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.sendPasswordResetOtp(cleanEmail);
      setForgotStep(2);
      setResendCooldown(60);
      setSuccessMsg(res.message || `A 6-digit password reset code has been sent to ${cleanEmail}. Please check your inbox.`);
    } catch (err) {
      setErrorMsg(err.message || 'Unable to send password reset code. Please check your email.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetWithOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setErrorMsg('Please enter a valid registered email address.');
      return;
    }

    const cleanOtp = forgotOtp.replace(/\D/g, '').slice(0, 6);
    if (!cleanOtp || cleanOtp.length < 6) {
      setErrorMsg('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.resetPassword({
        email: cleanEmail,
        otp: cleanOtp,
        newPassword
      });

      setSuccessMsg(res.message || 'Password successfully updated! Logging you in...');
      setTimeout(() => {
        if (onSuccess) onSuccess(res.user, res.token);
        onClose();
      }, 700);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update password. Please check your verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Hero */}
        <div className="relative bg-[#184631] p-5 text-white flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <PlotPinLogo size={32} showText={false} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white">PlotPin</span>
                <span className="text-[10px] bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 font-bold px-2 py-0.5 rounded-full">
                  Unified Account
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 font-medium">
                {mode === 'login' 
                  ? 'Sign in with your verified email or mobile' 
                  : mode === 'signup' 
                    ? 'Create your direct buyer & seller account' 
                    : 'Recover your account password'}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-95 cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs (Login vs Signup) */}
        {mode !== 'forgot' && (
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-1.5 gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => { setMode('login'); setErrorMsg(''); setSuccessMsg(''); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-900 text-[#184631] dark:text-emerald-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Log In</span>
            </button>

            <button
              type="button"
              onClick={() => { setMode('signup'); setSignupStep(1); setErrorMsg(''); setSuccessMsg(''); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white dark:bg-slate-900 text-[#184631] dark:text-emerald-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sign Up</span>
            </button>
          </div>
        )}

        {/* Status Alerts */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="flex-1">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="flex-1">{successMsg}</span>
          </div>
        )}

        {/* Scrollable Form Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {mode === 'login' ? (
            /* =========================================================
               LOGIN FORM (Email OR Mobile + Same Password)
               ========================================================= */
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Identifier Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Email or Mobile Number
                </label>
                <div className="flex items-center rounded-2xl border border-slate-300 dark:border-slate-700 focus-within:border-[#184631] dark:focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-600/10 transition-all bg-white dark:bg-slate-800/80 overflow-hidden shadow-2xs px-3">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="Enter your email or 10-digit mobile"
                    className="flex-1 px-2.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none min-w-0 bg-transparent"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setForgotStep(1); setErrorMsg(''); setSuccessMsg(''); }}
                    className="text-[10.5px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="flex items-center rounded-2xl border border-slate-300 dark:border-slate-700 focus-within:border-[#184631] dark:focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-600/10 transition-all bg-white dark:bg-slate-800/80 overflow-hidden shadow-2xs px-3">
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="flex-1 px-2.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none min-w-0 bg-transparent"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(prev => !prev)}
                    className="text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
                    title={showLoginPassword ? "Hide password" : "Show password"}
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-2xl bg-[#184631] hover:bg-[#123625] active:scale-[0.98] text-white font-extrabold text-sm transition-all shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">Don't have an account yet? </span>
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setSignupStep(1); setErrorMsg(''); setSuccessMsg(''); }}
                  className="text-xs font-bold text-[#184631] dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Create one now
                </button>
              </div>
            </form>
          ) : mode === 'signup' ? (
            /* =========================================================
               SIGNUP WIZARD: STEP 1 (Details) vs STEP 2 (Email OTP)
               ========================================================= */
            signupStep === 1 ? (
              <form onSubmit={handleSignupStep1} className="space-y-3.5">
                {/* Full Legal Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Full Legal Name</label>
                  <div className="flex items-center rounded-2xl border border-slate-300 dark:border-slate-700 focus-within:border-[#184631] dark:focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-600/10 transition-all bg-white dark:bg-slate-800/80 overflow-hidden shadow-2xs px-3">
                    <User className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      placeholder="e.g. Vikramaditya Rao"
                      className="flex-1 px-2.5 py-2 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none min-w-0 bg-transparent"
                      required
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Email Address <span className="text-[10px] text-slate-400 font-normal">(OTP verification will be sent here)</span>
                  </label>
                  <div className="flex items-center rounded-2xl border border-slate-300 dark:border-slate-700 focus-within:border-[#184631] dark:focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-600/10 transition-all bg-white dark:bg-slate-800/80 overflow-hidden shadow-2xs px-3">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="flex-1 px-2.5 py-2 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none min-w-0 bg-transparent"
                      required
                    />
                  </div>
                </div>

                {/* 10-Digit Mobile Number (Single Unique Phone per User) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Primary Mobile Number
                    </label>
                    {mobileStatus.checking ? (
                      <span className="text-[10px] text-slate-500 flex items-center gap-1 font-semibold">
                        <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                        Checking...
                      </span>
                    ) : mobileStatus.checked && !mobileStatus.available ? (
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 px-2 py-0.5 rounded-full flex items-center gap-1 animate-in fade-in">
                        <AlertCircle className="w-3 h-3 text-red-600" />
                        Already Registered
                      </span>
                    ) : mobileStatus.checked && mobileStatus.available ? (
                      <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1 animate-in fade-in">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Available &amp; Valid
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">10 digits • 1 per account</span>
                    )}
                  </div>
                  <div className={`flex items-center rounded-2xl border transition-all bg-white dark:bg-slate-800/80 overflow-hidden shadow-2xs ${
                    mobileStatus.checked && !mobileStatus.available
                      ? 'border-red-400 ring-2 ring-red-400/10'
                      : mobileStatus.checked && mobileStatus.available
                        ? 'border-emerald-500 ring-2 ring-emerald-500/10'
                        : 'border-slate-300 dark:border-slate-700 focus-within:border-[#184631] dark:focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-600/10'
                  }`}>
                    <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 border-r border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 shrink-0 select-none">
                      <span>🇮🇳</span>
                      <span>+91</span>
                    </div>
                    <input
                      type="tel"
                      value={signupMobile}
                      onChange={(e) => {
                        const val = formatMobileDisplay(e.target.value);
                        setSignupMobile(val);
                        if (val.length === 10) {
                          checkMobileAvailability(val, signupEmail);
                        } else {
                          setMobileStatus({ checking: false, checked: false, available: true, error: null });
                        }
                      }}
                      onBlur={() => {
                        if (signupMobile && signupMobile.length === 10) {
                          checkMobileAvailability(signupMobile, signupEmail);
                        }
                      }}
                      placeholder="10-digit mobile number"
                      maxLength={10}
                      className="flex-1 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none min-w-0 bg-transparent"
                      required
                    />
                    <div className="pr-3 text-slate-400">
                      {mobileStatus.checked && !mobileStatus.available ? (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      ) : mobileStatus.checked && mobileStatus.available ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Phone className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                  {mobileStatus.checked && !mobileStatus.available && (
                    <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-rose-700 dark:text-rose-400 mt-1 px-1 animate-in fade-in">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span>
                        Mobile already registered. <button type="button" onClick={() => { setMode('login'); setLoginIdentifier(signupMobile); setErrorMsg(''); }} className="font-bold underline hover:text-rose-900 dark:hover:text-rose-200 cursor-pointer">Sign in</button> or use another number.
                      </span>
                    </div>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Password</span>
                    <span className="text-[10px] text-slate-400">Min. 6 characters</span>
                  </label>
                  <div className="flex items-center rounded-2xl border border-slate-300 dark:border-slate-700 focus-within:border-[#184631] dark:focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-600/10 transition-all bg-white dark:bg-slate-800/80 overflow-hidden shadow-2xs px-3">
                    <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type={showSignupPassword ? 'text' : 'password'}
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="Create a password"
                      className="flex-1 px-2.5 py-2 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none min-w-0 bg-transparent"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(prev => !prev)}
                      className="text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
                    >
                      {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Confirm Password</label>
                  <div className="flex items-center rounded-2xl border border-slate-300 dark:border-slate-700 focus-within:border-[#184631] dark:focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-600/10 transition-all bg-white dark:bg-slate-800/80 overflow-hidden shadow-2xs px-3">
                    <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type={showSignupPassword ? 'text' : 'password'}
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="flex-1 px-2.5 py-2 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none min-w-0 bg-transparent"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                {/* Unified Buyer & Seller Guarantee */}
                <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-xl p-2.5 border border-emerald-200/80 dark:border-emerald-800 flex items-start gap-2 text-[11px] text-emerald-900 dark:text-emerald-300 font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Single Unified Account:</strong> Buy, sell, inspect, and list properties with 0% brokerage under one verified login.
                  </span>
                </div>

                {/* Continue Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-4 rounded-2xl bg-[#184631] hover:bg-[#123625] active:scale-[0.98] text-white font-extrabold text-sm transition-all shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending verification code...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue &amp; Send Verification Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Already registered? </span>
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setErrorMsg(''); setSuccessMsg(''); }}
                    className="text-xs font-bold text-[#184631] dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Log In
                  </button>
                </div>
              </form>
            ) : (
              /* STEP 2: ENTER 6-DIGIT EMAIL CODE */
              <form onSubmit={handleSignupStep2} className="space-y-4 animate-in fade-in">
                <div className="text-left space-y-1">
                  <button
                    type="button"
                    onClick={() => { setSignupStep(1); setErrorMsg(''); setSuccessMsg(''); }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Edit details</span>
                  </button>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-[#184631] dark:text-emerald-400" />
                    <span>Verify Your Email Address</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    A 6-digit verification code has been dispatched to <strong className="text-slate-800 dark:text-slate-200">{signupEmail}</strong>.
                  </p>
                </div>

                {/* 6-Digit Code Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Enter 6-Digit Code</label>
                    <button
                      type="button"
                      onClick={handleResendSignupOtp}
                      disabled={resendCooldown > 0 || loading}
                      className="text-[11px] text-[#184631] dark:text-emerald-400 hover:underline font-bold disabled:text-slate-400 cursor-pointer"
                    >
                      {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Code'}
                    </button>
                  </div>
                  <div className="flex items-center rounded-2xl border border-slate-300 dark:border-slate-700 focus-within:border-[#184631] dark:focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-600/10 transition-all bg-white dark:bg-slate-800/80 overflow-hidden shadow-2xs px-3">
                    <KeyRound className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      maxLength={6}
                      value={signupOtp}
                      onChange={(e) => setSignupOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="• • • • • •"
                      className="flex-1 px-2.5 py-3 text-center font-mono font-extrabold tracking-widest text-base sm:text-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none min-w-0 bg-transparent"
                      required
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 px-0.5">
                    Code expires in 10 minutes. Check your inbox and spam folder.
                  </p>
                </div>

                {/* Complete Registration Button */}
                <button
                  type="submit"
                  disabled={loading || signupOtp.trim().length < 6}
                  className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-[#184631] hover:bg-[#123625] active:scale-[0.98] text-white font-extrabold text-sm transition-all shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating your account...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Complete Registration &amp; Sign In</span>
                    </>
                  )}
                </button>
              </form>
            )
          ) : (
            /* =========================================================
               FORGOT PASSWORD FLOW (Step 1: Email -> Step 2: OTP + New Password)
               ========================================================= */
            forgotStep === 1 ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="text-left space-y-1">
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setErrorMsg(''); setSuccessMsg(''); }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to login</span>
                  </button>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">Reset your password</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Enter your registered email address to receive a secure 6-digit verification code.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Registered Email Address</label>
                  <div className="flex items-center rounded-2xl border border-slate-300 dark:border-slate-700 focus-within:border-[#184631] dark:focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-600/10 transition-all bg-white dark:bg-slate-800/80 overflow-hidden shadow-2xs px-3">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="flex-1 px-2.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none min-w-0 bg-transparent"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-2xl bg-[#184631] hover:bg-[#123625] active:scale-[0.98] text-white font-extrabold text-sm transition-all shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending reset code...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Send 6-Digit Reset Code</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Step 2: Enter 6-Digit OTP + Set New Password */
              <form onSubmit={handleResetWithOtp} className="space-y-3.5 animate-in fade-in">
                <div className="text-left space-y-1">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setForgotStep(1)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Change email</span>
                    </button>
                    <span className="text-[11px] font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 truncate max-w-[170px]">
                      {forgotEmail}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">Set New Password</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Enter the 6-digit code dispatched to your email along with your new password.
                  </p>
                </div>

                {/* 6-Digit OTP */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">6-Digit Code</label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={resendCooldown > 0 || loading}
                      className="text-[11px] text-[#184631] dark:text-emerald-400 hover:underline font-bold disabled:text-slate-400 cursor-pointer"
                    >
                      {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Code'}
                    </button>
                  </div>
                  <div className="flex items-center rounded-2xl border border-slate-300 dark:border-slate-700 focus-within:border-[#184631] dark:focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-600/10 transition-all bg-white dark:bg-slate-800/80 overflow-hidden shadow-2xs px-3">
                    <KeyRound className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      maxLength={6}
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="• • • • • •"
                      className="flex-1 px-2.5 py-2.5 text-center font-mono font-extrabold tracking-widest text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none min-w-0 bg-transparent"
                      required
                    />
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">New Password</label>
                  <div className="flex items-center rounded-2xl border border-slate-300 dark:border-slate-700 focus-within:border-[#184631] dark:focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-600/10 transition-all bg-white dark:bg-slate-800/80 overflow-hidden shadow-2xs px-3">
                    <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="flex-1 px-2.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none min-w-0 bg-transparent"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Confirm New Password</label>
                  <div className="flex items-center rounded-2xl border border-slate-300 dark:border-slate-700 focus-within:border-[#184631] dark:focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-600/10 transition-all bg-white dark:bg-slate-800/80 overflow-hidden shadow-2xs px-3">
                    <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="flex-1 px-2.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none min-w-0 bg-transparent"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-2xl bg-[#184631] hover:bg-[#123625] active:scale-[0.98] text-white font-extrabold text-sm transition-all shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Updating password...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Update Password &amp; Log In</span>
                    </>
                  )}
                </button>
              </form>
            )
          )}
        </div>
      </div>
    </div>
  );
}
