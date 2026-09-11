"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Master PIN Forgot Password Modal
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  const router = useRouter();

  // If already logged in, redirect to admin
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push("/admin");
      } else {
        setIsCheckingSession(false);
      }
    };
    checkSession();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw new Error(authError.message);

      if (data.session) {
        router.push("/admin");
      }
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please verify your email and password.");
    } finally {
      setIsLoading(false);
    }
  };

  // Master PIN Verification & Recovery
  const handleVerifyMasterPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");
    setResetMessage("");

    // Get Master PIN from settings in localStorage or fallback to default 9999
    let configuredPin = "9999";
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hotelAadvikSettings");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.masterPin) configuredPin = parsed.masterPin.toString();
        } catch {}
      }
    }

    if (enteredPin.trim() !== configuredPin) {
      setPinError("Incorrect Master PIN! Please check with hotel management.");
      return;
    }

    setPinSuccess(true);
  };

  const handleEmergencyBypass = () => {
    // If master PIN is verified, grant emergency access
    router.push("/admin");
  };

  const handleSendResetEmail = async () => {
    if (!email) {
      setPinError("Please enter your email address in the login box first.");
      return;
    }
    setIsResetting(true);
    setPinError("");
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/admin/settings`,
      });
      if (resetErr) throw resetErr;
      setResetMessage(`Password reset link sent to ${email}. Check your inbox!`);
    } catch (err: any) {
      setPinError(err.message || "Failed to send reset email.");
    } finally {
      setIsResetting(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#C5A059] mb-4"></div>
        <p className="text-slate-400 text-sm font-medium tracking-wide">Securing connection...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0F172A] to-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Background Decorative Ambient Glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-[#C5A059]/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-white/[0.04] backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden relative z-10 animate-in fade-in zoom-in duration-300">
        
        {/* Header with Hotel Logo */}
        <div className="pt-10 pb-6 px-8 text-center border-b border-white/5 flex flex-col items-center">
          <div className="w-18 h-18 bg-white rounded-full flex items-center justify-center mb-4 p-1.5 shadow-xl border-2 border-[#C5A059]/40 relative group">
            <div className="absolute inset-0 rounded-full bg-[#C5A059]/20 blur-sm group-hover:blur-md transition-all"></div>
            <img 
              src="/logo.png" 
              alt="Hotel Logo" 
              className="w-full h-full object-contain rounded-full relative z-10" 
              onError={(e) => { e.currentTarget.style.display = 'none'; }} 
            />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Admin Portal</h1>
          <p className="text-[#C5A059] text-xs font-semibold uppercase tracking-widest mt-1">HOTEL AADVIK INN</p>
        </div>
        
        <div className="p-8">
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl text-xs flex items-start gap-3 animate-in shake">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
                  </svg>
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/10 bg-white/[0.05] text-white placeholder-slate-500 focus:bg-white/[0.08] focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 transition-all outline-none text-sm"
                  placeholder="admin@hotelaadvik.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-xs text-[#C5A059] hover:underline font-semibold"
                >
                  Forgot Password?
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-white/10 bg-white/[0.05] text-white placeholder-slate-500 focus:bg-white/[0.08] focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 transition-all outline-none text-sm font-mono"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-gradient-to-r from-[#C5A059] to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-amber-900/20 active:scale-[0.99]"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-slate-950" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Authenticating...
                </>
              ) : (
                "Sign In to Dashboard"
              )}
            </button>
          </form>
        </div>
      </div>
      
      <a href="/" className="mt-8 flex items-center gap-2 text-xs text-slate-400 hover:text-[#C5A059] transition-colors font-semibold uppercase tracking-wider">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Frontdesk Check-in
      </a>

      {/* Master PIN Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0F172A] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-slate-200">
            
            <button
              onClick={() => {
                setIsForgotModalOpen(false);
                setPinSuccess(false);
                setEnteredPin("");
                setPinError("");
                setResetMessage("");
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 flex items-center justify-center"
            >
              ✕
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-amber-500/10 text-[#C5A059] rounded-2xl flex items-center justify-center mx-auto mb-3 border border-[#C5A059]/20 text-2xl">
                🔐
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">Master PIN Recovery</h3>
              <p className="text-xs text-slate-400 mt-1">
                Enter hotel security Master PIN to recover or bypass login.
              </p>
            </div>

            {pinError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-300 text-xs rounded-xl">
                {pinError}
              </div>
            )}

            {resetMessage && (
              <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl">
                {resetMessage}
              </div>
            )}

            {!pinSuccess ? (
              <form onSubmit={handleVerifyMasterPin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Enter Master PIN
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    required
                    value={enteredPin}
                    onChange={(e) => setEnteredPin(e.target.value)}
                    placeholder="••••"
                    className="w-full text-center tracking-[0.5em] text-2xl font-mono py-3 rounded-xl border border-white/10 bg-white/5 text-white focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 outline-none"
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-500 mt-2 text-center">
                    Default Master PIN: <span className="font-mono text-slate-300">9999</span> (Configurable in Settings)
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#C5A059] hover:bg-amber-600 text-slate-950 font-bold py-3 rounded-xl text-sm transition shadow-md"
                >
                  Verify Master PIN
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-semibold text-center flex items-center justify-center gap-2">
                  <span>✅</span> Master PIN Verified Successfully!
                </div>

                <p className="text-xs text-slate-300 text-center">
                  You have verified identity with Master PIN. Select recovery action:
                </p>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleEmergencyBypass}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg"
                  >
                    <span>🚀</span> Direct Emergency Login
                  </button>

                  <button
                    onClick={handleSendResetEmail}
                    disabled={isResetting}
                    className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-slate-200 font-semibold rounded-xl text-xs transition"
                  >
                    {isResetting ? "Sending..." : "📧 Send Password Reset Link to Email"}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
