import React, { useState } from 'react';
import {
  Building2,
  ShieldCheck,
  Package,
  Layers,
  Smartphone,
  AlertCircle,
  LogIn,
} from 'lucide-react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase/config';

interface SignInScreenProps {
  onSignedIn?: () => void;
}

export const SignInScreen: React.FC<SignInScreenProps> = ({ onSignedIn }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      if (onSignedIn) onSignedIn();
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      if (err.code === 'auth/popup-blocked') {
        setErrorMessage(
          'Popup was blocked by your browser. Please allow popups for this site to sign in with Google.'
        );
      } else if (err.code === 'auth/popup-closed-by-user') {
        setErrorMessage('Sign-in cancelled. Please click the button again to continue.');
      } else {
        setErrorMessage(err.message || 'Google authentication failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 sm:p-6 text-center animate-in fade-in duration-300">
      <div className="w-full max-w-sm space-y-6 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
        {/* App Logo & Identity */}
        <div className="flex flex-col items-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-teal-600 to-emerald-400 flex items-center justify-center text-slate-950 font-black text-2xl shadow-xl shadow-teal-500/25 border border-teal-300/30">
            SP
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
            StockPulse
          </h1>
          <p className="text-xs text-teal-400 font-semibold tracking-wide uppercase">
            Multi-Branch Inventory Manager
          </p>
          <div className="text-[11px] text-slate-400 max-w-xs">
            Apex Auto Parts & Hardware • Native Android & Cloud Firestore
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="space-y-2.5 text-left text-xs bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 text-slate-300">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-4 h-4 text-teal-400 flex-shrink-0" />
            <span>Multi-Branch Stock Isolation (Central, Downtown, Westside)</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-sky-400 flex-shrink-0" />
            <span>Atomic Sales with Idempotency Protection</span>
          </div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Role-Based Access: Owner, Manager, Staff</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>Real Android Push Notifications via FCM</span>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 bg-rose-950/60 border border-rose-600/50 rounded-xl text-rose-200 text-xs flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Sign In Button */}
        <div className="space-y-3 pt-1">
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full py-3.5 px-4 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xl shadow-teal-900/40 flex items-center justify-center gap-3 transition-all active:scale-95 border border-teal-400/30"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                {/* Google Icon SVG */}
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 22.3 12 23z"
                  />
                </svg>
                <span>Sign In with Google</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-slate-500">
            Sign in with authorized business Google account (<code className="text-teal-400">dash93188@gmail.com</code> for Owner access)
          </p>
        </div>
      </div>
    </div>
  );
};
