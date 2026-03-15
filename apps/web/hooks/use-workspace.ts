"use client";

import { useEffect, useMemo, useState } from "react";
import { getCompanies, type CompanyRecord } from "../lib/api";
import { readSession, writeSession, type StoredSession } from "../lib/session";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

// Attempt a silent token refresh using the httpOnly refresh cookie.
// Returns the new access token string on success, or null on failure.
async function tryRefreshToken(): Promise<string | null> {
  try {
    const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) return null;
    const data = await response.json() as { token?: string };
    return data.token ?? null;
  } catch {
    return null;
  }
}

export function useWorkspace() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedSession = readSession();
    setSession(storedSession);

    if (!storedSession.token) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        // Step 1: Always attempt silent refresh first.
        // The in-memory access token is lost on every page reload.
        // The httpOnly refresh cookie survives and gives us a fresh token.
        let activeToken = storedSession.token;
        const refreshed = await tryRefreshToken();
        if (refreshed) {
          activeToken = refreshed;
          // Persist fresh token back to session so all subsequent API calls use it
          writeSession({ ...storedSession, token: refreshed });
          if (!cancelled) {
            setSession((current) => current ? { ...current, token: refreshed } : current);
          }
        }

        // Step 2: Load companies with the fresh (or fallback) token
        const records = await getCompanies(activeToken);
        if (cancelled) return;

        setCompanies(records);

        const selectedCompany =
          records.find((company) => company.id === storedSession.companyId) ?? records[0];
        const selectedBranch =
          selectedCompany?.branches.find((branch) => branch.id === storedSession.branchId) ??
          selectedCompany?.branches[0];

        if (selectedCompany) {
          const updatedSession: StoredSession = {
            ...storedSession,
            token: activeToken,
            companyId: selectedCompany.id,
            companyName: selectedCompany.name,
            branchId: selectedBranch?.id ?? null,
            branchName: selectedBranch?.name ?? "All branches",
          };
          writeSession(updatedSession);
          if (!cancelled) setSession(updatedSession);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load workspace.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  const activeCompany = useMemo(() => {
    return companies.find((company) => company.id === session?.companyId) ?? null;
  }, [companies, session?.companyId]);

  const activeBranch = useMemo(() => {
    return activeCompany?.branches.find((branch) => branch.id === session?.branchId) ?? null;
  }, [activeCompany, session?.branchId]);

  function updateSession(patch: Partial<StoredSession>) {
    if (!session) return;
    const next = { ...session, ...patch };
    writeSession(next);
    setSession(next);
  }

  function setCompany(companyId: number) {
    const company = companies.find((entry) => entry.id === companyId);
    if (!company || !session) return;
    updateSession({
      companyId: company.id,
      companyName: company.name,
      branchId: company.branches[0]?.id ?? null,
      branchName: company.branches[0]?.name ?? "All branches",
    });
  }

  function setBranch(branchId: number) {
    const branch = activeCompany?.branches.find((entry) => entry.id === branchId);
    if (!branch) return;
    updateSession({ branchId: branch.id, branchName: branch.name });
  }

  function setPeriod(periodLabel: string) {
    updateSession({ periodLabel });
  }

  return {
    session,
    companies,
    activeCompany,
    activeBranch,
    loading,
    error,
    setCompany,
    setBranch,
    setPeriod,
    refreshCompanies: async () => {
      if (!session?.token) return;
      const records = await getCompanies(session.token);
      setCompanies(records);
    },
  };
}