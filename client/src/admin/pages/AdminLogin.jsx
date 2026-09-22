import React, { useEffect, useState } from 'react';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import axiosInstance from '../../api/axios';
import { useNavigate } from "react-router-dom";

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const checkExistingSession = async () => {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        setCheckingSession(false);
        return;
      }

      try {
        const response = await axiosInstance.get('/admin/me');
        if (response.data?.admin?.id) {
          localStorage.setItem('adminUser', JSON.stringify(response.data.admin));
          navigate('/admin/dashboard', { replace: true });
          return;
        }
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
      } catch {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
      } finally {
        setCheckingSession(false);
      }
    };

    checkExistingSession();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      const response = await axiosInstance.post('/admin/login', {
        email: email.trim(), 
        password,
      });

      const token = response.data.token;
      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminUser', JSON.stringify(response.data.admin));

     
      navigate('/admin/dashboard', { replace: true });
      
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Invalid email or password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestReset = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      const response = await axiosInstance.post('/admin/forgot-password', { email: email.trim() });
      setSuccessMessage(response.data?.message || 'If an admin account exists, a verification code has been sent.');
      setMode('reset');
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'Unable to send reset code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      const response = await axiosInstance.post('/admin/reset-password', {
        email: email.trim(),
        otp,
        password: resetPassword,
      });
      setSuccessMessage(response.data?.message || 'Password updated. You can now log in.');
      setPassword('');
      setOtp('');
      setResetPassword('');
      setMode('login');
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'Unable to reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#f4f5f9] flex items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Checking secure session...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f5f9] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-white rounded-2xl p-8 shadow-[0_10px_25px_rgba(68,61,215,0.05),0_20px_48px_rgba(0,0,0,0.03)]">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary tracking-tight mb-1">
            Ilmi Dunya
          </h1>
          <p className="text-sm font-medium text-slate-500">
            Secure Admin Portal
          </p>
        </div>

        {/* Form */}
        <form onSubmit={mode === 'forgot' ? requestReset : mode === 'reset' ? submitReset : handleSubmit} className="space-y-5">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-semibold text-rose-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
              {successMessage}
            </div>
          )}

          {/* Email Input */}
          <div>
            <label 
              htmlFor="email" 
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ilmidunya.com"
              required
              disabled={isSubmitting}
              autoComplete="email"
              className="w-full px-4 py-3 text-base border border-slate-200 rounded-lg outline-none text-slate-900 placeholder-slate-400 transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-primary/15"
            />
          </div>

          {mode !== 'forgot' && (
          <div>
            <label 
              htmlFor="password" 
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              {mode === 'reset' ? 'New Password' : 'Password'}
            </label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={mode === 'reset' ? resetPassword : password}
                onChange={(e) => mode === 'reset' ? setResetPassword(e.target.value) : setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={mode === 'reset' ? 8 : undefined}
                disabled={isSubmitting}
                autoComplete="current-password"
                className="w-full pl-4 pr-12 py-3 text-base border border-slate-200 rounded-lg outline-none text-slate-900 placeholder-slate-400 transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-primary/15"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors duration-150"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5 cursor-pointer" strokeWidth={2} />
                ) : (
                  <Eye className="w-5 h-5 cursor-pointer" strokeWidth={2} />
                )}
              </button>
            </div>
          </div>
          )}

          {mode === 'reset' && (
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-slate-700 mb-1.5">Verification Code</label>
              <input
                id="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit code"
                required
                inputMode="numeric"
                className="w-full px-4 py-3 text-base border border-slate-200 rounded-lg outline-none text-slate-900 placeholder-slate-400 transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-primary/15"
              />
            </div>
          )}

          {/* Login Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-primary hover:bg-primary-dark active:bg-[var(--color-primary-dark)] text-white font-semibold rounded-lg transition-colors duration-200 shadow-sm shadow-primary/20 mt-2 disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Please wait...' : mode === 'forgot' ? 'Send Reset Code' : mode === 'reset' ? 'Reset Password' : 'Log In'}
          </button>
          <div className="flex items-center justify-between text-sm font-semibold">
            {mode === 'login' ? (
              <button type="button" onClick={() => { setMode('forgot'); setErrorMessage(''); setSuccessMessage(''); }} className="text-primary hover:text-primary-dark">
                Forgot password?
              </button>
            ) : (
              <button type="button" onClick={() => { setMode('login'); setErrorMessage(''); setSuccessMessage(''); }} className="text-primary hover:text-primary-dark">
                Back to login
              </button>
            )}
            {mode === 'reset' && (
              <button type="button" onClick={() => setMode('forgot')} className="text-slate-500 hover:text-slate-700">
                Resend code
              </button>
            )}
          </div>
        </form>

      </div>
    </div>
  );
}
