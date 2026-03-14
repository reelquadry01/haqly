"use client";

import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";

function safeParse<T>(raw: string | null, fallback: T) {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function companyStorageKey(scope: string, companyId: number | null | undefined) {
  return companyId ? `finova.company.${companyId}.${scope}` : "";
}

export function readCompanyPersistentState<T>(
  scope: string,
  companyId: number | null | undefined,
  fallback: T,
): T {
  if (typeof window === "undefined" || !companyId) {
    return fallback;
  }

  return safeParse(window.localStorage.getItem(companyStorageKey(scope, companyId)), fallback);
}

export function useCompanyPersistentState<T>(
  scope: string,
  companyId: number | null | undefined,
  fallback: T,
): [T, Dispatch<SetStateAction<T>>] {
  const storageKey = useMemo(() => companyStorageKey(scope, companyId), [scope, companyId]);
  const [state, setState] = useState<T>(fallback);

  useEffect(() => {
    if (!companyId || !storageKey) {
      setState(fallback);
      return;
    }

    setState(readCompanyPersistentState(scope, companyId, fallback));
  }, [companyId, fallback, scope, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !companyId || !storageKey) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [companyId, state, storageKey]);

  return [state, setState];
}
