"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, FileDown, Printer, RefreshCw } from "lucide-react";
import { WorkspaceShell } from "../../components/workspace-shell";
import { DataTable } from "../../components/ui/data-table";
import { EmptyState } from "../../components/ui/empty-state";
import { ModuleActionBar } from "../../components/ui/module-action-bar";
import { ProcessArchitecturePanel } from "../../components/ui/process-architecture-panel";
import { RowActionMenu } from "../../components/ui/row-action-menu";
import { SectionCard } from "../../components/ui/section-card";
import { StatusBadge } from "../../components/ui/status-badge";
import { useWorkspace } from "../../hooks/use-workspace";
import type { AppStatus } from "../../lib/erp";
import { exportInvoicesPdf, previewInvoices, printInvoices } from "../../lib/invoice-documents";
import { exportReceiptsPdf, previewReceipts, printReceipts } from "../../lib/receipt-documents";
import {
  createCustomerReceipt,
  createSalesCustomer,
  createSalesInvoice,
  getCustomerReceiptMetadata,
  getCustomerReceipts,
  getInventoryProducts,
  getInventoryWarehouses,
  getSalesCustomers,
  getSalesInvoices,
  postCustomerReceipt,
  getTaxConfigs,
  type CustomerReceiptMetadataResponse,
  type CustomerReceiptRecord,
  type InventoryProduct,
  type InventoryWarehouse,
  type SalesCustomer,
  type SalesInvoiceRecord,
  type TaxConfigRecord,
} from "../../lib/api";
import { buildSalesWorkflow } from "../../lib/process-flows";

