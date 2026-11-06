"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Lock, Mail, User, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/app/lib/supabase/browser";
import { BRAND_LOGO } from "@/app/lib/productImages";
import LoadingButton from "./LoadingButton";
import SignupOtpModal from "./SignupOtpModal";
import { parseJsonResponse } from "@/app/lib/fetchJson";
import { sanitizeOtpInput, otpFromClipboardEvent } from "@/app/lib/otpInput";

function getGoogleAuthErrorMessage(auth, reason) {
  if (auth === "signup_required") {
    return "No account found with this email. Please sign up before signing in.";
  }
  if (auth !== "error") return "";

  switch (reason) {
    case "denied":
      return "Google sign-in was cancelled. Please try again.";
    case "redirect":
      return "Google sign-in failed: redirect URL mismatch. Add your production callback URL in Google Cloud Console.";
    case "config":
      return "Google sign-in is not configured on the server. Check GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET on Vercel.";
    case "session":
      return "Google account verified, but we could not start your session. Try email sign-in or contact support.";
    case "oauth":
      return "Google sign-in was interrupted. Please try again.";
    default:
      return "Google sign-in failed. Please try again or use email and password.";
  }
}

export default function UserAuthPanel({ onAuthenticated, variant = "page" }) {
  const [mode, setMode] = useState("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [oauthErrorMsg, setOauthErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [signupOtpOpen, setSignupOtpOpen] = useState(false);
  const [signupOtpError, setSignupOtpError] = useState("");
  const [signupOtpSuccess, setSignupOtpSuccess] = useState("");
  const [signupOtpLoading, setSignupOtpLoading] = useState(false);
  const [signupResendLoading, setSignupResendLoading] = useState(false);
  const [pendingSignup, setPendingSignup] = useState(null);

  const isModal = variant === "modal";
  const isForgotFlow = mode.startsWith("forgot-");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const auth = params.get("auth");
    const reason = params.get("reason") || "";
    const message = getGoogleAuthErrorMessage(auth, reason);

    // Always clear Google redirect spinner when this screen loads / returns.
    setGoogleLoading(false);

    if (message) {
      setOauthErrorMsg(message);
      setMode("signin");
    }

    if (auth || reason) {
      params.delete("auth");
      params.delete("reason");
      const query = params.toString();
      const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}`;
      window.history.replaceState({}, document.title, nextUrl);
    }
  }, []);

  // Safari/Firefox restore this page from bfcache after Google back-button —
  // React state (googleLoading) would otherwise stay stuck on "Redirecting…".
  useEffect(() => {
    if (typeof window === "undefined") return;

    const clearGoogleLoading = () => setGoogleLoading(false);

    const onPageShow = (event) => {
      if (event.persisted) clearGoogleLoading();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") clearGoogleLoading();
    };

    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", clearGoogleLoading);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", clearGoogleLoading);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const resetMessages = () => {
    setErrorMsg("");
    setOauthErrorMsg("");
    setSuccessMsg("");
    setSignupOtpError("");
    setSignupOtpSuccess("");
  };

  const closeSignupOtpModal = () => {
    setSignupOtpOpen(false);
    setSignupOtpError("");
    setSignupOtpSuccess("");
    setSignupOtpLoading(false);
    setSignupResendLoading(false);
  };

  const sendSignupVerificationOtp = async ({ fullName, email, password }, { isResend = false } = {}) => {
    const res = await fetch("/api/auth/signup/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
      }),
    });
    const data = await parseJsonResponse(res);
    if (!data.success) {
      throw new Error(data.error || "Could not send verification code.");
    }

    setPendingSignup({
      fullName: fullName.trim(),
      email: email.trim(),
      password,
    });
    setSignupOtpOpen(true);
    setSignupOtpSuccess(
      isResend
        ? "A new verification code has been sent. Use the latest email."
        : "Verification code sent. Check your email."
    );
    setSignupOtpError("");
  };

  const completeSignupAfterOtp = async (otpValue) => {
    if (!pendingSignup) {
      throw new Error("Sign up details expired. Please try again.");
    }

    const res = await fetch("/api/auth/signup/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: pendingSignup.email,
        otp: otpValue,
      }),
    });
    const verifyData = await parseJsonResponse(res);
    if (!verifyData.success) {
      throw new Error(verifyData.error || "Invalid verification code.");
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: pendingSignup.email,
      password: pendingSignup.password,
    });

    if (error) throw error;

    const sessionData = await validateRegisteredSession();
    if (!sessionData.success || !sessionData.registered) {
      await signOutIfUnregistered();
      throw new Error("Account created but profile setup failed. Please try signing in.");
    }

    closeSignupOtpModal();
    setPendingSignup(null);
    setSuccessMsg("Account created successfully!");
    onAuthenticated?.(data.user, { needsPhone: Boolean(sessionData.needsPhone) });
  };

  const validateRegisteredSession = async () => {
    try {
      const res = await fetch("/api/auth/validate-session", {
        method: "POST",
        cache: "no-store",
      });
      return parseJsonResponse(res);
    } catch (err) {
      console.warn("Failed to validate session in UserAuthPanel:", err?.message || err);
      return { success: false, error: err?.message || "Session validation failed." };
    }
  };

  const signOutIfUnregistered = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
  };

  const handleEmailAuth = async (event) => {
    event.preventDefault();
    if (loading) return;

    resetMessages();
    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === "signup") {
        if (!fullName.trim()) {
          setErrorMsg("Please enter your full name.");
          return;
        }
        if (password.length < 6) {
          setErrorMsg("Password must be at least 6 characters.");
          return;
        }
        if (!email.trim() || !email.includes("@")) {
          setErrorMsg("Enter a valid email address.");
          return;
        }

        await sendSignupVerificationOtp({
          fullName,
          email,
          password,
        });
        return;
      }

      const checkRes = await fetch("/api/auth/pre-login-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const checkData = await parseJsonResponse(checkRes);

      if (!checkData.registered) {
        setErrorMsg("No account found. Please sign up before signing in.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      const sessionData = await validateRegisteredSession();
      if (!sessionData.success || !sessionData.registered) {
        await signOutIfUnregistered();
        setErrorMsg(sessionData.error || "No account found. Please sign up before signing in.");
        return;
      }

      setSuccessMsg("Signed in successfully!");
      onAuthenticated?.(data.user, { needsPhone: Boolean(sessionData.needsPhone) });
    } catch (err) {
      const message = err.message || "Authentication failed.";
      if (/after \d+ seconds/i.test(message)) {
        setErrorMsg("Please wait about 20 seconds before trying again.");
      } else {
        setErrorMsg(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetOtp = async (event) => {
    event.preventDefault();
    if (loading) return;

    resetMessages();
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Enter the email linked to your account.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await parseJsonResponse(res);
      if (!data.success) {
        throw new Error(data.error || "Could not send reset code.");
      }
      setSuccessMsg("Reset code sent. Check your email.");
      setMode("forgot-otp");
    } catch (err) {
      setErrorMsg(err.message || "Could not send reset code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyResetOtp = async (event) => {
    event.preventDefault();
    if (loading) return;

    resetMessages();
    const cleanOtp = sanitizeOtpInput(otp);
    setOtp(cleanOtp);
    if (cleanOtp.length !== 6) {
      setErrorMsg("Enter the 6-digit code from your email.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-reset-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp: cleanOtp }),
      });
      const data = await parseJsonResponse(res);
      if (!data.success) {
        throw new Error(data.error || "Invalid OTP.");
      }
      setResetToken(data.resetToken);
      setSuccessMsg("OTP verified. Set your new password.");
      setMode("forgot-reset");
    } catch (err) {
      setErrorMsg(err.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    if (loading) return;

    resetMessages();
    if (newPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          resetToken,
          newPassword,
        }),
      });
      const data = await parseJsonResponse(res);
      if (!data.success) {
        throw new Error(data.error || "Could not update password.");
      }

      setSuccessMsg("Password updated. Sign in with your new password.");
      setPassword("");
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setResetToken("");
      setMode("signin");
    } catch (err) {
      setErrorMsg(err.message || "Could not update password.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySignupOtp = async (otpValue) => {
    if (signupOtpLoading || !pendingSignup) return;

    setSignupOtpError("");
    setSignupOtpSuccess("");
    setSignupOtpLoading(true);

    try {
      await completeSignupAfterOtp(otpValue);
    } catch (err) {
      setSignupOtpError(err.message || "Verification failed.");
    } finally {
      setSignupOtpLoading(false);
    }
  };

  const handleResendSignupOtp = async () => {
    if (signupResendLoading || signupOtpLoading || !pendingSignup) return;

    setSignupOtpError("");
    setSignupOtpSuccess("");
    setSignupResendLoading(true);

    try {
      await sendSignupVerificationOtp(pendingSignup, { isResend: true });
    } catch (err) {
      setSignupOtpError(err.message || "Could not resend verification code.");
    } finally {
      setSignupResendLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    if (googleLoading) return;
    setErrorMsg("");
    setOauthErrorMsg("");
    setGoogleLoading(true);

    const next = encodeURIComponent(
      `${window.location.pathname}${window.location.search || ""}`
    );

    // If navigation is cancelled (back from Google / blocked redirect), clear spinner.
    const safetyTimer = window.setTimeout(() => {
      setGoogleLoading(false);
    }, 12000);

    try {
      window.location.assign(`/api/auth/google/start?next=${next}`);
    } catch {
      window.clearTimeout(safetyTimer);
      setGoogleLoading(false);
    }
  };

  const title =
    mode === "signup"
      ? "Create Account"
      : mode === "forgot-email"
      ? "Forgot Password"
      : mode === "forgot-otp"
      ? "Verify Reset Code"
      : mode === "forgot-reset"
      ? "Set New Password"
      : "Welcome Back";

  const subtitle =
    mode === "signup"
      ? "Sign up with your name, email, and password. We will verify your email with a one-time code."
      : mode === "forgot-email"
      ? "Enter your account email. We will send a one-time code if the account exists."
      : mode === "forgot-otp"
      ? "Enter the 6-digit code sent to your email."
      : mode === "forgot-reset"
      ? "Choose a new password for your account."
      : "Sign in to manage your profile, delivery address, and orders.";

  return (
    <div className={`user-auth-overlay ${isModal ? "user-auth-overlay-modal" : ""}`}>
      <div className="login-split-card user-auth-card">
        <div className="login-brand-panel">
          <div className="login-logo-ring">
            <Image
              src={BRAND_LOGO}
              alt="THE OH ! logo"
              width={150}
              height={150}
              className="login-logo-img"
              priority
            />
          </div>
        </div>

        <div className="login-form-panel">
          <div className="login-form-inner">
            <div className="login-header-icon">
              <Lock className="icon-gold" size={28} />
            </div>
            <h3>{title}</h3>
            <p className="user-auth-subtitle">{subtitle}</p>

            {(mode === "signin" || mode === "signup") && (
            <form className="user-auth-form" onSubmit={handleEmailAuth} noValidate>
              {mode === "signup" && (
                <div className="user-auth-field">
                  <label htmlFor="user-auth-full-name">Full Name</label>
                  <div className="user-auth-input-shell">
                    <span className="user-auth-icon" aria-hidden="true">
                      <User size={18} />
                    </span>
                    <input
                      id="user-auth-full-name"
                      type="text"
                      className="user-auth-input"
                      placeholder="Your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={loading}
                      autoComplete="name"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="user-auth-field">
                <label htmlFor="user-auth-email">Email</label>
                <div className="user-auth-input-shell">
                  <span className="user-auth-icon" aria-hidden="true">
                    <Mail size={18} />
                  </span>
                  <input
                    id="user-auth-email"
                    type="email"
                    className="user-auth-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="user-auth-field">
                <label htmlFor="user-auth-password">Password</label>
                <div className="user-auth-input-shell">
                  <span className="user-auth-icon" aria-hidden="true">
                    <Lock size={18} />
                  </span>
                  <input
                    id="user-auth-password"
                    type={showPassword ? "text" : "password"}
                    className="user-auth-input"
                    placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="user-auth-toggle-password"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {mode === "signin" && (
                <button
                  type="button"
                  className="user-auth-forgot-link"
                  onClick={() => {
                    resetMessages();
                    setMode("forgot-email");
                  }}
                >
                  Forgot password?
                </button>
              )}

              {errorMsg && <p className="user-auth-error">{errorMsg}</p>}
              {successMsg && <p className="user-auth-success">{successMsg}</p>}

                <div className="auth-submit-wrap">
                  <LoadingButton
                    type="submit"
                    className="btn-primary user-auth-submit-btn"
                    loading={loading}
                    loadingText={mode === "signup" ? "Sending code…" : "Signing in…"}
                  >
                    {mode === "signup" ? "Sign Up" : "Sign In"}
                  </LoadingButton>
                </div>
              </form>
            )}

            {mode === "forgot-email" && (
              <form className="user-auth-form" onSubmit={handleSendResetOtp} noValidate>
                <div className="user-auth-field">
                  <label htmlFor="forgot-email">Email</label>
                  <div className="user-auth-input-shell">
                    <span className="user-auth-icon" aria-hidden="true">
                      <Mail size={18} />
                    </span>
                    <input
                      id="forgot-email"
                      type="email"
                      className="user-auth-input"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      required
                    />
                  </div>
                </div>
                {errorMsg && <p className="user-auth-error">{errorMsg}</p>}
                {successMsg && <p className="user-auth-success">{successMsg}</p>}
                <div className="auth-submit-wrap">
                  <LoadingButton type="submit" className="btn-primary user-auth-submit-btn" loading={loading} loadingText="Sending…">
                    Send Reset Code
                  </LoadingButton>
                </div>
              </form>
            )}

            {mode === "forgot-otp" && (
              <form className="user-auth-form" onSubmit={handleVerifyResetOtp} noValidate>
                <div className="user-auth-field">
                  <label htmlFor="forgot-otp">6-Digit Code</label>
                  <div className="user-auth-input-shell user-auth-input-shell-plain">
                    <input
                      id="forgot-otp"
                      type="text"
                      className="user-auth-input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      enterKeyHint="done"
                      placeholder="Enter code from email"
                      value={otp}
                      onChange={(e) => setOtp(sanitizeOtpInput(e.target.value))}
                      onPaste={(e) => {
                        e.preventDefault();
                        setOtp(otpFromClipboardEvent(e));
                      }}
                      onInput={(e) => {
                        const next = sanitizeOtpInput(e.currentTarget.value);
                        if (next !== otp) setOtp(next);
                      }}
                      disabled={loading}
                      required
                    />
                  </div>
                </div>
                {errorMsg && <p className="user-auth-error">{errorMsg}</p>}
                {successMsg && <p className="user-auth-success">{successMsg}</p>}
                <div className="auth-submit-wrap">
                  <LoadingButton type="submit" className="btn-primary user-auth-submit-btn" loading={loading} loadingText="Verifying…">
                    Verify Code
                  </LoadingButton>
                </div>
              </form>
            )}

            {mode === "forgot-reset" && (
              <form className="user-auth-form" onSubmit={handleResetPassword} noValidate>
                <div className="user-auth-field">
                  <label htmlFor="new-password">New Password</label>
                  <div className="user-auth-input-shell user-auth-input-shell-plain">
                    <input
                      id="new-password"
                      type="password"
                      className="user-auth-input"
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={loading}
                      minLength={6}
                      required
                    />
                  </div>
                </div>
                <div className="user-auth-field">
                  <label htmlFor="confirm-password">Confirm Password</label>
                  <div className="user-auth-input-shell user-auth-input-shell-plain">
                    <input
                      id="confirm-password"
                      type="password"
                      className="user-auth-input"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      minLength={6}
                      required
                    />
                  </div>
                </div>
                {errorMsg && <p className="user-auth-error">{errorMsg}</p>}
                {successMsg && <p className="user-auth-success">{successMsg}</p>}
                <div className="auth-submit-wrap">
                  <LoadingButton type="submit" className="btn-primary user-auth-submit-btn" loading={loading} loadingText="Updating…">
                    Update Password
                  </LoadingButton>
                </div>
              </form>
            )}

            {!isForgotFlow && (
              <>
                <div className="user-auth-divider">
                  <span>or</span>
                </div>

                {oauthErrorMsg && <p className="user-auth-error user-auth-oauth-error">{oauthErrorMsg}</p>}

                <button
                  type="button"
                  className="user-auth-google-btn"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                  aria-busy={googleLoading || undefined}
                >
                  {googleLoading ? (
                    <span className="user-auth-google-spinner" aria-hidden="true" />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  )}
                  <span>{googleLoading ? "Redirecting…" : "Continue with Google"}</span>
                </button>
              </>
            )}

            <p className="user-auth-switch">
              {isForgotFlow ? (
                <>
                  Remember your password?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      resetMessages();
                      setMode("signin");
                    }}
                  >
                    Back to sign in
                  </button>
                </>
              ) : (
                <>
                  {mode === "signup" ? "Already have an account?" : "New to THE OH !?"}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      closeSignupOtpModal();
                      setPendingSignup(null);
                      setMode(mode === "signup" ? "signin" : "signup");
                      resetMessages();
                    }}
                  >
                    {mode === "signup" ? "Sign in" : "Create an account"}
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <SignupOtpModal
        open={signupOtpOpen}
        email={pendingSignup?.email || email}
        loading={signupOtpLoading}
        resendLoading={signupResendLoading}
        errorMsg={signupOtpError}
        successMsg={signupOtpSuccess}
        onClose={closeSignupOtpModal}
        onSubmit={handleVerifySignupOtp}
        onResend={handleResendSignupOtp}
      />

      <style jsx>{`
        .user-auth-overlay {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          min-height: ${isModal ? "auto" : "auto"};
          display: flex;
          align-items: center;
          justify-content: center;
          padding: ${isModal ? "12px" : "16px"};
        }

        .user-auth-overlay-modal .user-auth-card {
          min-height: auto;
        }

        .user-auth-card {
          width: 100%;
          max-width: min(860px, 100%);
          min-height: 0;
          min-width: 0;
          box-sizing: border-box;
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-areas: "brand form";
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid rgba(1, 46, 2, 0.15);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.1);
          background: #fff;
        }

        .login-brand-panel {
          grid-area: brand;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 28px 24px;
          background: linear-gradient(160deg, rgba(1, 46, 2, 0.08) 0%, rgba(255, 255, 255, 0.4) 100%);
          border-right: 1px solid rgba(1, 46, 2, 0.12);
        }

        .login-logo-ring {
          width: 150px;
          height: 150px;
          border-radius: 50%;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
        }

        .login-logo-ring :global(.login-logo-img) {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .login-form-panel {
          grid-area: form;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 28px 24px;
          min-width: 0;
        }

        .login-form-inner {
          width: 100%;
          max-width: 340px;
          min-width: 0;
        }

        .login-header-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(1, 46, 2, 0.08);
          margin-bottom: 12px;
        }

        .login-form-inner h3 {
          margin: 0 0 6px;
          font-size: 22px;
          color: #111;
        }

        .user-auth-subtitle {
          margin: 0 0 18px;
          font-size: 13px;
          line-height: 1.45;
          color: #666;
        }

        .login-form-inner .user-auth-error {
          color: #dc2626;
          font-size: 13px;
          line-height: 1.45;
          margin: 4px 0 14px;
          overflow-wrap: anywhere;
        }

        .user-auth-oauth-error {
          margin: 0 0 12px;
        }

        .login-form-inner .user-auth-success {
          color: #15803d;
          font-size: 13px;
          line-height: 1.45;
          margin: 4px 0 14px;
        }

        /* Safari can put submit above fields when <form> is flex — use block flow. */
        .user-auth-form {
          display: block;
          width: 100%;
        }

        .user-auth-field {
          display: block;
          width: 100%;
          margin-bottom: 14px;
        }

        .user-auth-field label {
          display: block;
          margin-bottom: 6px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #666;
        }

        .user-auth-input-shell {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 44px;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          padding: 0 12px;
          border: 1px solid rgba(0, 0, 0, 0.12);
          border-radius: 10px;
          background: #fafafa;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          box-sizing: border-box;
        }

        .user-auth-input-shell:focus-within {
          border-color: rgba(1, 46, 2, 0.45);
          box-shadow: 0 0 0 3px rgba(1, 46, 2, 0.08);
          background: #fff;
        }

        .user-auth-input-shell-plain {
          padding: 0 14px;
        }

        .user-auth-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #888;
        }

        .user-auth-input {
          flex: 1;
          min-width: 0;
          height: 42px;
          border: none;
          outline: none;
          background: transparent;
          font-size: 14px;
          color: #111;
          padding: 0;
          line-height: 1.4;
          box-shadow: none;
          -webkit-appearance: none;
          appearance: none;
          border-radius: 0;
        }

        .user-auth-input::placeholder {
          color: #999;
        }

        .user-auth-toggle-password {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: none;
          background: transparent;
          color: #666;
          cursor: pointer;
          padding: 4px;
        }

        .user-auth-submit-btn {
          width: 100%;
          justify-content: center;
        }

        .auth-submit-wrap {
          display: block;
          width: 100%;
          margin-top: 8px;
        }

        .auth-submit-wrap :global(button) {
          width: 100%;
          -webkit-appearance: none;
          appearance: none;
          float: none;
        }

        .user-auth-forgot-link {
          display: inline-block;
          margin-top: 4px;
          border: none;
          background: none;
          color: var(--primary-brand, #012e02);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
          padding: 0;
        }

        .user-auth-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 14px 0;
          color: #999;
          font-size: 12px;
        }

        .user-auth-divider::before,
        .user-auth-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: rgba(0, 0, 0, 0.1);
        }

        .user-auth-google-btn {
          width: 100%;
          max-width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          min-height: 46px;
          padding: 0 16px;
          border-radius: 10px;
          border: 1px solid rgba(0, 0, 0, 0.14);
          background: #fff;
          color: #1f2937;
          font-size: 14px;
          font-weight: 600;
          font-family: var(--font-poppins);
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
          box-sizing: border-box;
        }

        .user-auth-google-btn:hover:not(:disabled) {
          background: #f9fafb;
          border-color: rgba(0, 0, 0, 0.2);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .user-auth-google-btn:disabled {
          opacity: 0.75;
          cursor: wait;
        }

        .user-auth-google-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(0, 0, 0, 0.12);
          border-top-color: #4285f4;
          border-radius: 50%;
          animation: user-auth-spin 0.75s linear infinite;
        }

        @keyframes user-auth-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .user-auth-switch {
          margin-top: 14px;
          text-align: center;
          font-size: 13px;
          color: #666;
        }

        .user-auth-switch button {
          border: none;
          background: none;
          color: var(--primary-brand, #012e02);
          font-weight: 700;
          cursor: pointer;
          text-decoration: underline;
        }

        @media (max-width: 768px) {
          .user-auth-overlay {
            align-items: flex-start;
            justify-content: center;
            padding: 0;
          }

          .user-auth-overlay-modal {
            padding: 0;
          }

          .user-auth-card {
            grid-template-columns: 1fr;
            grid-template-areas: "form";
            min-height: auto;
            overflow: visible;
            border-radius: 14px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
          }

          .login-brand-panel {
            display: none;
          }

          .login-form-panel {
            align-items: stretch;
            padding: 14px 14px 16px;
          }

          .login-form-inner {
            max-width: 100%;
          }

          .login-header-icon {
            display: none;
          }

          .login-form-inner h3 {
            font-size: 19px;
            margin-bottom: 4px;
          }

          .user-auth-subtitle {
            font-size: 12px;
            line-height: 1.35;
            margin-bottom: 12px;
          }

          .user-auth-field {
            gap: 4px;
            margin-bottom: 10px;
          }

          .user-auth-field label {
            font-size: 11px;
          }

          .user-auth-input-shell {
            min-height: 40px;
            padding: 0 10px;
          }

          .user-auth-input {
            height: 38px;
            font-size: 16px;
          }

          .auth-submit-wrap {
            margin-top: 4px;
          }

          .user-auth-divider {
            margin: 10px 0;
          }

          .user-auth-google-btn {
            min-height: 42px;
            font-size: 13px;
          }

          .user-auth-switch {
            margin-top: 10px;
            line-height: 1.4;
            font-size: 12px;
          }

          .login-form-inner .user-auth-error,
          .login-form-inner .user-auth-success {
            margin: 2px 0 10px;
            font-size: 12px;
          }

          .user-auth-oauth-error {
            margin: 0 0 10px;
          }
        }

        @media (max-width: 480px) {
          .user-auth-overlay {
            padding: 0;
          }

          .login-form-panel {
            padding: 12px 12px 14px;
          }

          .login-form-inner h3 {
            font-size: 17px;
          }

          .user-auth-subtitle {
            margin-bottom: 10px;
          }

          .user-auth-field {
            margin-bottom: 8px;
          }
        }
      `}</style>
    </div>
  );
}
