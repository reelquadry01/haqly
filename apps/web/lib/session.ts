import type { AppRole } from "./erp";

// ─────────────────────────────────────────────────────────────────────────────
// Access token lives in memory ONLY — never in localStorage.
// This prevents XSS attacks from stealing the token via document.cookie or
// localStorage enumeration. The token is re-acquired via silent refresh
// (httpOnly refresh cookie) after a page reload.
// ─────────────────────────────────────────────────────────────────────────────
let _memoryToken = "";

export function getMemoryToken(): string {
  return _memoryToken;
}

export function setMemoryToken(token: string): void {
  _memoryToken = token;
}

export function clearMemoryToken(): void {
  _memoryToken = "";
}

// ─── Session keys — non-sensitive data only stored in localStorage ───────────
export const sessionKeys = {
  companyId: "haqly.companyId",
  companyName: "haqly.companyName",
  branchId: "haqly.branchId",
  branchName: "haqly.branchName",
  role: "haqly.role",
  userEmail: "haqly.userEmail",
  userName: "haqly.userName",
  periodLabel: "haqly.periodLabel",
};

const legacySessionKeys = {
  companyId: "finova.companyId",
  companyName: "finova.companyName",
  branchId: "finova.branchId",
  branchName: "finova.branchName",
  role: "finova.role",
  userEmail: "finova.userEmail",
  userName: "finova.userName",
  periodLabel: "finova.periodLabel",
};

export type StoredSession = {
  token: string;
  companyId: number | null;
  companyName: string;
  branchId: number | null;
  branchName: string;
  role: AppRole;
  userEmail: string;
  userName: string;
  periodLabel: string;
};

const defaultSession: StoredSession = {
  token: "",
  companyId: null,
  companyName: "",
  branchId: null,
  branchName: "",
  role: "cfo",
  userEmail: "",
  userName: "",
  periodLabel: "Mar 2026",
};

export function readSession(): StoredSession {
  if (typeof window === "undefined") {
    return defaultSession;
  }

  const readValue = (primary: string, legacy: string) =>
    window.localStorage.getItem(primary) ?? window.localStorage.getItem(legacy);

  const companyIdValue = readValue(sessionKeys.companyId, legacySessionKeys.companyId);
  const branchIdValue = readValue(sessionKeys.branchId, legacySessionKeys.branchId);

  return {
    // Token always sourced from memory — never from localStorage
    token: getMemoryToken(),
    companyId: companyIdValue ? Number(companyIdValue) : null,
    companyName:
      readValue(sessionKeys.companyName, legacySessionKeys.companyName) ?? defaultSession.companyName,
    branchId: branchIdValue ? Number(branchIdValue) : null,
    branchName:
      readValue(sessionKeys.branchName, legacySessionKeys.branchName) ?? defaultSession.branchName,
    role:
      (readValue(sessionKeys.role, legacySessionKeys.role) as AppRole | null) ?? defaultSession.role,
    userEmail:
      readValue(sessionKeys.userEmail, legacySessionKeys.userEmail) ?? defaultSession.userEmail,
    userName:
      readValue(sessionKeys.userName, legacySessionKeys.userName) ?? defaultSession.userName,
    periodLabel:
      readValue(sessionKeys.periodLabel, legacySessionKeys.periodLabel) ?? defaultSession.periodLabel,
  };
}

export function writeSession(input: StoredSession): void {
  if (typeof window === "undefined") return;

  // Token goes to memory — NOT localStorage
  setMemoryToken(input.token);

  // Only non-sensitive fields persisted to localStorage
  const numberFields: Array<[keyof Pick<StoredSession, "companyId" | "branchId">, string]> = [
    ["companyId", sessionKeys.companyId],
    ["branchId", sessionKeys.branchId],
  ];

  for (const [field, key] of numberFields) {
    const value = input[field];
    if (value !== null) {
      window.localStorage.setItem(key, String(value));
    } else {
      window.localStorage.removeItem(key);
    }
  }

  const stringFields: Array<
    [keyof Omit<StoredSession, "companyId" | "branchId" | "token">, string]
  > = [
    ["companyName", sessionKeys.companyName],
    ["branchName", sessionKeys.branchName],
    ["role", sessionKeys.role],
    ["userEmail", sessionKeys.userEmail],
    ["userName", sessionKeys.userName],
    ["periodLabel", sessionKeys.periodLabel],
  ];

  for (const [field, key] of stringFields) {
    const value = input[field];
    if (value) {
      window.localStorage.setItem(key, String(value));
    } else {
      window.localStorage.removeItem(key);
    }
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;

  clearMemoryToken();

  // Clean up both current and legacy keys
  [...Object.values(sessionKeys), ...Object.values(legacySessionKeys)].forEach((key) =>
    window.localStorage.removeItem(key),
  );

  // Also remove old token keys that may still be in storage from before this fix
  window.localStorage.removeItem("haqly.token");
  window.localStorage.removeItem("finova.token");
}