type InvoiceLineDraft = {
  id: string;
  productId: number | "";
  quantity: number;
  unitPrice: number;
  taxRate: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function toNumber(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

export default function SalesPage() {
  const { session, activeCompany, activeBranch } = useWorkspace();
  const [customers, setCustomers] = useState<SalesCustomer[]>([]);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoiceRecord[]>([]);
  const [receipts, setReceipts] = useState<CustomerReceiptRecord[]>([]);
  const [taxConfigs, setTaxConfigs] = useState<TaxConfigRecord[]>([]);
  const [receiptMetadata, setReceiptMetadata] = useState<CustomerReceiptMetadataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Create a live invoice from this template and it will be stored in the ERP.");
  const [invoiceDraft, setInvoiceDraft] = useState({
    customerId: "" as number | "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    warehouseId: "" as number | "",
  });
  const [customerDraft, setCustomerDraft] = useState({ name: "", email: "", phone: "" });
  const [receiptDraft, setReceiptDraft] = useState({
    invoiceId: "" as number | "",
    paymentDate: new Date().toISOString().slice(0, 10),
    postingDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "BANK_TRANSFER",
    bankAccountId: "" as number | "",
    cashAccountId: "" as number | "",
    receivableAccountId: "" as number | "",
    bankReference: "",
    externalReference: "",
    narration: "",
    remarks: "",
  });
  const [lines, setLines] = useState<InvoiceLineDraft[]>([
    { id: "1", productId: "", quantity: 1, unitPrice: 0, taxRate: 0 },
  ]);
  const [previewInvoice, setPreviewInvoice] = useState<SalesInvoiceRecord | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<CustomerReceiptRecord | null>(null);

  async function loadSalesData(token: string) {
    setLoading(true);
    try {
      const [customerRows, invoiceRows, productRows, warehouseRows, taxRows, receiptRows, receiptMeta] = await Promise.all([
        getSalesCustomers(token, activeCompany?.id),
        getSalesInvoices(token, activeCompany?.id),
        getInventoryProducts(token, activeCompany?.id),
        getInventoryWarehouses(token, activeCompany?.id),
        activeCompany?.id ? getTaxConfigs(token, activeCompany.id) : Promise.resolve([]),
        getCustomerReceipts(token, { companyId: activeCompany?.id, branchId: activeBranch?.id }),
        activeCompany?.id ? getCustomerReceiptMetadata(token, activeCompany.id) : Promise.resolve(null),
      ]);
      setCustomers(customerRows);
      setInvoices(invoiceRows);
      setProducts(productRows);
      setWarehouses(warehouseRows);
      setTaxConfigs(taxRows);
      setReceipts(receiptRows);
      setReceiptMetadata(receiptMeta);
      setInvoiceDraft((current) => ({
        ...current,
        customerId: current.customerId || customerRows[0]?.id || "",
        warehouseId: current.warehouseId || warehouseRows[0]?.id || "",
      }));
      setReceiptDraft((current) => ({
        ...current,
        invoiceId:
          current.invoiceId && invoiceRows.some((invoice) => invoice.id === Number(current.invoiceId))
            ? current.invoiceId
            : invoiceRows[0]?.id || "",
        bankAccountId:
          current.bankAccountId && receiptMeta?.bankAccounts.some((account) => account.id === Number(current.bankAccountId))
            ? current.bankAccountId
            : receiptMeta?.bankAccounts[0]?.id || "",
        receivableAccountId:
          current.receivableAccountId &&
          receiptMeta?.receivableAccounts.some((account) => account.id === Number(current.receivableAccountId))
            ? current.receivableAccountId
            : receiptMeta?.receivableAccounts[0]?.id || "",
      }));
      setLines((current) =>
        current.map((line) => {
          if (line.productId || productRows.length === 0) {
            return line;
          }
          return {
            ...line,
            productId: productRows[0].id,
          };
        }),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load sales data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!session?.token) {
      return;
    }
    void loadSalesData(session.token);
  }, [activeCompany?.id, session?.token]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const tax = lines.reduce((sum, line) => sum + (line.quantity * line.unitPrice * line.taxRate) / 100, 0);
    return {
      subtotal,
      tax,
      total: subtotal + tax,
    };
  }, [lines]);

  const invoiceRows = useMemo(() => {
    return invoices.map((invoice) => ({
      id: String(invoice.id),
      number: invoice.number,
      customer: invoice.customer?.name ?? "Unmapped customer",
      date: new Date(invoice.date).toLocaleDateString("en-GB"),
      rawDate: invoice.date,
      dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-GB") : "-",
      rawDueDate: invoice.dueDate ?? "",
      total: formatCurrency(toNumber(invoice.total)),
      rawTotal: toNumber(invoice.total),
      items: invoice.items.length,
      status: (invoice.status === "OPEN" ? "Submitted" : "Draft") as AppStatus,
      source: invoice,
    }));
  }, [invoices]);

  const selectedReceiptInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === Number(receiptDraft.invoiceId)) ?? null,
    [invoices, receiptDraft.invoiceId],
  );

  const receiptRows = useMemo(() => {
    return receipts.map((receipt) => ({
      id: String(receipt.id),
      number: receipt.receiptNumber,
      customer: receipt.customer?.name ?? "Unmapped customer",
      invoiceRefs: receipt.lines.map((line) => line.invoice?.number).filter(Boolean).join(", ") || "-",
      paymentDate: new Date(receipt.paymentDate).toLocaleDateString("en-GB"),
      rawPaymentDate: receipt.paymentDate,
      method: receipt.paymentMethod.replace(/_/g, " "),
      reference: receipt.bankReference ?? receipt.externalReference ?? "-",
      amount: formatCurrency(toNumber(receipt.amount)),
      rawAmount: toNumber(receipt.amount),
      status: (receipt.status === "POSTED" ? "Submitted" : receipt.status === "CANCELLED" ? "Blocked" : "Draft") as AppStatus,
      source: receipt,
    }));
  }, [receipts]);

  const draftPreviewInvoice = useMemo<SalesInvoiceRecord | null>(() => {
    if (!invoiceDraft.customerId || lines.length === 0) {
      return null;
    }

    const customer = customers.find((entry) => entry.id === Number(invoiceDraft.customerId));
    if (!customer) {
      return null;
    }

    const validItems = lines.filter((line) => line.productId && line.quantity > 0 && line.unitPrice > 0);
    if (validItems.length === 0) {
      return null;
    }

    return {
      id: 0,
      number: "DRAFT PREVIEW",
      customerId: customer.id,
      date: invoiceDraft.invoiceDate,
      dueDate: invoiceDraft.dueDate,
      status: "DRAFT",
      total: totals.total,
      customer,
      items: validItems.map((line, index) => ({
        id: index + 1,
        productId: Number(line.productId),
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxRate: line.taxRate,
        product: products.find((product) => product.id === Number(line.productId)),
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [customers, invoiceDraft.customerId, invoiceDraft.dueDate, invoiceDraft.invoiceDate, lines, products, totals.total]);

  const processBlueprint = useMemo(
    () =>
      buildSalesWorkflow({
        customerCount: customers.length,
        productCount: products.length,
        taxCodeCount: taxConfigs.length,
        invoiceCount: invoices.length,
      }),
    [customers.length, invoices.length, products.length, taxConfigs.length],
  );

  function scrollToDesk() {
    document.getElementById("sales-invoice-desk")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateLine(id: string, patch: Partial<InvoiceLineDraft>) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((current) => [
      ...current,
      { id: String(Date.now()), productId: products[0]?.id ?? "", quantity: 1, unitPrice: 0, taxRate: 0 },
    ]);
  }

  function openDraftPreview() {
    if (!draftPreviewInvoice) {
      setMessage("Complete at least one valid invoice line before previewing.");
      return;
    }
    setPreviewInvoice(draftPreviewInvoice);
    setMessage("Draft preview is ready. You can review it before saving.");
  }

  async function handleCreateCustomer() {
    if (!session?.token || !activeCompany?.id || !customerDraft.name.trim()) {
      setMessage("Enter at least a customer name before adding a customer.");
      return;
    }
    setSaving(true);
    try {
      const customer = await createSalesCustomer(session.token, {
        companyId: activeCompany.id,
        name: customerDraft.name.trim(),
        email: customerDraft.email.trim() || undefined,
        phone: customerDraft.phone.trim() || undefined,
      });
      await loadSalesData(session.token);
      setInvoiceDraft((current) => ({ ...current, customerId: customer.id }));
      setCustomerDraft({ name: "", email: "", phone: "" });
      setMessage("Customer saved to the database and selected for the invoice.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create customer.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateInvoice() {
    if (!session?.token) {
      setMessage("You need an active session before creating an invoice.");
      return;
    }
    if (!activeCompany?.id) {
      setMessage("Select an active company before creating an invoice.");
      return;
    }
    if (!invoiceDraft.customerId) {
      setMessage("Select or create a customer first.");
      return;
    }
    if (lines.some((line) => !line.productId || line.quantity <= 0 || line.unitPrice <= 0)) {
      setMessage("Each invoice line needs a product, quantity, and unit price greater than zero.");
      return;
    }

    setSaving(true);
    try {
      await createSalesInvoice(session.token, {
        legalEntityId: activeCompany.id,
        customerId: Number(invoiceDraft.customerId),
        date: invoiceDraft.invoiceDate,
        dueDate: invoiceDraft.dueDate,
        warehouseId: invoiceDraft.warehouseId ? Number(invoiceDraft.warehouseId) : undefined,
        items: lines.map((line) => ({
          productId: Number(line.productId),
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          taxRate: Number(line.taxRate || 0),
        })),
      });
      await loadSalesData(session.token);
      setLines([{ id: String(Date.now()), productId: products[0]?.id ?? "", quantity: 1, unitPrice: 0, taxRate: 0 }]);
      setPreviewInvoice(null);
      setMessage("Invoice saved to the database and the live sales register has been refreshed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create invoice.");
    } finally {
      setSaving(false);
    }
  }

  function openReceiptDraft(invoiceId: string) {
    const invoice = invoices.find((entry) => String(entry.id) === invoiceId);
    if (!invoice) {
      setMessage("Could not locate the selected invoice for receipt creation.");
      return;
    }
    setReceiptDraft((current) => ({
      ...current,
      invoiceId: invoice.id,
      narration: current.narration || `Customer receipt for ${invoice.number}`,
    }));
    document.getElementById("sales-receipt-desk")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMessage(`Receipt desk is ready for ${invoice.number}. Complete payment method and reference details.`);
  }

  async function handleCreateReceipt() {
    if (!session?.token || !activeCompany?.id || !activeBranch?.id) {
      setMessage("You need an active company and branch before recording a receipt.");
      return;
    }
    if (!selectedReceiptInvoice) {
      setMessage("Select an invoice to record the customer receipt against.");
      return;
    }
    if (!receiptDraft.receivableAccountId) {
      setMessage("Select the receivable control account for this receipt.");
      return;
    }
    if (!receiptDraft.bankAccountId && !receiptDraft.cashAccountId) {
      setMessage("Choose a bank account or cash account before saving the receipt.");
      return;
    }

    setSaving(true);
    try {
      await createCustomerReceipt(session.token, {
        legalEntityId: activeCompany.id,
        branchId: activeBranch.id,
        customerId: selectedReceiptInvoice.customerId,
        bankAccountId: receiptDraft.bankAccountId ? Number(receiptDraft.bankAccountId) : undefined,
        cashAccountId: receiptDraft.cashAccountId ? Number(receiptDraft.cashAccountId) : undefined,
        receivableAccountId: Number(receiptDraft.receivableAccountId),
        paymentMethod: receiptDraft.paymentMethod as
          | "BANK_TRANSFER"
          | "CHEQUE"
          | "CASH"
          | "CARD"
          | "GATEWAY"
          | "WALLET",
        paymentDate: receiptDraft.paymentDate,
        postingDate: receiptDraft.postingDate,
        currencyCode: activeCompany.currency?.code ?? "NGN",
        bankReference: receiptDraft.bankReference || undefined,
        externalReference: receiptDraft.externalReference || undefined,
        narration: receiptDraft.narration.trim() || `Customer receipt for ${selectedReceiptInvoice.number}`,
        remarks: receiptDraft.remarks.trim() || undefined,
        lines: [
          {
            invoiceId: selectedReceiptInvoice.id,
            description: `Settlement for ${selectedReceiptInvoice.number}`,
            appliedAmount: toNumber(selectedReceiptInvoice.total),
          },
        ],
      });
      await loadSalesData(session.token);
      setReceiptDraft((current) => ({
        ...current,
        invoiceId: invoices[0]?.id ?? "",
        bankReference: "",
        externalReference: "",
        narration: "",
        remarks: "",
      }));
      setMessage("Customer receipt saved. You can now preview, print, export PDF, or post it to GL.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the customer receipt.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePostReceipt(receiptId: string) {
    if (!session?.token) {
      setMessage("You need an active session before posting the receipt.");
      return;
    }
    setSaving(true);
    try {
      await postCustomerReceipt(session.token, Number(receiptId));
      await loadSalesData(session.token);
      setMessage("Receipt posted to the general ledger and invoice balances refreshed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not post the customer receipt.");
    } finally {
      setSaving(false);
    }
  }

  function printOne(invoiceId: string) {
    const invoice = invoices.find((entry) => String(entry.id) === invoiceId);
    if (!invoice) {
      setMessage("Could not locate the selected invoice for printing.");
      return;
    }
    try {
      printInvoices([invoice], activeCompany, activeBranch?.name ?? session?.branchName);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open invoice print view.");
    }
  }

  function previewOne(invoiceId: string) {
    const invoice = invoices.find((entry) => String(entry.id) === invoiceId);
    if (!invoice) {
      setMessage("Could not locate the selected invoice for preview.");
      return;
    }
    setPreviewInvoice(invoice);
  }

  function exportOnePdf(invoiceId: string) {
    const invoice = invoices.find((entry) => String(entry.id) === invoiceId);
    if (!invoice) {
      setMessage("Could not locate the selected invoice for PDF export.");
      return;
    }
    exportInvoicesPdf([invoice], activeCompany, activeBranch?.name ?? session?.branchName);
    setMessage(`Exported ${invoice.number} to PDF.`);
  }

  function previewOneReceipt(receiptId: string) {
    const receipt = receipts.find((entry) => String(entry.id) === receiptId);
    if (!receipt) {
      setMessage("Could not locate the selected receipt for preview.");
      return;
    }
    setPreviewReceipt(receipt);
  }

  function printOneReceipt(receiptId: string) {
    const receipt = receipts.find((entry) => String(entry.id) === receiptId);
    if (!receipt) {
      setMessage("Could not locate the selected receipt for printing.");
      return;
    }
    try {
      printReceipts([receipt], { company: activeCompany, branchName: activeBranch?.name ?? session?.branchName });
      setMessage(`Opened receipt print for ${receipt.receiptNumber}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open receipt print view.");
    }
  }

  function exportOneReceiptPdf(receiptId: string) {
    const receipt = receipts.find((entry) => String(entry.id) === receiptId);
    if (!receipt) {
      setMessage("Could not locate the selected receipt for PDF export.");
      return;
    }
    exportReceiptsPdf([receipt], { company: activeCompany, branchName: activeBranch?.name ?? session?.branchName });
    setMessage(`Exported ${receipt.receiptNumber} to PDF.`);
  }

  function handleInvoiceBulkAction(action: string, rows: Array<(typeof invoiceRows)[number]>) {
    const selectedInvoices = rows.map((row) => row.source);
    if (selectedInvoices.length === 0) {
      return;
    }
    if (action === "Print") {
      printInvoices(selectedInvoices, activeCompany, activeBranch?.name ?? session?.branchName);
      setMessage(`Opened ${selectedInvoices.length} invoice${selectedInvoices.length === 1 ? "" : "s"} for batch print.`);
      return;
    }
    if (action === "Preview") {
      setPreviewInvoice(selectedInvoices[0] ?? null);
      setMessage(`Previewing ${selectedInvoices[0]?.number ?? "the selected invoice"}.`);
      return;
    }
    if (action === "Export PDF") {
      exportInvoicesPdf(selectedInvoices, activeCompany, activeBranch?.name ?? session?.branchName);
      setMessage(`Exported ${selectedInvoices.length} invoice${selectedInvoices.length === 1 ? "" : "s"} to PDF.`);
      return;
    }
    if (action === "Create Receipt") {
      if (selectedInvoices.length === 1) {
        openReceiptDraft(String(selectedInvoices[0]?.id ?? ""));
      } else {
        setMessage("Select one invoice and create a true customer receipt draft before printing.");
      }
    }
  }

  function handleReceiptBulkAction(action: string, rows: Array<(typeof receiptRows)[number]>) {
    const selectedReceipts = rows.map((row) => row.source);
    if (!selectedReceipts.length) return;
    if (action === "Preview") {
      setPreviewReceipt(selectedReceipts[0] ?? null);
      return;
    }
    if (action === "Print") {
      printReceipts(selectedReceipts, { company: activeCompany, branchName: activeBranch?.name ?? session?.branchName });
      setMessage(`Opened ${selectedReceipts.length} receipt${selectedReceipts.length === 1 ? "" : "s"} for print.`);
      return;
    }
    if (action === "Export PDF") {
      exportReceiptsPdf(selectedReceipts, { company: activeCompany, branchName: activeBranch?.name ?? session?.branchName });
      setMessage(`Exported ${selectedReceipts.length} receipt${selectedReceipts.length === 1 ? "" : "s"} to PDF.`);
      return;
    }
    if (action === "Post to GL") {
      if (selectedReceipts.length > 1) {
        setMessage("Post receipts to GL one at a time so posting feedback stays clear.");
        return;
      }
      void handlePostReceipt(String(selectedReceipts[0]?.id ?? ""));
    }
  }

  return (
    <WorkspaceShell
      title="Sales"
      description="Create and store live invoices, manage customers, and keep receivables records in the ERP."
      pageActions={
        <ModuleActionBar
          primaryAction={
            <button className="primary-button" type="button" onClick={scrollToDesk}>
              Create invoice
            </button>
          }
          summary="The invoice desk stays front and center. Preview, printing, batch output, and customer setup move into grouped menus above."
          secondaryGroups={[
            {
              label: "Actions",
              items: [
                {
                  label: "Refresh invoices",
                  description: "Reload customers, products, and the invoice register",
                  onSelect: () => session?.token && loadSalesData(session.token),
                },
                {
                  label: "Preview draft",
                  description: "Review the current invoice before saving",
                  onSelect: openDraftPreview,
                },
                {
                  label: "Open customer onboarding",
                  description: "Jump to customer creation",
                  onSelect: () => document.getElementById("sales-customer-desk")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
              ],
            },
            {
              label: "Print & Export",
              items: [
                {
                  label: "Print current invoice",
                  description: "Print the draft preview or latest saved invoice",
                  onSelect: () => {
                    if (draftPreviewInvoice) {
                      printInvoices([draftPreviewInvoice], activeCompany, activeBranch?.name ?? session?.branchName);
                    } else if (invoices[0]) {
                      printInvoices([invoices[0]], activeCompany, activeBranch?.name ?? session?.branchName);
                    } else {
                      setMessage("Create or preview an invoice before printing.");
                    }
                  },
                },
                {
                  label: "Batch print",
                  description: "Print all stored invoices",
                  onSelect: () => printInvoices(invoices, activeCompany, activeBranch?.name ?? session?.branchName),
                  disabled: !invoices.length,
                },
                {
                  label: "Batch receipt print",
                  description: "Print all stored customer receipts",
                  onSelect: () => printReceipts(receipts, { company: activeCompany, branchName: activeBranch?.name ?? session?.branchName }),
                  disabled: !receipts.length,
                },
                {
                  label: "Batch receipt PDF",
                  description: "Export all stored customer receipts to PDF",
                  onSelect: () => exportReceiptsPdf(receipts, { company: activeCompany, branchName: activeBranch?.name ?? session?.branchName }),
                  disabled: !receipts.length,
                },
                {
                  label: "Batch invoice PDF",
                  description: "Export all stored invoices to PDF",
                  onSelect: () => exportInvoicesPdf(invoices, activeCompany, activeBranch?.name ?? session?.branchName),
                  disabled: !invoices.length,
                },
              ],
            },
            {
              label: "Reports",
              items: [
                { label: "Customer statements", href: "/reports?view=Account%20Statement%20Summary", description: "Receivables summary by account" },
                { label: "CRM workspace", href: "/crm", description: "Customer master and pipeline" },
              ],
            },
          ]}
        />
      }
    >
      <ProcessArchitecturePanel
        blueprint={processBlueprint}
        checklistActions={{
          "sales-customers": {
            label: customers.length ? "Open CRM" : "Create customer",
            href: customers.length ? "/crm" : undefined,
            onSelect: customers.length
              ? undefined
              : () => document.getElementById("sales-customer-desk")?.scrollIntoView({ behavior: "smooth", block: "start" }),
          },
          "sales-products": {
            label: products.length ? "View inventory" : "Set up items",
            href: products.length ? "/inventory?view=Items" : "/administration?view=Import%20%26%20Export",
          },
          "sales-tax": {
            label: taxConfigs.length ? "Review tax" : "Configure tax",
            href: "/tax",
          },
          "sales-direct-invoice": {
            label: "Open invoice desk",
            onSelect: () => document.getElementById("sales-invoice-desk")?.scrollIntoView({ behavior: "smooth", block: "start" }),
          },
        }}
        nextActions={[
          {
            id: "sales-next-direct",
            label: "Create direct invoice",
            detail: "Use the live invoice desk once customer and item prerequisites are satisfied.",
            onSelect: () => document.getElementById("sales-invoice-desk")?.scrollIntoView({ behavior: "smooth", block: "start" }),
          },
          {
            id: "sales-next-crm",
            label: "Review customer onboarding",
            detail: "Go to CRM to approve onboarding and keep master data clean before billing.",
            href: "/crm",
          },
          {
            id: "sales-next-statements",
            label: "Follow through to statements",
            detail: "After invoicing, drill into receivables statements and customer balances.",
            href: "/reports?view=Account%20Statement%20Summary",
          },
        ]}
      />

      <section className="content-grid split-65">
        <SectionCard title="Invoice creation template" eyebrow="Stored transaction entry">
          {customers.length === 0 && !loading ? (
            <EmptyState tone="sales" title="No customers yet" body="Create a customer in the panel below, then return to the invoice template." />
          ) : null}

          <div className="action-form-stack" id="sales-invoice-desk">
            <div className="form-grid two-up">
              <label className="field">
                <span>Customer</span>
                <select
                  className="select-input"
                  value={invoiceDraft.customerId}
                  onChange={(event) => setInvoiceDraft((current) => ({ ...current, customerId: event.target.value ? Number(event.target.value) : "" }))}
                >
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Warehouse</span>
                <select
                  className="select-input"
                  value={invoiceDraft.warehouseId}
                  onChange={(event) => setInvoiceDraft((current) => ({ ...current, warehouseId: event.target.value ? Number(event.target.value) : "" }))}
                >
                  <option value="">No stock posting</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-grid two-up">
              <label className="field">
                <span>Invoice date</span>
                <input type="date" value={invoiceDraft.invoiceDate} onChange={(event) => setInvoiceDraft((current) => ({ ...current, invoiceDate: event.target.value }))} />
              </label>
              <label className="field">
                <span>Due date</span>
                <input type="date" value={invoiceDraft.dueDate} onChange={(event) => setInvoiceDraft((current) => ({ ...current, dueDate: event.target.value }))} />
              </label>
            </div>

            <div className="line-grid">
              <div className="line-grid__header" style={{ gridTemplateColumns: "1.2fr 0.6fr 0.7fr 0.6fr" }}>
                <span>Product</span>
                <span>Quantity</span>
                <span>Unit price</span>
                <span>Tax %</span>
              </div>
              {lines.map((line) => (
                <div key={line.id} className="line-grid__row" style={{ gridTemplateColumns: "1.2fr 0.6fr 0.7fr 0.6fr" }}>
                  <select
                    className="select-input"
                    value={line.productId}
                    onChange={(event) => updateLine(line.id, { productId: event.target.value ? Number(event.target.value) : "" })}
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.sku} - {product.name}
                      </option>
                    ))}
                  </select>
                  <input type="number" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: Number(event.target.value) })} />
                  <input type="number" value={line.unitPrice} onChange={(event) => updateLine(line.id, { unitPrice: Number(event.target.value) })} />
                  <input type="number" value={line.taxRate} onChange={(event) => updateLine(line.id, { taxRate: Number(event.target.value) })} />
                </div>
              ))}
            </div>

            <div className="inline-actions compact-end">
              <button className="ghost-button" type="button" onClick={openDraftPreview}>
                Preview invoice
              </button>
              <button className="ghost-button" type="button" onClick={addLine}>Add line</button>
              <div className="totals-panel slim">
                <div><span>Subtotal</span><strong>{formatCurrency(totals.subtotal)}</strong></div>
                <div><span>Tax</span><strong>{formatCurrency(totals.tax)}</strong></div>
                <div><span>Total</span><strong>{formatCurrency(totals.total)}</strong></div>
              </div>
            </div>

            <div className="inline-actions compact-end">
              <button className="primary-button" type="button" onClick={handleCreateInvoice} disabled={saving || loading}>
                {saving ? "Saving..." : "Save invoice"}
              </button>
            </div>
          </div>
          <p className="note">{message}</p>
        </SectionCard>

        <SectionCard title="Customer receipt desk" eyebrow="True receipt voucher">
          <div className="action-form-stack" id="sales-receipt-desk">
            <label className="field">
              <span>Linked invoice</span>
              <select
                className="select-input"
                value={receiptDraft.invoiceId}
                onChange={(event) => setReceiptDraft((current) => ({ ...current, invoiceId: event.target.value ? Number(event.target.value) : "" }))}
              >
                <option value="">Select invoice</option>
                {invoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.number} - {invoice.customer?.name ?? "Unmapped customer"}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-grid two-up">
              <label className="field">
                <span>Payment date</span>
                <input
                  type="date"
                  value={receiptDraft.paymentDate}
                  onChange={(event) => setReceiptDraft((current) => ({ ...current, paymentDate: event.target.value }))}
                />
              </label>
              <label className="field">
                <span>Posting date</span>
                <input
                  type="date"
                  value={receiptDraft.postingDate}
                  onChange={(event) => setReceiptDraft((current) => ({ ...current, postingDate: event.target.value }))}
                />
              </label>
            </div>

            <div className="form-grid two-up">
              <label className="field">
                <span>Payment method</span>
                <select
                  className="select-input"
                  value={receiptDraft.paymentMethod}
                  onChange={(event) =>
                    setReceiptDraft((current) => ({
                      ...current,
                      paymentMethod: event.target.value,
                      cashAccountId: event.target.value === "CASH" ? current.cashAccountId : "",
                      bankAccountId: event.target.value === "CASH" ? "" : current.bankAccountId,
                    }))
                  }
                >
                  {(receiptMetadata?.paymentMethods ?? ["BANK_TRANSFER", "CHEQUE", "CASH", "CARD", "GATEWAY", "WALLET"]).map((method) => (
                    <option key={method} value={method}>
                      {method.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Receivable account</span>
                <select
                  className="select-input"
                  value={receiptDraft.receivableAccountId}
                  onChange={(event) => setReceiptDraft((current) => ({ ...current, receivableAccountId: event.target.value ? Number(event.target.value) : "" }))}
                >
                  <option value="">Select AR account</option>
                  {(receiptMetadata?.receivableAccounts ?? []).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {receiptDraft.paymentMethod === "CASH" ? (
              <label className="field">
                <span>Cash account</span>
                <select
                  className="select-input"
                  value={receiptDraft.cashAccountId}
                  onChange={(event) => setReceiptDraft((current) => ({ ...current, cashAccountId: event.target.value ? Number(event.target.value) : "", bankAccountId: "" }))}
                >
                  <option value="">Select cash account</option>
                  {(receiptMetadata?.cashAccounts ?? []).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="field">
                <span>Bank account</span>
                <select
                  className="select-input"
                  value={receiptDraft.bankAccountId}
                  onChange={(event) => setReceiptDraft((current) => ({ ...current, bankAccountId: event.target.value ? Number(event.target.value) : "", cashAccountId: "" }))}
                >
                  <option value="">Select bank account</option>
                  {(receiptMetadata?.bankAccounts ?? []).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} {account.number ? `- ${account.number}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="form-grid two-up">
              <label className="field">
                <span>Bank reference</span>
                <input
                  value={receiptDraft.bankReference}
                  onChange={(event) => setReceiptDraft((current) => ({ ...current, bankReference: event.target.value }))}
                  placeholder="e.g. TRF-20260314-009"
                />
              </label>
              <label className="field">
                <span>External reference</span>
                <input
                  value={receiptDraft.externalReference}
                  onChange={(event) => setReceiptDraft((current) => ({ ...current, externalReference: event.target.value }))}
                  placeholder="Optional external ref"
                />
              </label>
            </div>

            <label className="field">
              <span>Narration</span>
              <input
                value={receiptDraft.narration}
                onChange={(event) => setReceiptDraft((current) => ({ ...current, narration: event.target.value }))}
                placeholder={selectedReceiptInvoice ? `Customer receipt for ${selectedReceiptInvoice.number}` : "Customer receipt narration"}
              />
            </label>
            <label className="field">
              <span>Remarks</span>
              <textarea
                rows={3}
                value={receiptDraft.remarks}
                onChange={(event) => setReceiptDraft((current) => ({ ...current, remarks: event.target.value }))}
                placeholder="Optional treasury or remittance note"
              />
            </label>

            <div className="totals-panel slim">
              <div>
                <span>Customer</span>
                <strong>{selectedReceiptInvoice?.customer?.name ?? "Select invoice"}</strong>
              </div>
              <div>
                <span>Invoice</span>
                <strong>{selectedReceiptInvoice?.number ?? "-"}</strong>
              </div>
              <div>
                <span>Receipt amount</span>
                <strong>{formatCurrency(toNumber(selectedReceiptInvoice?.total ?? 0))}</strong>
              </div>
            </div>

            <div className="inline-actions compact-end">
              <button className="primary-button" type="button" onClick={handleCreateReceipt} disabled={saving || loading}>
                {saving ? "Saving..." : "Save receipt"}
              </button>
            </div>
          </div>
        </SectionCard>
      </section>

      <SectionCard title="Quick customer add" eyebrow="Master data on the fly">
        <div className="action-form-stack" id="sales-customer-desk">
          <label className="field">
            <span>Customer name</span>
            <input value={customerDraft.name} onChange={(event) => setCustomerDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Atlantic Retail" />
          </label>
          <label className="field">
            <span>Email</span>
            <input value={customerDraft.email} onChange={(event) => setCustomerDraft((current) => ({ ...current, email: event.target.value }))} placeholder="e.g. accounts@atlanticretail.com" />
          </label>
          <label className="field">
            <span>Phone</span>
            <input value={customerDraft.phone} onChange={(event) => setCustomerDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="e.g. +2348000000000" />
          </label>
          <div className="inline-actions compact-end">
            <button className="ghost-button" type="button" onClick={handleCreateCustomer} disabled={saving}>
              Add customer
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Stored invoices" eyebrow="Live sales records">
        <div id="sales-stored-invoices" />
        <DataTable
          title="Sales invoice register"
          tableId="sales-invoices"
          exportFileName="sales-invoices"
          rows={invoiceRows}
          searchValue={(row) => `${row.number} ${row.customer} ${row.status}`}
          filters={[
            { key: "submitted", label: "Submitted", predicate: (row) => row.status === "Submitted" },
            { key: "draft", label: "Draft", predicate: (row) => row.status === "Draft" },
          ]}
          advancedFilters={[
            { key: "customer", label: "Customer", type: "text", getValue: (row) => row.customer },
            {
              key: "status",
              label: "Status",
              type: "select",
              getValue: (row) => row.status,
              options: [
                { value: "Submitted", label: "Submitted" },
                { value: "Draft", label: "Draft" },
              ],
            },
            { key: "invoiceDate", label: "Invoice date", type: "date-range", getValue: (row) => row.rawDate },
            { key: "dueDate", label: "Due date", type: "date-range", getValue: (row) => row.rawDueDate },
            { key: "total", label: "Total amount", type: "number-range", getValue: (row) => row.rawTotal },
          ]}
          bulkActions={["Preview", "Print", "Create Receipt", "Export PDF", "Export"]}
          onBulkAction={handleInvoiceBulkAction}
          emptyTitle={loading ? "Loading invoices" : "No invoices yet"}
          emptyMessage={loading ? "Pulling live invoices from the sales API." : "Create an invoice above and it will appear here."}
          columns={[
            { key: "number", label: "Invoice", render: (row) => <strong>{row.number}</strong> },
            { key: "customer", label: "Customer", render: (row) => row.customer },
            { key: "date", label: "Date", render: (row) => row.date },
            { key: "dueDate", label: "Due", render: (row) => row.dueDate },
            { key: "items", label: "Lines", className: "numeric", render: (row) => row.items },
            { key: "total", label: "Total", className: "numeric", render: (row) => row.total },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
            {
              key: "actions",
              label: "Output",
              render: (row) => (
                <RowActionMenu
                  label={`Actions for ${row.number}`}
                  items={[
                    { label: "Preview invoice", description: "Open the invoice preview panel", onSelect: () => previewOne(row.id) },
                    { label: "Print invoice", description: "Open the browser print dialog", onSelect: () => printOne(row.id) },
                    { label: "Create receipt draft", description: "Open the true customer receipt desk", onSelect: () => openReceiptDraft(row.id) },
                    { label: "Export PDF", description: "Download the invoice as PDF", onSelect: () => exportOnePdf(row.id) },
                  ]}
                />
              ),
            },
          ]}
        />
      </SectionCard>

      <SectionCard title="Stored receipts" eyebrow="True customer receipt records">
        <DataTable
          title="Customer receipt register"
          tableId="sales-receipts"
          exportFileName="customer-receipts"
          rows={receiptRows}
          searchValue={(row) => `${row.number} ${row.customer} ${row.reference} ${row.invoiceRefs}`}
          filters={[
            { key: "posted", label: "Posted", predicate: (row) => row.status === "Submitted" },
            { key: "draft", label: "Draft", predicate: (row) => row.status === "Draft" },
          ]}
          advancedFilters={[
            { key: "customer", label: "Customer", type: "text", getValue: (row) => row.customer },
            { key: "invoice", label: "Invoice ref", type: "text", getValue: (row) => row.invoiceRefs },
            { key: "paymentDate", label: "Payment date", type: "date-range", getValue: (row) => row.rawPaymentDate },
            { key: "amount", label: "Receipt amount", type: "number-range", getValue: (row) => row.rawAmount },
            {
              key: "method",
              label: "Payment method",
              type: "select",
              getValue: (row) => row.method,
              options: [...new Set(receiptRows.map((row) => row.method))].map((value) => ({ value, label: value })),
            },
          ]}
          bulkActions={["Preview", "Print", "Export PDF", "Post to GL", "Export"]}
          onBulkAction={handleReceiptBulkAction}
          emptyTitle={loading ? "Loading receipts" : "No receipts yet"}
          emptyMessage={
            loading ? "Pulling live receipt vouchers from the sales API." : "Save a customer receipt above and it will appear here."
          }
          columns={[
            { key: "number", label: "Receipt", render: (row) => <strong>{row.number}</strong> },
            { key: "customer", label: "Customer", render: (row) => row.customer },
            { key: "invoiceRefs", label: "Invoice Ref", render: (row) => row.invoiceRefs },
            { key: "paymentDate", label: "Payment date", render: (row) => row.paymentDate },
            { key: "method", label: "Method", render: (row) => row.method },
            { key: "reference", label: "Bank ref", render: (row) => row.reference },
            { key: "amount", label: "Amount", className: "numeric", render: (row) => row.amount },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
            {
              key: "actions",
              label: "Output",
              render: (row) => (
                <RowActionMenu
                  label={`Actions for ${row.number}`}
                  items={[
                    { label: "Preview receipt", description: "Open the receipt preview panel", onSelect: () => previewOneReceipt(row.id) },
                    { label: "Print receipt", description: "Open the browser print dialog", onSelect: () => printOneReceipt(row.id) },
                    { label: "Export PDF", description: "Download the receipt as PDF", onSelect: () => exportOneReceiptPdf(row.id) },
                    {
                      label: "Post to GL",
                      description: "Commit the receipt to the general ledger",
                      onSelect: () => void handlePostReceipt(row.id),
                      disabled: row.source.status === "POSTED",
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </SectionCard>

      {previewInvoice ? (
        <aside className="side-panel invoice-preview-panel">
          <div className="side-panel__header">
            <div>
              <span className="section-eyebrow">Invoice preview</span>
              <h3>{previewInvoice.number}</h3>
            </div>
            <button type="button" className="ghost-button small" onClick={() => setPreviewInvoice(null)}>
              Close
            </button>
          </div>
          <div className="invoice-preview-sheet">
            <div className="invoice-preview-sheet__top">
              <div>
                <span className="label">Company</span>
                <strong>{activeCompany?.name ?? "Haqly"}</strong>
                <p>{activeBranch?.name ?? session?.branchName ?? "Head Office"}</p>
              </div>
              <div className="invoice-preview-meta">
                <div><span>Date</span><strong>{new Date(previewInvoice.date).toLocaleDateString("en-GB")}</strong></div>
                <div><span>Due</span><strong>{previewInvoice.dueDate ? new Date(previewInvoice.dueDate).toLocaleDateString("en-GB") : "-"}</strong></div>
                <div><span>Status</span><strong>{previewInvoice.status}</strong></div>
              </div>
            </div>

            <div className="invoice-preview-billto">
              <div>
                <span className="label">Bill to</span>
                <strong>{previewInvoice.customer?.name ?? "Unmapped customer"}</strong>
                <p>{previewInvoice.customer?.email ?? ""}</p>
                <p>{previewInvoice.customer?.phone ?? ""}</p>
              </div>
              <div className="invoice-preview-totalcard">
                <div><span>Subtotal</span><strong>{formatCurrency(previewInvoice.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0))}</strong></div>
                <div><span>Tax</span><strong>{formatCurrency(previewInvoice.items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice) * Number(item.taxRate ?? 0)) / 100, 0))}</strong></div>
                <div className="grand"><span>Total</span><strong>{formatCurrency(toNumber(previewInvoice.total))}</strong></div>
              </div>
            </div>

            <div className="table-wrap invoice-preview-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th className="numeric">Qty</th>
                    <th className="numeric">Unit Price</th>
                    <th className="numeric">Tax</th>
                    <th className="numeric">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {previewInvoice.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.product?.name ?? `Product ${item.productId}`}</strong>
                        <div className="cell-subcopy">{item.product?.sku ?? "No SKU"}</div>
                      </td>
                      <td className="numeric">{Number(item.quantity).toFixed(2)}</td>
                      <td className="numeric">{formatCurrency(Number(item.unitPrice))}</td>
                      <td className="numeric">{Number(item.taxRate ?? 0).toFixed(2)}%</td>
                      <td className="numeric">{formatCurrency(Number(item.quantity) * Number(item.unitPrice))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="inline-actions compact-end">
              <button
                className="ghost-button with-icon"
                type="button"
                onClick={() => previewInvoices([previewInvoice], activeCompany, activeBranch?.name ?? session?.branchName)}
              >
                <Eye size={16} /> Open preview window
              </button>
              <button
                className="ghost-button with-icon"
                type="button"
                onClick={() => printInvoices([previewInvoice], activeCompany, activeBranch?.name ?? session?.branchName)}
              >
                <Printer size={16} /> Print
              </button>
              <button className="ghost-button with-icon" type="button" onClick={() => openReceiptDraft(String(previewInvoice.id))}>
                <Printer size={16} /> Record Receipt
              </button>
              <button
                className="primary-button with-icon"
                type="button"
                onClick={() => exportInvoicesPdf([previewInvoice], activeCompany, activeBranch?.name ?? session?.branchName)}
              >
                <FileDown size={16} /> Export PDF
              </button>
            </div>
          </div>
        </aside>
      ) : null}

      {previewReceipt ? (
        <aside className="side-panel invoice-preview-panel">
          <div className="side-panel__header">
            <div>
              <span className="section-eyebrow">Receipt preview</span>
              <h3>{previewReceipt.receiptNumber}</h3>
            </div>
            <button type="button" className="ghost-button small" onClick={() => setPreviewReceipt(null)}>
              Close
            </button>
          </div>
          <div className="invoice-preview-sheet">
            <div className="invoice-preview-sheet__top">
              <div>
                <span className="label">Company</span>
                <strong>{activeCompany?.name ?? "Haqly"}</strong>
                <p>{activeBranch?.name ?? session?.branchName ?? "Head Office"}</p>
              </div>
              <div className="invoice-preview-meta">
                <div><span>Paid</span><strong>{new Date(previewReceipt.paymentDate).toLocaleDateString("en-GB")}</strong></div>
                <div><span>Method</span><strong>{previewReceipt.paymentMethod.replace(/_/g, " ")}</strong></div>
                <div><span>Status</span><strong>{previewReceipt.status}</strong></div>
              </div>
            </div>

            <div className="invoice-preview-billto">
              <div>
                <span className="label">Received from</span>
                <strong>{previewReceipt.customer?.name ?? "Unmapped customer"}</strong>
                <p>{previewReceipt.customer?.email ?? ""}</p>
                <p>{previewReceipt.customer?.phone ?? ""}</p>
                <p>{previewReceipt.bankReference ? `Bank ref: ${previewReceipt.bankReference}` : ""}</p>
              </div>
              <div className="invoice-preview-totalcard">
                <div><span>Receipt amount</span><strong>{formatCurrency(toNumber(previewReceipt.amount))}</strong></div>
                <div><span>GL reference</span><strong>{previewReceipt.glJournal?.reference ?? "Not posted"}</strong></div>
                <div className="grand"><span>Amount in words</span><strong>{previewReceipt.amountInWords ?? "-"}</strong></div>
              </div>
            </div>

            <div className="table-wrap invoice-preview-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Invoice</th>
                    <th>Status</th>
                    <th className="numeric">Applied Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {previewReceipt.lines.map((line) => (
                    <tr key={line.id}>
                      <td>{line.description}</td>
                      <td>{line.invoice?.number ?? "-"}</td>
                      <td>{line.invoice?.status ?? previewReceipt.status}</td>
                      <td className="numeric">{formatCurrency(toNumber(line.appliedAmount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="inline-actions compact-end">
              <button
                className="ghost-button with-icon"
                type="button"
                onClick={() => previewReceipts([previewReceipt], { company: activeCompany, branchName: activeBranch?.name ?? session?.branchName })}
              >
                <Eye size={16} /> Open preview window
              </button>
              <button
                className="ghost-button with-icon"
                type="button"
                onClick={() => printReceipts([previewReceipt], { company: activeCompany, branchName: activeBranch?.name ?? session?.branchName })}
              >
                <Printer size={16} /> Print
              </button>
              <button
                className="primary-button with-icon"
                type="button"
                onClick={() => exportReceiptsPdf([previewReceipt], { company: activeCompany, branchName: activeBranch?.name ?? session?.branchName })}
              >
                <FileDown size={16} /> Export PDF
              </button>
            </div>
          </div>
        </aside>
      ) : null}
    </WorkspaceShell>
  );
}
