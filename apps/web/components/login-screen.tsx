"use client";

import { ArrowRight, Eye, EyeOff, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getCompanies, getHealth, login as loginRequest, type CompanyRecord } from "../lib/api";
import { getRoleLabel, type AppRole } from "../lib/erp";
import { readSession, writeSession } from "../lib/session";
import { BrandLockup } from "./ui/brand-lockup";

type SignedInUser = {
  token: string;
  email: string;
  name: string;
  role: AppRole;
  roles: string[];
};

export function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Only users created by an administrator can access this workspace.");
  const [feedbackTone, setFeedbackTone] = useState<"neutral" | "error" | "success">("neutral");
  const [serviceReady, setServiceReady] = useState(true);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | "">("");
  const [signedInUser, setSignedInUser] = useState<SignedInUser | null>(null);
  const [mfaPending, setMfaPending] = useState<{ userId: number; tempToken: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaEmail, setMfaEmail] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [mfaTempToken, setMfaTempToken] = useState("");

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  );

  useEffect(() => {
    void verifyService();

        // Clean up legacy token from localStorage (security fix)
    window.localStorage.removeItem("haqly.token");
    window.localStorage.removeItem("finova.token");
    const session = readSession();
    if (session.token && session.companyId && session.companyName) {
      router.replace("/dashboard");
    } else if (session.token) {
      setSignedInUser({
        token: session.token,
        email: session.userEmail,
        name: session.userName,
        role: session.role,
        roles: [],
      });
      void loadCompanies(session.token);
    }
  }, [router]);

  async function verifyService() {
    try {
      await getHealth();
      setServiceReady(true);
    } catch {
      setServiceReady(false);
      setFeedbackTone("error");
      setMessage("The ERP service is currently unavailable. Please try again shortly or contact your administrator.");
    }
  }

  async function loadCompanies(token: string) {
    setBusy(true);
    setFeedbackTone("neutral");
    setMessage("Loading companies and branches...");
    try {
      const data = await getCompanies(token);
      setCompanies(data);
      setSelectedCompanyId(data[0]?.id ?? "");
      setFeedbackTone(data.length > 0 ? "success" : "neutral");
      setMessage(data.length > 0 ? "Select a company to continue into the ERP workspace." : "No companies are available for this account yet.");
    } catch (error) {
      setFeedbackTone("error");
      setMessage(error instanceof Error ? error.message : "Could not load companies.");
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
    setMessage("Signing you in...");
    try {
      if (!serviceReady) {
        await verifyService();
      }
      const data = await loginRequest(trimmedEmail, password);

      // MFA required — show verification step
      if ((data as any).mfaRequired) {
        setMfaStep(true);
        setMfaEmail(trimmedEmail);
        setMfaTempToken((data as any).preAuthToken ?? "");
        setFeedbackTone("neutral");
        setMessage("Enter the 6-digit code from your authenticator app.");
        setBusy(false);
        return;
      }
      const userName = [data.user.firstName, data.user.lastName].filter(Boolean).join(" ") || data.user.email;
      setSignedInUser({
        token: data.token,
        email: data.user.email,
        name: userName,
        role: data.workspaceRole as AppRole,
        roles: data.roles,
      });
      await loadCompanies(data.token);
    } catch (error) {
      setFeedbackTone("error");
      setMessage(error instanceof Error ? error.message : "Invalid email or password");
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
      const res = await fetch(`${apiBase}/auth/mfa/verify-login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${mfaTempToken}` },
        body: JSON.stringify({ email: mfaEmail, token: mfaToken.trim() }),
      });
      if (!res.ok) {
        setFeedbackTone("error");
        setMessage("Invalid code. Check your authenticator app and try again.");
        setMfaBusy(false);
        return;
      }
      // MFA passed — use preAuthToken to load companies
      setMfaStep(false);
      setMfaToken("");
      setSignedInUser({
        token: mfaTempToken,
        email: mfaEmail,
        name: mfaEmail,
        role: "admin" as AppRole,
        roles: [],
      });
      await loadCompanies(mfaTempToken);
      setMfaBusy(false);
    } catch {
      setFeedbackTone("error");
      setMessage("Could not verify MFA code. Try again.");
      setMfaBusy(false);
    }
  // REPLACED_PLACEHOLDER
    if (!mfaPending || mfaCode.trim().length !== 6) {
      setFeedbackTone("error");
      setMessage("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setMfaBusy(true);
    setFeedbackTone("neutral");
    setMessage("Verifying code...");
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "/backend/api/v1";
      const res = await fetch(`${apiBase}/auth/mfa/verify-login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mfaPending.tempToken}`,
        },
        body: JSON.stringify({ token: mfaCode.trim() }),
      });
      if (!res.ok) {
        setFeedbackTone("error");
        setMessage("Invalid code. Check your authenticator app and try again.");
        setMfaBusy(false);
        return;
      }
      // MFA passed — continue normal login flow
      setMfaPending(null);
      setMfaCode("");
      setMfaBusy(false);
      setFeedbackTone("success");
      setMessage("Select a company to continue.");
    } catch {
      setFeedbackTone("error");
      setMessage("Could not verify MFA code. Try again.");
      setMfaBusy(false);
    }
  }
  function enterWorkspace() {
    if (!signedInUser) {
      setFeedbackTone("error");
      setMessage("Sign in first.");
      return;
    }

    if (!selectedCompany) {
      setFeedbackTone("error");
      setMessage("Select a company first.");
      return;
    }

    const firstBranch = selectedCompany.branches[0];

    writeSession({
      token: signedInUser.token,
      companyId: selectedCompany.id,
      companyName: selectedCompany.name,
      branchId: firstBranch?.id ?? null,
      branchName: firstBranch?.name ?? "All branches",
      role: signedInUser.role,
      userEmail: signedInUser.email,
      userName: signedInUser.name,
      periodLabel: "Mar 2026",
    });
    router.push("/dashboard");
  }

  return (
    <main className="auth-page">
      <section className="auth-simple-shell">
        <article className="auth-simple-card surface">
          <div className="auth-simple-brand">
            <BrandLockup className="auth-brand-lockup auth-brand-lockup--hero" />
          </div>

          <div className="auth-simple-copy">
            <div className="auth-simple-copy__eyebrow">
              <ShieldCheck size={16} />
              <span>Secure access</span>
            </div>
            <h1>Welcome back</h1>
          </div>

          <form className="auth-simple-form" onSubmit={handleLogin}>
            <label className="field">
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

            <label className="field">
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

            {!serviceReady ? <button className="ghost-button auth-retry" type="button" onClick={() => void verifyService()}>Retry connection</button> : null}

            <div className="auth-assist-row">
              {signedInUser ? (
                <span className="auth-role-pill">
                  <KeyRound size={14} />
                  {getRoleLabel(signedInUser.role)}
                </span>
              ) : null}
            </div>
          </form>

          
          {/* ── MFA Step ────────────────────────────────────────────────── */}
          {mfaStep && (
            <div className="auth-simple-form" style={{ marginTop: "1rem" }}>
              <div className="auth-simple-copy__eyebrow">
                <ShieldCheck size={16} />
                <span>Two-factor authentication required</span>
              </div>
              <p style={{ fontSize: "0.875rem", color: "var(--text-2)" }}>
                Enter the 6-digit code from your authenticator app.
              </p>
              <label className="field">
                <span>Authenticator code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={mfaToken}
                  onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, ""))}
                  autoComplete="one-time-code"
                />
              </label>
              <button
                className="primary-button auth-submit"
                onClick={() => void handleMfaVerify()}
                disabled={mfaBusy}
              >
                {mfaBusy ? "Verifying..." : "Verify & continue"}
              </button>
              <button
                className="ghost-button"
                style={{ marginTop: "0.5rem" }}
                onClick={() => { setMfaStep(false); setMfaToken(""); }}
              >
                Back to login
              </button>
            </div>
          )}
          {companies.length > 0 ? (
            <section className="auth-company-card">
              <div className="auth-company-card__head">
                <div>
                  <span className="section-eyebrow">Company</span>
                  <h2>Open workspace</h2>
                </div>
                <button className="primary-button" type="button" onClick={enterWorkspace} disabled={busy || !selectedCompany}>
                  Continue
                  <ArrowRight size={16} />
                </button>
              </div>

              <label className="field">
                <span>Select company</span>
                <select
                  className="select-input"
                  value={selectedCompanyId}
                  onChange={(event) => setSelectedCompanyId(Number(event.target.value))}
                >
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>

              {selectedCompany ? (
                <div className="company-picker__meta">
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
                    <strong>{selectedCompany.branches[0]?.name ?? "None yet"}</strong>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <p className={`note auth-note auth-note--${feedbackTone}`} role={feedbackTone === "error" ? "alert" : "status"}>
            {message}
          </p>
        </article>

        <aside className="auth-simple-visual surface">
          <div className="auth-visual-sky" />
          <div className="auth-visual-scene">
            <div className="auth-visual-desk">
              <div className="auth-visual-monitor" />
              <div className="auth-visual-person">
                <span className="auth-visual-head" />
                <span className="auth-visual-body" />
              </div>
            </div>
          </div>
          <div className="auth-visual-copy">
            <h2>Your Enterprise Source of Truth.</h2>
            <p>Finance, inventory, procurement, payroll and reporting — unified in one workspace.</p>
            <div className="auth-visual-points">
              <span>Role-based access</span>
              <span>Audit-ready workflows</span>
              <span>Company-aware workspace</span>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
