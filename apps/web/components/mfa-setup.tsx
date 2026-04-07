"use client";

/**
 * MfaSetup — TOTP Multi-Factor Authentication setup component
 *
 * Flow:
 *   1. User clicks "Enable MFA" → calls /auth/mfa/setup → receives QR code URI
 *   2. QR code is rendered using the `qrcode` library
 *   3. User scans with Google Authenticator / Authy
 *   4. User enters the 6-digit code → calls /auth/mfa/activate
 *   5. On success, MFA is enabled for future logins
 */

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { ShieldCheck, ShieldOff, Loader2 } from "lucide-react";

type MfaSetupProps = {
  token: string; // Access token for API calls
  apiBaseUrl: string; // e.g. http://localhost:3000/api/v1
};

type SetupState = "idle" | "qr" | "success" | "error";

export function MfaSetup({ token, apiBaseUrl }: MfaSetupProps) {
  const [state, setState] = useState<SetupState>("idle");
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [activating, setActivating] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [message, setMessage] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Check current MFA status on mount
  useEffect(() => {
    void checkStatus();
  }, []);

  // Render QR code whenever otpauthUrl changes
  useEffect(() => {
    if (otpauthUrl && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, otpauthUrl, { width: 220, margin: 2 }, (err) => {
        if (err) setMessage("Could not render QR code. Use the manual code below.");
      });
    }
  }, [otpauthUrl]);

  async function checkStatus() {
    try {
      const res = await fetch(`${apiBaseUrl}/auth/mfa/status`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json() as { enabled: boolean };
      setMfaEnabled(data.enabled);
    } catch {
      setMfaEnabled(false);
    }
  }

  async function handleSetup() {
    setLoadingSetup(true);
    setMessage("");
    try {
      const res = await fetch(`${apiBaseUrl}/auth/mfa/setup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        throw new Error(err.message ?? "Setup failed");
      }
      const data = await res.json() as { secret: string; otpauthUrl: string };
      setOtpauthUrl(data.otpauthUrl);
      setSecret(data.secret);
      setState("qr");
      setMessage("Scan the QR code with Google Authenticator or Authy, then enter the 6-digit code below.");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Could not start MFA setup.");
    } finally {
      setLoadingSetup(false);
    }
  }

  async function handleActivate() {
    if (totpCode.trim().length !== 6) {
      setMessage("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setActivating(true);
    setMessage("");
    try {
      const res = await fetch(`${apiBaseUrl}/auth/mfa/activate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({ token: totpCode.trim() }),
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        throw new Error(err.message ?? "Activation failed");
      }
      setState("success");
      setMfaEnabled(true);
      setMessage("MFA enabled successfully. Your account is now protected with two-factor authentication.");
    } catch (err) {
      setState("qr");
      setMessage(err instanceof Error ? err.message : "Invalid code. Try again.");
    } finally {
      setActivating(false);
    }
  }

  async function handleDisable(password: string, totpToken: string) {
    setLoadingSetup(true);
    setMessage("");
    try {
      const res = await fetch(`${apiBaseUrl}/auth/mfa/disable`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({ token: totpToken, password }),
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        throw new Error(err.message ?? "Could not disable MFA");
      }
      setState("idle");
      setMfaEnabled(false);
      setOtpauthUrl("");
      setSecret("");
      setTotpCode("");
      setMessage("MFA has been disabled.");
    } catch (err) {
      setState("idle");
      setMessage(err instanceof Error ? err.message : "Could not disable MFA.");
    } finally {
      setLoadingSetup(false);
    }
  }

  if (mfaEnabled === null) {
    return (
      <div className="mfa-loading">
        <Loader2 size={20} className="spin" />
        <span>Checking MFA status...</span>
      </div>
    );
  }

  return (
    <div className="mfa-setup-card">
      <div className="mfa-header">
        {mfaEnabled ? (
          <ShieldCheck size={20} className="mfa-icon mfa-icon--active" />
        ) : (
          <ShieldOff size={20} className="mfa-icon mfa-icon--inactive" />
        )}
        <div>
          <h3>Two-Factor Authentication</h3>
          <p className="mfa-status-label">
            {mfaEnabled ? "MFA is active on your account" : "MFA is not enabled"}
          </p>
        </div>
      </div>

      {/* QR code setup flow */}
      {state === "qr" && (
        <div className="mfa-qr-block">
          <p className="mfa-instruction">
            Scan this QR code with <strong>Google Authenticator</strong> or <strong>Authy</strong>:
          </p>
          <canvas ref={canvasRef} className="mfa-qr-canvas" />
          <details className="mfa-secret-details">
            <summary>Can&apos;t scan? Enter code manually</summary>
            <code className="mfa-secret-code">{secret}</code>
          </details>
          <label className="field mfa-totp-field">
            <span>Enter the 6-digit code from your app</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
              className="mfa-totp-input"
              autoComplete="one-time-code"
            />
          </label>
          <button
            className="primary-button"
            onClick={() => void handleActivate()}
            disabled={activating}
          >
            {activating ? "Verifying..." : "Activate MFA"}
          </button>
        </div>
      )}

      {/* Success state */}
      {state === "success" && (
        <div className="mfa-success">
          <ShieldCheck size={32} className="mfa-icon mfa-icon--active" />
          <p>MFA is now active on your account.</p>
        </div>
      )}

      {/* Action buttons */}
      {(state === "idle" || state === "error") && (
        <div className="mfa-actions">
          {!mfaEnabled ? (
            <button
              className="primary-button"
              onClick={() => void handleSetup()}
              disabled={loadingSetup}
            >
              {loadingSetup ? "Setting up..." : "Enable MFA"}
            </button>
          ) : (
            <DisableMfaForm onDisable={handleDisable} busy={loadingSetup} />
          )}
        </div>
      )}

      {/* Feedback message */}
      {message && (
        <p className={`note ${state === "error" ? "note--error" : state === "success" ? "note--success" : ""}`}>
          {message}
        </p>
      )}
    </div>
  );
}

// ─── Disable MFA sub-form ─────────────────────────────────────────────────────
function DisableMfaForm({
  onDisable,
  busy,
}: {
  onDisable: (password: string, token: string) => void;
  busy: boolean;
}) {
  const [password, setPassword] = useState("");
  const [totpToken, setTotpToken] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="ghost-button ghost-button--danger" onClick={() => setOpen(true)}>
        Disable MFA
      </button>
    );
  }

  return (
    <div className="mfa-disable-form">
      <p className="mfa-disable-warning">
        Enter your password and current authenticator code to disable MFA.
      </p>
      <label className="field">
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      <label className="field">
        <span>Authenticator code</span>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={totpToken}
          onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, ""))}
          autoComplete="one-time-code"
        />
      </label>
      <div className="mfa-disable-actions">
        <button
          className="ghost-button ghost-button--danger"
          onClick={() => onDisable(password, totpToken)}
          disabled={busy}
        >
          {busy ? "Disabling..." : "Confirm disable MFA"}
        </button>
        <button className="ghost-button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}