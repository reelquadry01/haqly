"use client";

import { useEffect, useMemo, useState } from "react";
import { getCompanies, type CompanyRecord } from "../lib/api";
import { readSession, writeSession, type StoredSession } from "../lib/session";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

export function useWorkspace() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = readSession();
    setSession(stored);

    if (!stored.token) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        // Always refresh the token first — in-memory token is lost on reload
        let token = stored.token;
        try {
          const res = await fetch(apiBase + "/auth/refresh", {
            method: "POST",
            credentials: "include",
          });
          if (res.ok) {
            const data = await res.json() as { token?: string };
            if (data.token) {
              token = data.token;
              // Write fresh token back to localStorage immediately
              const refreshed = { ...stored, token };
              writeSession(refreshed);
              if (!cancelled) setSession(refreshed);
            }
          }
        } catch {
          // Refresh failed — use stored token as fallback
        }

        const records = await getCompanies(token);
        if (cancelled) return;

        setCompanies(records);

        const selectedCompany =
          records.find((c) => c.id === stored.companyId) ?? records[0];
        const selectedBranch =
          selectedCompany?.branches.find((b) => b.id === stored.branchId) ??
          selectedCompany?.branches[0];

        if (selectedCompany) {
          const next: StoredSession = {
            ...stored,
            token,
            companyId: selectedCompany.id,
            companyName: selectedCompany.name,
            branchId: selectedBranch?.id ?? null,
            branchName: selectedBranch?.name ?? "All branches",
          };
          writeSession(next);
          if (!cancelled) setSession(next);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load workspace.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  const activeCompany = useMemo(
    () => companies.find((c) => c.id === session?.companyId) ?? null,
    [companies, session?.companyId],
  );

  const activeBranch = useMemo(
    () => activeCompany?.branches.find((b) => b.id === session?.branchId) ?? null,
    [activeCompany, session?.branchId],
  );

  function updateSession(patch: Partial<StoredSession>) {
    if (!session) return;
    const next = { ...session, ...patch };
    writeSession(next);
    setSession(next);
  }

  function setCompany(companyId: number) {
    const company = companies.find((c) => c.id === companyId);
    if (!company || !session) return;
    updateSession({
      companyId: company.id,
      companyName: company.name,
      branchId: company.branches[0]?.id ?? null,
      branchName: company.branches[0]?.name ?? "All branches",
    });
  }

  function setBranch(branchId: number) {
    const branch = activeCompany?.branches.find((b) => b.id === branchId);
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