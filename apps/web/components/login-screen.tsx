"use client";

import { Eye, EyeOff, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getCompanies, getHealth, login as loginRequest, type CompanyRecord } from "../lib/api";
import { getRoleLabel, type AppRole } from "../lib/erp";
import {
  LOGIN_ADMIN_HELPER_TEXT,
  LOGIN_RESTING_STATUS_MESSAGE,
  LOGIN_TAGLINE,
} from "../lib/login-copy";
import { clearSession, readSession, writeSession } from "../lib/session";
import { BrandLockup } from "./ui/brand-lockup";

type SignedInUser = {
  token: string;
  email: string;
  name: string;
  role: AppRole;
  roles: string[];
};

function resolveUserName(user: { firstName?: string | null; lastName?: string | null; email: string }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

function enterWorkspace(
  router: ReturnType<typeof useRouter>,
  signedInUser: SignedInUser,
  company: CompanyRecord,
) {
  const firstBranch = company.branches[0];

  writeSession({
    token: signedInUser.token,
    companyId: company.id,
    companyName: company.name,
    branchId: firstBranch?.id ?? null,
    branchName: firstBranch?.name ?? "All branches",
    role: signedInUser.role,
    userEmail: signedInUser.email,
    userName: signedInUser.name,
    periodLabel: "Month to Date",
  });

  router.push("/dashboard");
}

export function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(LOGIN_RESTING_STATUS_MESSAGE);
  const [feedbackTone, setFeedbackTone] = useState<"neutral" | "error" | "success">("neutral");
  const [serviceReady, setServiceReady] = useState(true);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [signedInUser, setSignedInUser] = useState<SignedInUser | null>(null);
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaEmail, setMfaEmail] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [mfaTempToken, setMfaTempToken] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);

  const selectedCompany = useMemo(() => companies[0] ?? null, [companies]);

  useEffect(() => {
    void verifyService();

    const session = readSession();
    if (session.token) {
      setSignedInUser({
        token: session.token,
        email: session.userEmail,
        name: session.userName,
        role: session.role,
        roles: [],
      });
      void loadCompanies(session.token, {
        preferredCompanyId: session.companyId ?? undefined,
        autoEnterSingleCompany: true,
      });
    }
  }, [router]);

  async function verifyService() {
    try {
      await getHealth();
      setServiceReady(true);
    } catch {
      setServiceReady(false);
      setFeedbackTone("error");
      setMessage("The workspace is currently unavailable. Please try again shortly.");
    }
  }

  async function loadCompanies(
    token: string,
    options?: { preferredCompanyId?: number; autoEnterSingleCompany?: boolean; signedIn?: SignedInUser },
  ) {
    setBusy(true);
    setFeedbackTone("neutral");
    setMessage("Loading workspace...");

    try {
      const data = await getCompanies(token);
      setCompanies(data);

      const preferred =
        data.find((company) => company.id === options?.preferredCompanyId) ??
        data[0] ??
        null;

      const activeUser = options?.signedIn ?? signedInUser;
      if (preferred && activeUser) {
        setFeedbackTone("success");
        setMessage(`Opening ${preferred.name}...`);
        enterWorkspace(router, activeUser, preferred);
        return;
      }

      setFeedbackTone(data.length > 0 ? "success" : "neutral");
      setMessage(
        data.length > 0
          ? "Opening workspace..."
          : "No companies are available for this account yet.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not load companies.";
      const lowered = message.toLowerCase();
      const authFailed =
        /\b401\b/.test(message) ||
        lowered.includes("unauthorized") ||
        lowered.includes("jwt") ||
        lowered.includes("token");

      if (authFailed) {
        clearSession();
        setSignedInUser(null);
      }

      setFeedbackTone("error");
      setMessage(authFailed ? "Your session has expired. Please sign in again." : message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password.trim()) {
      setFeedbackTone("error");
      setMessage("Enter your email address and password to continue.");
      return;
    }

    setBusy(true);
    setFeedbackTone("neutral");
    setMessage("Signing in...");

    try {
      if (!serviceReady) {
        await verifyService();
      }

      const data = await loginRequest(trimmedEmail, password);

      if (data.mfaRequired && data.preAuthToken) {
        setMfaStep(true);
        setMfaEmail(trimmedEmail);
        setMfaTempToken(data.preAuthToken);
        setFeedbackTone("neutral");
        setMessage("Enter the 6-digit code from your authenticator app.");
        return;
      }

      const nextUser = {
        token: data.token,
        email: data.user.email,
        name: resolveUserName(data.user),
        role: data.workspaceRole as AppRole,
        roles: data.roles,
      } satisfies SignedInUser;

      setSignedInUser(nextUser);
      await loadCompanies(data.token, { autoEnterSingleCompany: true, signedIn: nextUser });
    } catch (error) {
      setFeedbackTone("error");
      setMessage(error instanceof Error ? error.message : "Invalid email or password.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMfaVerify() {
    if (mfaToken.trim().length !== 6) {
      setFeedbackTone("error");
      setMessage("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setMfaBusy(true);
    setFeedbackTone("neutral");
    setMessage("Verifying code...");

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";
      const response = await fetch(`${apiBase}/auth/mfa/verify-login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mfaTempToken}`,
        },
        body: JSON.stringify({ email: mfaEmail, token: mfaToken.trim() }),
      });

      if (!response.ok) {
        setFeedbackTone("error");
        setMessage("Invalid code. Check your authenticator app and try again.");
        return;
      }

      const nextUser = {
        token: mfaTempToken,
        email: mfaEmail,
        name: mfaEmail,
        role: "admin" as AppRole,
        roles: [],
      } satisfies SignedInUser;

      setMfaStep(false);
      setMfaToken("");
      setSignedInUser(nextUser);
      await loadCompanies(mfaTempToken, { autoEnterSingleCompany: true, signedIn: nextUser });
    } catch {
      setFeedbackTone("error");
      setMessage("Could not verify MFA code. Try again.");
    } finally {
      setMfaBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-simple-shell">
        <article className="auth-simple-card surface">
          <div className="auth-simple-brand auth-animate-in" style={{ animationDelay: "0ms" }}>
            <BrandLockup
              className="auth-brand-lockup auth-brand-lockup--hero"
              subtitle={LOGIN_TAGLINE}
            />
          </div>

          <div className="auth-simple-copy auth-animate-in" style={{ animationDelay: "80ms" }}>
            <div className="auth-simple-copy__eyebrow">
              <ShieldCheck size={16} />
              <span>Secure access</span>
            </div>
            <h1>Welcome back</h1>
            <p>{LOGIN_ADMIN_HELPER_TEXT}</p>
          </div>

          <form className="auth-simple-form" onSubmit={handleLogin}>
            <label className="field auth-animate-in" style={{ animationDelay: "160ms" }}>
              <span>Email address</span>
              <div className="input-with-trailing-icon">
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={feedbackTone === "error" && !signedInUser ? "true" : "false"}
                />
                <span className="field-icon field-icon--passive" aria-hidden="true">
                  <Mail size={16} />
                </span>
              </div>
            </label>

            <label className="field auth-animate-in" style={{ animationDelay: "220ms" }}>
              <span>Password</span>
              <div className="input-with-trailing-icon">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={feedbackTone === "error" && !signedInUser ? "true" : "false"}
                />
                <button
                  className="field-icon field-icon--action"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <div className="auth-animate-in" style={{ animationDelay: "280ms" }}>
              <button className="primary-button auth-submit" disabled={busy || !serviceReady} type="submit">
                {busy ? (
                  <>
                    <span className="button-spinner" aria-hidden="true" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </div>

            {!serviceReady ? (
              <div className="auth-animate-in" style={{ animationDelay: "300ms" }}>
                <button className="ghost-button auth-retry" type="button" onClick={() => void verifyService()}>
                  Retry connection
                </button>
              </div>
            ) : null}

            <div className="auth-assist-row auth-animate-in" style={{ animationDelay: "340ms" }}>
              <span className="form-hint">Only users created by an administrator can access this workspace.</span>
              {signedInUser ? (
                <span className="auth-role-pill">
                  <KeyRound size={14} />
                  {getRoleLabel(signedInUser.role)}
                </span>
              ) : null}
            </div>
          </form>

          {mfaStep ? (
            <section className="auth-company-card auth-company-card--compact auth-animate-in" style={{ animationDelay: "100ms" }}>
              <div className="auth-company-card__head">
                <div>
                  <span className="section-eyebrow">Verification</span>
                  <h2>Two-factor authentication</h2>
                </div>
              </div>

              <p className="form-hint">Enter the 6-digit code from your authenticator app to continue.</p>

              <label className="field">
                <span>Authenticator code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={mfaToken}
                  onChange={(event) => setMfaToken(event.target.value.replace(/\D/g, ""))}
                  autoComplete="one-time-code"
                />
              </label>

              <div className="auth-company-card__actions">
                <button className="primary-button" type="button" onClick={() => void handleMfaVerify()} disabled={mfaBusy}>
                  {mfaBusy ? "Verifying..." : "Verify"}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setMfaStep(false);
                    setMfaToken("");
                    setMfaTempToken("");
                  }}
                >
                  Back
                </button>
              </div>
            </section>
          ) : null}

          {companies.length > 0 && selectedCompany ? (
            <section className="auth-company-card auth-company-card--compact auth-animate-in" style={{ animationDelay: "100ms" }}>
              <div className="auth-company-card__head">
                <div>
                  <span className="section-eyebrow">Workspace</span>
                  <h2>{selectedCompany.name}</h2>
                </div>
              </div>

              <div className="company-picker__meta auth-company-card__meta">
                <div>
                  <span>Branches</span>
                  <strong>{selectedCompany.branches.length}</strong>
                </div>
                <div>
                  <span>Assigned role</span>
                  <strong>{signedInUser ? getRoleLabel(signedInUser.role) : "Pending"}</strong>
                </div>
                <div>
                  <span>Default branch</span>
                  <strong>{selectedCompany.branches[0]?.name ?? "Not configured"}</strong>
                </div>
              </div>
            </section>
          ) : null}

          {message ? (
            <p
              className={`note auth-note auth-note--${feedbackTone} auth-animate-in`}
              style={{ animationDelay: "100ms" }}
              role={feedbackTone === "error" ? "alert" : "status"}
            >
              {message}
            </p>
          ) : null}
        </article>

        <aside className="auth-simple-visual surface">
          <div className="auth-visual-gradient" />
          <div className="auth-visual-orb auth-visual-orb--1" />
          <div className="auth-visual-orb auth-visual-orb--2" />
          <div className="auth-visual-orb auth-visual-orb--3" />
          <div className="auth-visual-shape auth-visual-shape--ring" />
          <div className="auth-visual-shape auth-visual-shape--diamond" />
          <div className="auth-visual-shape auth-visual-shape--dot-grid" />
          <div className="auth-visual-content">
            <div className="auth-visual-icon-row">
              <span className="auth-visual-icon-chip">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                Finance
              </span>
              <span className="auth-visual-icon-chip">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                Inventory
              </span>
              <span className="auth-visual-icon-chip">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                Payroll
              </span>
            </div>
            <div className="auth-visual-copy">
              <h2>Work without the noise.</h2>
              <p>One secure workspace for finance, operations, payroll, inventory, tax, and reporting.</p>
            </div>
            <div className="auth-visual-points">
              <span>Real-time dashboards</span>
              <span>Multi-branch</span>
              <span>Compliance-ready</span>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
