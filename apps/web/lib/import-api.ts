import { apiBaseUrl, type BulkImportResponse } from "./api";

async function readImportResponse(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "message" in data && typeof data.message === "string"
        ? data.message
        : fallbackMessage;
    throw new Error(message);
  }

  return (data ?? { dataset: "", created: 0, updated: 0, failed: 0, errors: [] }) as BulkImportResponse;
}

async function postImportRows(
  token: string,
  path: string,
  rows: Array<Record<string, unknown>>,
  fallbackMessage: string,
) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ rows }),
  });

  return readImportResponse(response, fallbackMessage);
}

export function importDepartments(token: string, rows: Array<Record<string, unknown>>) {
  return postImportRows(token, "/imports/departments", rows, "Could not import departments");
}

export function importWarehouses(token: string, rows: Array<Record<string, unknown>>) {
  return postImportRows(token, "/imports/warehouses", rows, "Could not import warehouses");
}

export function importBankAccounts(token: string, rows: Array<Record<string, unknown>>) {
  return postImportRows(token, "/imports/bank-accounts", rows, "Could not import bank accounts");
}

export function importAssetCategories(token: string, rows: Array<Record<string, unknown>>) {
  return postImportRows(token, "/imports/asset-categories", rows, "Could not import asset categories");
}
