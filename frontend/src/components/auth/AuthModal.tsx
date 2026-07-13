import { useEffect, useRef, useState } from "react";
import type { ClipboardEvent, FormEvent, KeyboardEvent } from "react";

import {
  CloseIcon,
  GoogleIcon,
  MailIcon,
  RefreshIcon,
} from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";

export type AuthMode = "login" | "signup";

type AuthStep = "providers" | "email" | "code";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_S = 30;

interface AuthModalProps {
  mode: AuthMode;
  onClose: () => void;
  /** Called once a session is established. */
  onSuccess?: () => void;
}

export function AuthModal({ mode, onClose, onSuccess }: AuthModalProps) {
  const { signInWithGoogle, sendEmailOtp, verifyEmailOtp } = useAuth();

  const [step, setStep] = useState<AuthStep>("providers");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const emailRef = useRef<HTMLInputElement>(null);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (step === "email") emailRef.current?.focus();
    if (step === "code") codeRefs.current[0]?.focus();
  }, [step]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const title =
    step === "code"
      ? "Enter confirmation code"
      : mode === "login"
        ? "Welcome back"
        : "Create your account";

  const sendCode = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await sendEmailOtp(email.trim());
      setCode(Array(CODE_LENGTH).fill(""));
      setCooldown(RESEND_COOLDOWN_S);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!submitting) void sendCode();
  };

  const verify = async (fullCode: string) => {
    setError(null);
    setSubmitting(true);
    try {
      await verifyEmailOtp(email.trim(), fullCode);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code. Try again.");
      setCode(Array(CODE_LENGTH).fill(""));
      codeRefs.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCodeSubmit = (e: FormEvent) => {
    e.preventDefault();
    const full = code.join("");
    if (full.length === CODE_LENGTH && !submitting) void verify(full);
  };

  const setDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setCode((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < CODE_LENGTH - 1) codeRefs.current[index + 1]?.focus();
  };

  const handleCodeKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    e.preventDefault();
    const digits = pasted.slice(0, CODE_LENGTH).split("");
    setCode(Array.from({ length: CODE_LENGTH }, (_, i) => digits[i] ?? ""));
    const last = Math.min(digits.length, CODE_LENGTH) - 1;
    codeRefs.current[last]?.focus();
    if (digits.length === CODE_LENGTH && !submitting) void verify(digits.join(""));
  };

  const handleGoogle = async () => {
    setError(null);
    try {
      await signInWithGoogle();
      // Full-page redirect follows; nothing else to do here.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="auth-modal__close"
          onClick={onClose}
          aria-label="Close"
        >
          <CloseIcon aria-hidden="true" />
        </button>

        <h2 id="auth-title" className="auth-modal__title">
          {title}
        </h2>
        {step !== "code" && (
          <p className="auth-modal__subtitle">
            {mode === "login"
              ? "Sign in to access your lead dashboard."
              : "Start pulling qualified leads in minutes."}
          </p>
        )}
        {step === "code" && (
          <p className="auth-modal__subtitle">
            We sent a 6-digit code to <strong>{email}</strong>. Check your spam
            folder if you don't see it.
          </p>
        )}

        {step === "providers" && (
          <div className="auth-modal__providers">
            <button
              type="button"
              className="auth-btn auth-btn--google"
              onClick={() => void handleGoogle()}
            >
              <GoogleIcon className="auth-btn__icon" aria-hidden="true" />
              Continue with Google
            </button>
            <button
              type="button"
              className="auth-btn auth-btn--email"
              onClick={() => setStep("email")}
            >
              <MailIcon className="auth-btn__icon" aria-hidden="true" />
              Continue with email
            </button>
          </div>
        )}

        {step === "email" && (
          <form className="auth-modal__form" onSubmit={handleEmailSubmit}>
            <div className="auth-email">
              <MailIcon className="auth-email__icon" aria-hidden="true" />
              <input
                ref={emailRef}
                type="email"
                className="auth-email__input"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                aria-label="Email address"
                required
              />
            </div>
            <button
              type="submit"
              className="auth-btn auth-btn--continue"
              disabled={submitting || !email.trim()}
            >
              {submitting ? "Sending…" : "Continue"}
            </button>
          </form>
        )}

        {step === "code" && (
          <form className="auth-modal__form" onSubmit={handleCodeSubmit}>
            <div
              className="code-row"
              role="group"
              aria-label="6-digit confirmation code"
            >
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    codeRefs.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  className="code-input"
                  value={digit}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(i, e)}
                  onPaste={handleCodePaste}
                  aria-label={`Digit ${i + 1}`}
                />
              ))}
            </div>

            <button
              type="submit"
              className="auth-btn auth-btn--primary"
              disabled={submitting || code.join("").length !== CODE_LENGTH}
            >
              {submitting ? "Verifying…" : "Continue"}
            </button>

            <div className="auth-modal__code-actions">
              <button
                type="button"
                className="auth-link"
                onClick={() => void sendCode()}
                disabled={cooldown > 0 || submitting}
              >
                <RefreshIcon aria-hidden="true" />
                {cooldown > 0 ? `Wait ${cooldown}s` : "Resend code"}
              </button>
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  setError(null);
                  setStep("email");
                }}
              >
                <MailIcon aria-hidden="true" />
                Change email
              </button>
            </div>
          </form>
        )}

        {error && (
          <p className="auth-modal__error" role="alert">
            {error}
          </p>
        )}

        {step !== "code" && (
          <p className="auth-modal__terms">
            By continuing, you agree to the{" "}
            <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.
          </p>
        )}
      </div>
    </div>
  );
}
