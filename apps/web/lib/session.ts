import type { AppRole } from "./erp";

export const sessionKeys = {
  token: "haqly.token",
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
  token: "finova.token",
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

  const readValue = (primary: string, legacy: string) => window.localStorage.getItem(primary) ?? window.localStorage.getItem(legacy);

  const companyIdValue = readValue(sessionKeys.companyId, legacySessionKeys.companyId);
  const branchIdValue = readValue(sessionKeys.branchId, legacySessionKeys.branchId);

  return {
    token: readValue(sessionKeys.token, legacySessionKeys.token) ?? defaultSession.token,
    companyId: companyIdValue ? Number(companyIdValue) : null,
    companyName: readValue(sessionKeys.companyName, legacySessionKeys.companyName) ?? defaultSession.companyName,
    branchId: branchIdValue ? Number(branchIdValue) : null,
    branchName: readValue(sessionKeys.branchName, legacySessionKeys.branchName) ?? defaultSession.branchName,
    role: (readValue(sessionKeys.role, legacySessionKeys.role) as AppRole | null) ?? defaultSession.role,
    userEmail: readValue(sessionKeys.userEmail, legacySessionKeys.userEmail) ?? defaultSession.userEmail,
    userName: readValue(sessionKeys.userName, legacySessionKeys.userName) ?? defaultSession.userName,
    periodLabel: readValue(sessionKeys.periodLabel, legacySessionKeys.periodLabel) ?? defaultSession.periodLabel,
  };
}

export function writeSession(input: StoredSession) {
  window.localStorage.setItem(sessionKeys.token, input.token);

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

  const stringFields: Array<[keyof Omit<StoredSession, "companyId" | "branchId">, string]> = [
    ["token", sessionKeys.token],
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

export function clearSession() {
  [...Object.values(sessionKeys), ...Object.values(legacySessionKeys)].forEach((key) => window.localStorage.removeItem(key));
}
