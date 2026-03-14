"use client";

import { useEffect, useMemo, useState } from "react";
import { getCompanies, type CompanyRecord } from "../lib/api";
import { readSession, writeSession, type StoredSession } from "../lib/session";

export function useWorkspace() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const nextSession = readSession();
    setSession(nextSession);

    if (!nextSession.token) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const records = await getCompanies(nextSession.token);
        if (cancelled) {
          return;
        }
        setCompanies(records);

        const selectedCompany = records.find((company) => company.id === nextSession.companyId) ?? records[0];
        const selectedBranch =
          selectedCompany?.branches.find((branch) => branch.id === nextSession.branchId) ?? selectedCompany?.branches[0];

        if (selectedCompany) {
          const updatedSession = {
            ...nextSession,
            companyId: selectedCompany.id,
            companyName: selectedCompany.name,
            branchId: selectedBranch?.id ?? null,
            branchName: selectedBranch?.name ?? "All branches",
          };
          writeSession(updatedSession);
          setSession(updatedSession);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load companies.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeCompany = useMemo(() => {
    return companies.find((company) => company.id === session?.companyId) ?? null;
  }, [companies, session?.companyId]);

  const activeBranch = useMemo(() => {
    return activeCompany?.branches.find((branch) => branch.id === session?.branchId) ?? null;
  }, [activeCompany, session?.branchId]);

  function updateSession(patch: Partial<StoredSession>) {
    if (!session) {
      return;
    }

    const next = { ...session, ...patch };
    writeSession(next);
    setSession(next);
  }

  function setCompany(companyId: number) {
    const company = companies.find((entry) => entry.id === companyId);
    if (!company || !session) {
      return;
    }

    updateSession({
      companyId: company.id,
      companyName: company.name,
      branchId: company.branches[0]?.id ?? null,
      branchName: company.branches[0]?.name ?? "All branches",
    });
  }

  function setBranch(branchId: number) {
    const branch = activeCompany?.branches.find((entry) => entry.id === branchId);
    if (!branch) {
      return;
    }

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
      if (!session?.token) {
        return;
      }
      const records = await getCompanies(session.token);
      setCompanies(records);
    },
  };
}
