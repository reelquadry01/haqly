"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Copy,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { WorkspaceShell } from "../../components/workspace-shell";
import { ActivityTimeline } from "../../components/ui/activity-timeline";
import { EmptyState } from "../../components/ui/empty-state";
import { KpiCard } from "../../components/ui/kpi-card";
import { ModuleActionBar } from "../../components/ui/module-action-bar";
import { SectionCard } from "../../components/ui/section-card";
import { ViewToolbar } from "../../components/ui/view-toolbar";
import { useWorkspace } from "../../hooks/use-workspace";
import {
  approveJournalEntry,
  cancelJournalEntry,
  createJournalDraft,
  getAccountingAccounts,
  getAccountingJournals,
  getJournalEntries,
  getJournalEntry,
  getJournalMetadata,
  postJournalEntry,
  recallJournalEntry,
  rejectJournalEntry,
  reverseJournalEntry,
  submitJournalEntry,
  updateJournalDraft,
  validateJournalEntry,
  type AccountingAccount,
  type AccountingJournal,
  type JournalEntryPayload,
  type JournalEntryRecord,
  type JournalMetadataResponse,
  type JournalStatus,
  type JournalType,
} from "../../lib/api";
import type { AppStatus, KpiMetric, TimelineItem } from "../../lib/erp";

type EditorLine = {
  id: string;
  accountId: number | "";
  debitAmount: string;
  creditAmount: string;
  lineNarration: string;
  costCenterId: number | "";
  projectId: number | "";
  taxCodeId: number | "";
};

type AttachmentDraft = {
  id: string;
  fileName: string;
  fileUrl: string;
};

type JournalEditor = {
  id?: number;
  journalNumber?: string;
  status: JournalStatus;
  journalType: JournalType;
  branchId: number | "";
  journalDate: string;
  postingDate: string;
  accountingPeriodId: number | "";
  fiscalYearId: number | "";
  currencyCode: string;
  exchangeRate: string;
  sourceDocumentNumber: string;
  referenceNumber: string;
  narration: string;
  description: string;
  costCenterId: number | "";
  projectId: number | "";
  isAutoReversing: boolean;
  autoReverseDate: string;
  attachments: AttachmentDraft[];
  lines: EditorLine[];
  postedJournalEntryId?: number | null;
  isSystemGenerated?: boolean;
  auditLogs?: JournalEntryRecord["auditLogs"];
  postedJournalEntry?: AccountingJournal | null;
};

const statusMap: Record<JournalStatus, AppStatus> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  POSTED: "Posted",
  REVERSED: "Reversed",
  CANCELLED: "Archived",
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function toAmount(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function formatMoney(amount: number, currencyCode = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function buildLine(defaults?: Partial<EditorLine>): EditorLine {
  return {
    id: makeId(),
    accountId: defaults?.accountId ?? "",
    debitAmount: defaults?.debitAmount ?? "",
    creditAmount: defaults?.creditAmount ?? "",
    lineNarration: defaults?.lineNarration ?? "",
    costCenterId: defaults?.costCenterId ?? "",
    projectId: defaults?.projectId ?? "",
    taxCodeId: defaults?.taxCodeId ?? "",
  };
}

function buildEmptyEditor(metadata: JournalMetadataResponse, branchId: number | null): JournalEditor {
  const openPeriod = metadata.periods.find((period) => period.status === "OPEN") ?? metadata.periods[0];
  return {
    status: "DRAFT",
    journalType: "MANUAL",
    branchId: branchId ?? "",
    journalDate: new Date().toISOString().slice(0, 10),
    postingDate: new Date().toISOString().slice(0, 10),
    accountingPeriodId: openPeriod?.id ?? "",
    fiscalYearId: openPeriod?.fiscalYearId ?? metadata.fiscalYears[0]?.id ?? "",
    currencyCode: metadata.company.currencyCode || "NGN",
    exchangeRate: "1",
    sourceDocumentNumber: "",
    referenceNumber: "",
    narration: "",
    description: "",
    costCenterId: "",
    projectId: "",
    isAutoReversing: false,
    autoReverseDate: "",
    attachments: [],
    lines: [buildLine(), buildLine()],
    postedJournalEntryId: null,
    isSystemGenerated: false,
    auditLogs: [],
    postedJournalEntry: null,
  };
}

function hydrateEditor(record: JournalEntryRecord): JournalEditor {
  return {
    id: record.id,
    journalNumber: record.journalNumber,
    status: record.status,
    journalType: record.journalType,
    branchId: record.branchId ?? "",
    journalDate: toDateInput(record.journalDate),
    postingDate: toDateInput(record.postingDate),
    accountingPeriodId: record.accountingPeriodId ?? "",
    fiscalYearId: record.fiscalYearId ?? "",
    currencyCode: record.currencyCode,
    exchangeRate: record.exchangeRate ? String(record.exchangeRate) : "1",
    sourceDocumentNumber: record.sourceDocumentNumber ?? "",
    referenceNumber: record.referenceNumber ?? "",
    narration: record.narration,
    description: record.description ?? "",
    costCenterId: record.costCenterId ?? "",
    projectId: record.projectId ?? "",
    isAutoReversing: record.isAutoReversing,
    autoReverseDate: toDateInput(record.autoReverseDate),
    attachments: (record.attachments ?? []).map((attachment) => ({
      id: String(attachment.id),
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
    })),
    lines: record.lines.map((line) =>
      buildLine({
        accountId: line.accountId,
        debitAmount: toAmount(line.debitAmount) ? String(toAmount(line.debitAmount)) : "",
        creditAmount: toAmount(line.creditAmount) ? String(toAmount(line.creditAmount)) : "",
        lineNarration: line.lineNarration ?? "",
        costCenterId: line.costCenterId ?? "",
        projectId: line.projectId ?? "",
        taxCodeId: line.taxCodeId ?? "",
      }),
    ),
    postedJournalEntryId: record.postedJournalEntryId,
    isSystemGenerated: record.isSystemGenerated,
    auditLogs: record.auditLogs ?? [],
    postedJournalEntry: record.postedJournalEntry ?? null,
  };
}

export default function JournalEntriesPage() {
  const { session, activeCompany, activeBranch } = useWorkspace();
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [metadata, setMetadata] = useState<JournalMetadataResponse | null>(null);
  const [journalList, setJournalList] = useState<JournalEntryRecord[]>([]);
  const [glJournals, setGlJournals] = useState<AccountingJournal[]>([]);
  const [editor, setEditor] = useState<JournalEditor | null>(null);
  const [selectedJournalId, setSelectedJournalId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"lines" | "attachments" | "audit" | "gl">("lines");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<JournalStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [attachmentDraft, setAttachmentDraft] = useState({ fileName: "", fileUrl: "" });

  const visibleJournals = useMemo(() => {
    return journalList.filter((journal) => {
      if (statusFilter !== "ALL" && journal.status !== statusFilter) {
        return false;
      }
      if (!search.trim()) {
        return true;
      }
      const haystack = [
        journal.journalNumber,
        journal.referenceNumber,
        journal.narration,
        journal.sourceDocumentNumber,
        journal.branch?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search.trim().toLowerCase());
    });
  }, [journalList, search, statusFilter]);

  const totals = useMemo(() => {
    const debit = editor?.lines.reduce((sum, line) => sum + toAmount(line.debitAmount), 0) ?? 0;
    const credit = editor?.lines.reduce((sum, line) => sum + toAmount(line.creditAmount), 0) ?? 0;
    return {
      debit,
      credit,
      difference: debit - credit,
      balanced: Math.abs(debit - credit) < 0.0001 && debit > 0 && credit > 0,
    };
  }, [editor]);

  const validationIssues = useMemo(() => {
    if (!editor) return [];
    const issues: string[] = [];
    if (!editor.branchId) issues.push("Branch is required.");
    if (!editor.accountingPeriodId) issues.push("Accounting period is required.");
    if (!editor.narration.trim()) issues.push("Narration is required.");
    const populatedLines = editor.lines.filter((line) => line.accountId !== "" || line.debitAmount || line.creditAmount || line.lineNarration);
    if (populatedLines.length < 2) issues.push("At least two journal lines are required.");
    populatedLines.forEach((line, index) => {
      const debit = toAmount(line.debitAmount);
      const credit = toAmount(line.creditAmount);
      if (line.accountId === "") issues.push(`Line ${index + 1}: account is required.`);
      if (debit > 0 && credit > 0) issues.push(`Line ${index + 1}: debit and credit cannot both have values.`);
      if (debit === 0 && credit === 0) issues.push(`Line ${index + 1}: enter a debit or a credit.`);
    });
    if (populatedLines.length >= 2 && !totals.balanced) issues.push("Journal is not balanced.");
    return issues;
  }, [editor, totals.balanced]);

  const timelineItems = useMemo<TimelineItem[]>(() => {
    if (!editor) return [];
    return (editor.auditLogs ?? []).slice(0, 6).map((log) => ({
      id: String(log.id),
      title: log.action.replace(/_/g, " "),
      subtitle: editor.narration || "Journal activity",
      timestamp: formatDate(log.createdAt),
      user: log.actorName || "System",
      status: statusMap[editor.status],
    }));
  }, [editor]);

  const currentGlMirror = useMemo(() => {
    if (!editor) return null;
    if (editor.postedJournalEntry) {
      return editor.postedJournalEntry;
    }
    return glJournals.find((entry) => entry.reference === editor.journalNumber) ?? null;
  }, [editor, glJournals]);

  const isEditable = Boolean(editor) && !editor?.isSystemGenerated && (editor?.status === "DRAFT" || editor?.status === "REJECTED");

  useEffect(() => {
    if (!session?.token || !activeCompany?.id) return;
    void loadWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token, activeCompany?.id]);

  async function loadWorkspace(preferredJournalId?: number | null) {
    if (!session?.token || !activeCompany?.id) return;
    setLoading(true);
    try {
      const [accountRows, metadataRow, journals, ledgerEntries] = await Promise.all([
        getAccountingAccounts(session.token),
        getJournalMetadata(session.token, activeCompany.id),
        getJournalEntries(session.token, { branchId: activeBranch?.id ?? undefined }),
        getAccountingJournals(session.token),
      ]);
      setAccounts(accountRows);
      setMetadata(metadataRow);
      setJournalList(journals);
      setGlJournals(ledgerEntries);

      const candidateId = preferredJournalId ?? selectedJournalId ?? journals[0]?.id ?? null;
      if (candidateId) {
        const detail = await getJournalEntry(session.token, candidateId);
        setSelectedJournalId(detail.id);
        setEditor(hydrateEditor(detail));
      } else {
        setSelectedJournalId(null);
        setEditor(buildEmptyEditor(metadataRow, activeBranch?.id ?? null));
      }
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Could not load journal workspace.");
    } finally {
      setLoading(false);
    }
  }

  function resetNewJournal() {
    if (!metadata) return;
    setSelectedJournalId(null);
    setEditor(buildEmptyEditor(metadata, activeBranch?.id ?? null));
    setActiveTab("lines");
    setMessage("");
  }

  async function openJournal(journalId: number) {
    if (!session?.token) return;
    setLoading(true);
    try {
      const detail = await getJournalEntry(session.token, journalId);
      setSelectedJournalId(detail.id);
      setEditor(hydrateEditor(detail));
      setMessage("");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Could not load that journal.");
    } finally {
      setLoading(false);
    }
  }

  function updateEditor<K extends keyof JournalEditor>(field: K, value: JournalEditor[K]) {
    setEditor((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateLine(lineId: string, patch: Partial<EditorLine>) {
    setEditor((current) =>
      current
        ? {
            ...current,
            lines: current.lines.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
          }
        : current,
    );
  }

  function addLine(copyFrom?: EditorLine) {
    setEditor((current) => (current ? { ...current, lines: [...current.lines, buildLine(copyFrom)] } : current));
  }

  function removeLine(lineId: string) {
    setEditor((current) => {
      if (!current) return current;
      if (current.lines.length <= 2) {
        setMessageTone("error");
        setMessage("At least two journal lines should remain on the entry.");
        return current;
      }
      return { ...current, lines: current.lines.filter((line) => line.id !== lineId) };
    });
  }

  function addAttachment() {
    if (!attachmentDraft.fileName.trim() || !attachmentDraft.fileUrl.trim()) {
      setMessageTone("error");
      setMessage("Enter an attachment name and URL before adding it.");
      return;
    }
    setEditor((current) =>
      current
        ? {
            ...current,
            attachments: [...current.attachments, { id: makeId(), fileName: attachmentDraft.fileName.trim(), fileUrl: attachmentDraft.fileUrl.trim() }],
          }
        : current,
    );
    setAttachmentDraft({ fileName: "", fileUrl: "" });
  }

  function removeAttachment(id: string) {
    setEditor((current) =>
      current ? { ...current, attachments: current.attachments.filter((attachment) => attachment.id !== id) } : current,
    );
  }

  function buildPayload(current: JournalEditor): JournalEntryPayload {
    return {
      journalType: current.journalType,
      sourceType: "MANUAL",
      sourceModule: "finance",
      sourceDocumentNumber: current.sourceDocumentNumber || undefined,
      legalEntityId: activeCompany?.id ?? 0,
      branchId: Number(current.branchId),
      costCenterId: current.costCenterId ? Number(current.costCenterId) : undefined,
      projectId: current.projectId ? Number(current.projectId) : undefined,
      journalDate: current.journalDate,
      postingDate: current.postingDate,
      accountingPeriodId: Number(current.accountingPeriodId),
      fiscalYearId: current.fiscalYearId ? Number(current.fiscalYearId) : undefined,
      currencyCode: current.currencyCode,
      exchangeRate: current.exchangeRate ? Number(current.exchangeRate) : undefined,
      referenceNumber: current.referenceNumber || undefined,
      narration: current.narration.trim(),
      description: current.description.trim() || undefined,
      isAutoReversing: current.isAutoReversing,
      autoReverseDate: current.autoReverseDate || undefined,
      attachments: current.attachments.map((attachment) => ({ fileName: attachment.fileName, fileUrl: attachment.fileUrl })),
      lines: current.lines.map((line) => ({
        accountId: Number(line.accountId),
        debitAmount: toAmount(line.debitAmount) || undefined,
        creditAmount: toAmount(line.creditAmount) || undefined,
        costCenterId: line.costCenterId ? Number(line.costCenterId) : undefined,
        projectId: line.projectId ? Number(line.projectId) : undefined,
        taxCodeId: line.taxCodeId ? Number(line.taxCodeId) : undefined,
        lineNarration: line.lineNarration || undefined,
        branchId: Number(current.branchId),
        transactionCurrencyCode: current.currencyCode,
        exchangeRate: current.exchangeRate ? Number(current.exchangeRate) : undefined,
      })),
    };
  }

  async function persistDraft(showSuccess = true) {
    if (!session?.token || !editor) return null;
    const nonStrictIssues = validationIssues.filter((issue) => issue !== "Journal is not balanced.");
    if (nonStrictIssues.length > 0) {
      setMessageTone("error");
      setMessage(nonStrictIssues[0]);
      return null;
    }

    setSavingAction("save");
    try {
      const saved = editor.id ? await updateJournalDraft(session.token, editor.id, buildPayload(editor)) : await createJournalDraft(session.token, buildPayload(editor));
      const [detail, journals, ledgerEntries] = await Promise.all([
        getJournalEntry(session.token, saved.id),
        getJournalEntries(session.token, { branchId: activeBranch?.id ?? undefined }),
        getAccountingJournals(session.token),
      ]);
      setSelectedJournalId(detail.id);
      setJournalList(journals);
      setGlJournals(ledgerEntries);
      setEditor(hydrateEditor(detail));
      if (showSuccess) {
        setMessageTone("success");
        setMessage("Journal draft saved and refreshed from the live journal store.");
      }
      return detail;
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Could not save the journal draft.");
      return null;
    } finally {
      setSavingAction("");
    }
  }

  async function runMutation(
    action: string,
    handler: (journalId: number) => Promise<JournalEntryRecord>,
    successMessage: string,
    strict = true,
  ) {
    if (!session?.token || !editor) return;
    if (strict && validationIssues.length > 0) {
      setMessageTone("error");
      setMessage(validationIssues[0]);
      return;
    }

    setSavingAction(action);
    try {
      const persisted = editor.id ? editor : await persistDraft(false);
      if (!persisted?.id) return;
      const result = await handler(persisted.id);
      const [detail, journals, ledgerEntries] = await Promise.all([
        getJournalEntry(session.token, result.id),
        getJournalEntries(session.token, { branchId: activeBranch?.id ?? undefined }),
        getAccountingJournals(session.token),
      ]);
      setSelectedJournalId(detail.id);
      setJournalList(journals);
      setGlJournals(ledgerEntries);
      setEditor(hydrateEditor(detail));
      setMessageTone("success");
      setMessage(successMessage);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "The journal action could not be completed.");
    } finally {
      setSavingAction("");
    }
  }

  const primaryAction = useMemo(() => {
    if (!editor) return null;
    if (editor.status === "APPROVED") {
      return (
        <button
          className="primary-button with-icon"
          type="button"
          onClick={() =>
            runMutation("post", (journalId) => postJournalEntry(session!.token, journalId), "Journal posted and mirrored into the GL.")
          }
          disabled={savingAction !== ""}
        >
          {savingAction === "post" ? <RefreshCw size={16} className="spin" /> : <CheckCircle2 size={16} />}
          {savingAction === "post" ? "Posting..." : "Post to GL"}
        </button>
      );
    }

    return (
      <button className="primary-button with-icon" type="button" onClick={() => void persistDraft()} disabled={!isEditable || savingAction !== ""}>
        {savingAction === "save" ? <RefreshCw size={16} className="spin" /> : <Save size={16} />}
        {savingAction === "save" ? "Saving..." : "Save draft"}
      </button>
    );
  }, [editor, isEditable, savingAction, session]);

  const drafts = journalList.filter((journal) => journal.status === "DRAFT").length;
  const pending = journalList.filter((journal) => journal.status === "PENDING_APPROVAL").length;
  const posted = journalList.filter((journal) => journal.status === "POSTED").length;
  const journalMetrics = useMemo<KpiMetric[]>(
    () => [
      {
        label: "Selected debit",
        value: formatMoney(totals.debit, editor?.currencyCode || metadata?.company.currencyCode || "NGN"),
        delta: `${editor?.lines.length ?? 0} lines`,
        trend: totals.balanced ? "up" : "down",
        detail: "Live debit total for the current journal",
      },
      {
        label: "Selected credit",
        value: formatMoney(totals.credit, editor?.currencyCode || metadata?.company.currencyCode || "NGN"),
        delta: totals.balanced ? "Balanced" : "Out of balance",
        trend: totals.balanced ? "up" : "down",
        detail: "Live credit total for the current journal",
      },
      {
        label: "Draft queue",
        value: String(drafts),
        delta: `${pending} pending approval`,
        trend: pending > 0 ? "neutral" : "up",
        detail: "Manual journals still awaiting review",
      },
      {
        label: "Posted to GL",
        value: String(posted),
        delta: currentGlMirror ? `GL ${currentGlMirror.reference}` : "No GL mirror yet",
        trend: posted > 0 ? "up" : "neutral",
        detail: "Journals already committed to the general ledger",
      },
    ],
    [currentGlMirror, drafts, editor?.currencyCode, editor?.lines.length, metadata?.company.currencyCode, pending, posted, totals.balanced, totals.credit, totals.debit],
  );

  if (!session?.token) {
    return null;
  }

  return (
    <WorkspaceShell
      title="Journal Entry"
      description="Create, validate, approve, post, and reverse journals in one controlled GL workspace."
      requiredRoles={["cfo", "accountant", "admin"]}
      breadcrumbs={["Home", "Finance", "General Ledger", "Journal Entry"]}
      pageActions={
        <ModuleActionBar
          primaryAction={primaryAction}
          summary="High-frequency journal work stays visible. Reviews, reports, and controls stay grouped above the work area."
          secondaryGroups={[
            {
              label: "Actions",
              items: [
                {
                  label: "Submit for approval",
                  description: "Move the current draft into the approval queue",
                  onSelect: () =>
                    runMutation("submit", (journalId) => submitJournalEntry(session.token, journalId), "Journal submitted for approval."),
                  disabled: !editor || !isEditable || savingAction !== "",
                },
                {
                  label: "Approve journal",
                  description: "Approve the selected journal for posting",
                  onSelect: () =>
                    runMutation("approve", (journalId) => approveJournalEntry(session.token, journalId, "Approved from journal workspace"), "Journal approved and ready for posting."),
                  disabled: editor?.status !== "PENDING_APPROVAL" || savingAction !== "",
                },
                {
                  label: "Reject journal",
                  description: "Return the journal to the maker with a reason",
                  onSelect: () => {
                    if (!editor?.id) return;
                    const reason = window.prompt("Why are you rejecting this journal?");
                    if (!reason) return;
                    void runMutation("reject", (journalId) => rejectJournalEntry(session.token, journalId, reason), "Journal rejected and returned to the maker.", false);
                  },
                  disabled: editor?.status !== "PENDING_APPROVAL" || savingAction !== "",
                },
                {
                  label: "Recall journal",
                  description: "Pull a pending journal back to draft",
                  onSelect: () => runMutation("recall", (journalId) => recallJournalEntry(session.token, journalId), "Journal recalled to draft.", false),
                  disabled: editor?.status !== "PENDING_APPROVAL" || savingAction !== "",
                },
                {
                  label: "Validate journal",
                  description: "Run posting validations before approval",
                  onSelect: async () => {
                    if (!editor) return;
                    const persisted = editor.id ? editor : await persistDraft(false);
                    if (!persisted?.id) return;
                    setSavingAction("validate");
                    try {
                      const result = await validateJournalEntry(session.token, persisted.id);
                      setMessageTone(result.valid ? "success" : "error");
                      setMessage(result.valid ? "Journal passed validation and is ready for approval." : result.errors.join(" "));
                    } catch (error) {
                      setMessageTone("error");
                      setMessage(error instanceof Error ? error.message : "Could not validate the journal.");
                    } finally {
                      setSavingAction("");
                    }
                  },
                },
              ],
            },
            {
              label: "Reports",
              items: [
                { label: "General Ledger", description: "Review posted journal impact by account", href: "/finance?view=General%20Ledger" },
                { label: "Trial Balance", description: "Open grouped trial balance reporting", href: "/reports?view=Trial%20Balance" },
                { label: "Account Statements", description: "Review account movement and reconciliation", href: "/reports?view=Account%20Statement" },
              ],
            },
            {
              label: "More",
              items: [
                {
                  label: "Reverse journal",
                  description: "Create a linked mirror reversal for the posted journal",
                  onSelect: () => {
                    if (!editor?.id) return;
                    const reason = window.prompt("Why are you reversing this journal?");
                    if (!reason) return;
                    void runMutation("reverse", (journalId) => reverseJournalEntry(session.token, journalId, new Date().toISOString().slice(0, 10), reason), "Reversal journal created and linked to the original entry.", false);
                  },
                  disabled: editor?.status !== "POSTED" || savingAction !== "",
                },
                {
                  label: "Cancel draft",
                  description: "Cancel the selected draft before posting",
                  onSelect: () => {
                    if (!editor?.id) return;
                    const reason = window.prompt("Why are you cancelling this journal?");
                    if (!reason) return;
                    void runMutation("cancel", (journalId) => cancelJournalEntry(session.token, journalId, reason), "Journal cancelled.", false);
                  },
                  disabled: !editor?.id || ["POSTED", "REVERSED"].includes(editor.status) || savingAction !== "",
                },
                { label: "Refresh workspace", description: "Reload journals, metadata, and GL mirror data", onSelect: () => void loadWorkspace(selectedJournalId) },
                { label: "Print current view", description: "Open the browser print dialog", onSelect: () => window.print() },
                { label: "New blank journal", description: "Start a fresh draft without leaving this page", onSelect: resetNewJournal },
              ],
            },
          ]}
        />
      }
    >
      <div className="journal-page">
        {message ? (
          <div className={`journal-banner journal-banner--${messageTone}`} role={messageTone === "error" ? "alert" : "status"}>
            {messageTone === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{message}</span>
          </div>
        ) : null}

        <div className="journal-kpi-strip">
          {journalMetrics.map((metric) => (
            <KpiCard key={metric.label} metric={metric} tone="finance" />
          ))}
        </div>

        <ViewToolbar
          left={
            <>
              <div className="field-group">
                <label className="field-label" htmlFor="journal-search">Search register</label>
                <input id="journal-search" className="field-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Journal number, narration, source document" />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="journal-status">Status</label>
                <select id="journal-status" className="field-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as JournalStatus | "ALL")}>
                  <option value="ALL">All statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="PENDING_APPROVAL">Pending approval</option>
                  <option value="APPROVED">Approved</option>
                  <option value="POSTED">Posted</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="REVERSED">Reversed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </>
          }
          right={
            <button className="ghost-button with-icon" type="button" onClick={() => void loadWorkspace(selectedJournalId)} disabled={loading}>
              <RefreshCw size={16} className={loading ? "spin" : ""} />
              Refresh
            </button>
          }
          chips={
            <div className="filter-row">
              <span className="table-tag">{visibleJournals.length} in register</span>
              <span className="table-tag">{journalList.length} total journals</span>
              <span className="table-tag">{statusFilter === "ALL" ? "All statuses" : statusFilter.replace(/_/g, " ")}</span>
            </div>
          }
        />

        <div className="journal-content-grid">
          <div className="journal-main-column">
            <SectionCard
              title="Journal register"
              eyebrow="General Ledger"
              action={
                <button className="ghost-button with-icon" type="button" onClick={resetNewJournal}>
                  <Plus size={16} />
                  New journal
                </button>
              }
            >
              {loading && !editor ? (
                <div className="journal-loading">Loading journal workspace...</div>
              ) : visibleJournals.length === 0 ? (
                <EmptyState title="No journals in this view" body="Adjust the filters or start a fresh journal entry." />
              ) : (
                <div className="journal-register-list">
                  {visibleJournals.map((journal) => {
                    const totalDebit = journal.lines.reduce((sum, line) => sum + toAmount(line.debitAmount), 0);
                    return (
                      <button key={journal.id} type="button" className={`journal-register-row ${journal.id === selectedJournalId ? "is-selected" : ""}`} onClick={() => void openJournal(journal.id)}>
                        <div className="journal-register-row__main">
                          <div>
                            <strong>{journal.journalNumber}</strong>
                            <span>{journal.narration}</span>
                          </div>
                          <ChevronRight size={16} />
                        </div>
                        <div className="journal-register-row__meta">
                          <span>{formatDate(journal.postingDate)}</span>
                          <span>{journal.branch?.name ?? "Branch"}</span>
                          <span>{formatMoney(totalDebit, journal.currencyCode)}</span>
                          <span className={`journal-status-chip journal-status-chip--${journal.status.toLowerCase()}`}>{journal.status.replace(/_/g, " ")}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            {editor ? (
              <>
                <div className="journal-tab-bar surface">
                  {[
                    { key: "lines", label: "Journal lines" },
                    { key: "attachments", label: `Attachments (${editor.attachments.length})` },
                    { key: "audit", label: "Audit trail" },
                    { key: "gl", label: "GL impact" },
                  ].map((tab) => (
                    <button key={tab.key} type="button" className={`journal-tab ${activeTab === tab.key ? "active" : ""}`} onClick={() => setActiveTab(tab.key as typeof activeTab)}>
                      {tab.label}
                    </button>
                  ))}
                </div>

                <SectionCard
                  title={editor.id ? editor.journalNumber || "Journal draft" : "New Journal Entry"}
                  eyebrow={editor.id ? `${editor.journalType.replace(/_/g, " ")} · ${editor.status.replace(/_/g, " ")}` : "Manual Journal"}
                >
                  <div className="journal-header-grid">
                    <div className="field-group">
                      <label className="field-label">Journal type</label>
                      <select className="field-select" value={editor.journalType} onChange={(event) => updateEditor("journalType", event.target.value as JournalType)} disabled={!isEditable}>
                        {metadata?.journalTypes.map((type) => (
                          <option key={type} value={type}>
                            {type.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field-group">
                      <label className="field-label">Branch</label>
                      <select className="field-select" value={editor.branchId} onChange={(event) => updateEditor("branchId", Number(event.target.value))} disabled={!isEditable}>
                        <option value="">Select branch</option>
                        {(activeCompany?.branches ?? []).map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field-group">
                      <label className="field-label">Journal date</label>
                      <input className="field-input" type="date" value={editor.journalDate} onChange={(event) => updateEditor("journalDate", event.target.value)} disabled={!isEditable} />
                    </div>
                    <div className="field-group">
                      <label className="field-label">Posting date</label>
                      <input className="field-input" type="date" value={editor.postingDate} onChange={(event) => updateEditor("postingDate", event.target.value)} disabled={!isEditable} />
                    </div>
                    <div className="field-group">
                      <label className="field-label">Accounting period</label>
                      <select className="field-select" value={editor.accountingPeriodId} onChange={(event) => updateEditor("accountingPeriodId", Number(event.target.value))} disabled={!isEditable}>
                        <option value="">Select period</option>
                        {(metadata?.periods ?? []).map((period) => (
                          <option key={period.id} value={period.id}>
                            {period.name} ({period.status})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field-group">
                      <label className="field-label">Fiscal year</label>
                      <select className="field-select" value={editor.fiscalYearId} onChange={(event) => updateEditor("fiscalYearId", Number(event.target.value))} disabled={!isEditable}>
                        <option value="">Select fiscal year</option>
                        {(metadata?.fiscalYears ?? []).map((fiscalYear) => (
                          <option key={fiscalYear.id} value={fiscalYear.id}>
                            {fiscalYear.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field-group">
                      <label className="field-label">Currency</label>
                      <input className="field-input" value={editor.currencyCode} onChange={(event) => updateEditor("currencyCode", event.target.value)} disabled={!isEditable} />
                    </div>
                    <div className="field-group">
                      <label className="field-label">Exchange rate</label>
                      <input className="field-input" value={editor.exchangeRate} onChange={(event) => updateEditor("exchangeRate", event.target.value)} disabled={!isEditable || editor.currencyCode === metadata?.company.currencyCode} />
                    </div>
                    <div className="field-group">
                      <label className="field-label">Source document number</label>
                      <input className="field-input" value={editor.sourceDocumentNumber} onChange={(event) => updateEditor("sourceDocumentNumber", event.target.value)} disabled={!isEditable} placeholder="INV-00892 / PR-1104" />
                    </div>
                    <div className="field-group">
                      <label className="field-label">Reference number</label>
                      <input className="field-input" value={editor.referenceNumber} onChange={(event) => updateEditor("referenceNumber", event.target.value)} disabled={!isEditable} placeholder="Batch / support reference" />
                    </div>
                    <div className="field-group">
                      <label className="field-label">Cost center</label>
                      <select className="field-select" value={editor.costCenterId} onChange={(event) => updateEditor("costCenterId", Number(event.target.value))} disabled={!isEditable}>
                        <option value="">None</option>
                        {(metadata?.costCenters ?? []).map((costCenter) => (
                          <option key={costCenter.id} value={costCenter.id}>
                            {costCenter.code} - {costCenter.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field-group">
                      <label className="field-label">Project</label>
                      <select className="field-select" value={editor.projectId} onChange={(event) => updateEditor("projectId", Number(event.target.value))} disabled={!isEditable}>
                        <option value="">None</option>
                        {(metadata?.projects ?? []).map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.code} - {project.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="field-group">
                    <label className="field-label">Narration</label>
                    <textarea className="field-textarea" value={editor.narration} onChange={(event) => updateEditor("narration", event.target.value)} disabled={!isEditable} placeholder="Describe the business reason for this journal." />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Description</label>
                    <textarea className="field-textarea" value={editor.description} onChange={(event) => updateEditor("description", event.target.value)} disabled={!isEditable} placeholder="Optional longer description for reviewers and audit." />
                  </div>
                  <label className="journal-toggle">
                    <input type="checkbox" checked={editor.isAutoReversing} onChange={(event) => updateEditor("isAutoReversing", event.target.checked)} disabled={!isEditable} />
                    <span>Auto-reverse this journal</span>
                  </label>
                  {editor.isAutoReversing ? (
                    <div className="field-group">
                      <label className="field-label">Auto-reverse date</label>
                      <input className="field-input" type="date" value={editor.autoReverseDate} onChange={(event) => updateEditor("autoReverseDate", event.target.value)} disabled={!isEditable} />
                    </div>
                  ) : null}
                </SectionCard>
              </>
            ) : null}
          </div>
          {editor ? (
            <>
              <div className="journal-side-column">
                {activeTab === "lines" ? (
                  <SectionCard title="Journal lines" eyebrow="Posting matrix">
                    <div className={`journal-balance-bar ${totals.balanced ? "balanced" : "unbalanced"}`}>
                      <div>
                        <strong>{totals.balanced ? "Balanced and ready for approval" : "Entry still needs attention"}</strong>
                        <span>
                          Debit {formatMoney(totals.debit, editor.currencyCode)} · Credit {formatMoney(totals.credit, editor.currencyCode)} · Difference{" "}
                          {formatMoney(Math.abs(totals.difference), editor.currencyCode)}
                        </span>
                      </div>
                    </div>
                    <div className="journal-lines-table-wrap">
                      <table className="journal-lines-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Account</th>
                            <th>Line narration</th>
                            <th>Cost center</th>
                            <th>Project</th>
                            <th className="numeric">Debit</th>
                            <th className="numeric">Credit</th>
                            <th>Tax</th>
                            <th>More</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editor.lines.map((line, index) => (
                            <tr key={line.id}>
                              <td>{index + 1}</td>
                              <td>
                                <select className="field-select" value={line.accountId} onChange={(event) => updateLine(line.id, { accountId: Number(event.target.value) })} disabled={!isEditable}>
                                  <option value="">Select account</option>
                                  {accounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                      {account.code} - {account.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input className="field-input" value={line.lineNarration} onChange={(event) => updateLine(line.id, { lineNarration: event.target.value })} disabled={!isEditable} placeholder="Line memo" />
                              </td>
                              <td>
                                <select className="field-select" value={line.costCenterId} onChange={(event) => updateLine(line.id, { costCenterId: Number(event.target.value) })} disabled={!isEditable}>
                                  <option value="">None</option>
                                  {(metadata?.costCenters ?? []).map((costCenter) => (
                                    <option key={costCenter.id} value={costCenter.id}>
                                      {costCenter.code}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <select className="field-select" value={line.projectId} onChange={(event) => updateLine(line.id, { projectId: Number(event.target.value) })} disabled={!isEditable}>
                                  <option value="">None</option>
                                  {(metadata?.projects ?? []).map((project) => (
                                    <option key={project.id} value={project.id}>
                                      {project.code}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="numeric">
                                <input className="field-input numeric" inputMode="decimal" value={line.debitAmount} onChange={(event) => updateLine(line.id, { debitAmount: event.target.value, creditAmount: event.target.value ? "" : line.creditAmount })} disabled={!isEditable} placeholder="0.00" />
                              </td>
                              <td className="numeric">
                                <input className="field-input numeric" inputMode="decimal" value={line.creditAmount} onChange={(event) => updateLine(line.id, { creditAmount: event.target.value, debitAmount: event.target.value ? "" : line.debitAmount })} disabled={!isEditable} placeholder="0.00" />
                              </td>
                              <td>
                                <select className="field-select" value={line.taxCodeId} onChange={(event) => updateLine(line.id, { taxCodeId: Number(event.target.value) })} disabled={!isEditable}>
                                  <option value="">None</option>
                                  {(metadata?.taxCodes ?? []).map((tax) => (
                                    <option key={tax.id} value={tax.id}>
                                      {tax.code}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <div className="journal-line-actions">
                                  <button className="ghost-button icon-only" type="button" onClick={() => addLine(line)} disabled={!isEditable} title="Duplicate line">
                                    <Copy size={15} />
                                  </button>
                                  <button className="ghost-button icon-only" type="button" onClick={() => removeLine(line.id)} disabled={!isEditable} title="Remove line">
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button className="ghost-button with-icon" type="button" onClick={() => addLine()} disabled={!isEditable}>
                      <Plus size={16} />
                      Add line
                    </button>
                  </SectionCard>
                ) : null}

                {activeTab === "attachments" ? (
                  <SectionCard title="Attachments" eyebrow="Support documents">
                    <div className="journal-attachment-grid">
                      <input className="field-input" value={attachmentDraft.fileName} onChange={(event) => setAttachmentDraft((current) => ({ ...current, fileName: event.target.value }))} placeholder="Document name" disabled={!isEditable} />
                      <input className="field-input" value={attachmentDraft.fileUrl} onChange={(event) => setAttachmentDraft((current) => ({ ...current, fileUrl: event.target.value }))} placeholder="Document URL" disabled={!isEditable} />
                      <button className="secondary-button" type="button" onClick={addAttachment} disabled={!isEditable}>
                        Add
                      </button>
                    </div>
                    {editor.attachments.length ? (
                      <div className="journal-attachment-list">
                        {editor.attachments.map((attachment) => (
                          <div key={attachment.id} className="journal-attachment-row">
                            <div>
                              <strong>{attachment.fileName}</strong>
                              <a href={attachment.fileUrl} target="_blank" rel="noreferrer">
                                {attachment.fileUrl}
                              </a>
                            </div>
                            {isEditable ? (
                              <button className="ghost-button icon-only" type="button" onClick={() => removeAttachment(attachment.id)}>
                                <Trash2 size={15} />
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState title="No attachments yet" body="Attach schedules or approval evidence here." />
                    )}
                  </SectionCard>
                ) : null}

                {activeTab === "audit" ? (
                  <SectionCard title="Audit trail" eyebrow="Status and approval history">
                    {timelineItems.length ? <ActivityTimeline items={timelineItems} /> : <EmptyState title="No audit trail yet" body="Journal activity appears here after save, submit, approve, or post." />}
                  </SectionCard>
                ) : null}

                {activeTab === "gl" ? (
                  <SectionCard title="General Ledger impact" eyebrow="Posted mirror">
                    {currentGlMirror ? (
                      <div className="journal-gl-card">
                        <div className="journal-gl-card__header">
                          <div>
                            <strong>{currentGlMirror.reference}</strong>
                            <span>{currentGlMirror.description || "Posted mirror in the live general ledger"}</span>
                          </div>
                          <span className="journal-status-chip journal-status-chip--posted">POSTED</span>
                        </div>
                        <div className="journal-gl-card__meta">
                          <span>Posting date {formatDate(currentGlMirror.date)}</span>
                          <span>{currentGlMirror.lines.length} GL lines</span>
                        </div>
                        <div className="journal-gl-list">
                          {currentGlMirror.lines.map((line) => {
                            const account = accounts.find((candidate) => candidate.id === line.accountId);
                            return (
                              <div key={line.id} className="journal-gl-list__row">
                                <span>{account ? `${account.code} - ${account.name}` : `Account ${line.accountId}`}</span>
                                <strong>{toAmount(line.debit) > 0 ? `${formatMoney(toAmount(line.debit), editor.currencyCode)} Dr` : `${formatMoney(toAmount(line.credit), editor.currencyCode)} Cr`}</strong>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <EmptyState title="No GL impact yet" body="Once this journal is posted, the immutable general ledger mirror appears here." />
                    )}
                  </SectionCard>
                ) : null}

                <SectionCard title="Workflow status" eyebrow="Approval trail">
                  <div className="journal-workflow-list">
                    <div className={`journal-workflow-step ${["DRAFT", "REJECTED"].includes(editor.status) ? "is-active" : "is-done"}`}>
                      <strong>Draft</strong>
                      <span>Maker prepares journal lines and support references.</span>
                    </div>
                    <div className={`journal-workflow-step ${editor.status === "PENDING_APPROVAL" ? "is-active" : ["APPROVED", "POSTED", "REVERSED"].includes(editor.status) ? "is-done" : ""}`}>
                      <strong>Pending approval</strong>
                      <span>Reviewer checks balances, dimensions, and support.</span>
                    </div>
                    <div className={`journal-workflow-step ${editor.status === "APPROVED" ? "is-active" : ["POSTED", "REVERSED"].includes(editor.status) ? "is-done" : ""}`}>
                      <strong>Approved</strong>
                      <span>Journal is cleared for posting to the general ledger.</span>
                    </div>
                    <div className={`journal-workflow-step ${["POSTED", "REVERSED"].includes(editor.status) ? "is-done" : ""}`}>
                      <strong>Posted to GL</strong>
                      <span>Posted journals become immutable and drive reporting.</span>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Validation summary" eyebrow="Finance controls">
                  {validationIssues.length ? (
                    <ul className="journal-issue-list">
                      {validationIssues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="journal-validation-ok">
                      <CheckCircle2 size={18} />
                      <span>Core header and line checks are in good shape.</span>
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Posting controls" eyebrow="Source of truth">
                  <div className="journal-posting-summary">
                    <div>
                      <span>Source module</span>
                      <strong>{editor.isSystemGenerated ? "System-generated" : "Manual finance entry"}</strong>
                    </div>
                    <div>
                      <span>Journal status</span>
                      <strong>{editor.status.replace(/_/g, " ")}</strong>
                    </div>
                    <div>
                      <span>GL mirror</span>
                      <strong>{currentGlMirror ? currentGlMirror.reference : "Not posted yet"}</strong>
                    </div>
                    <div>
                      <span>Posted journal ID</span>
                      <strong>{editor.postedJournalEntryId ?? "-"}</strong>
                    </div>
                  </div>
                </SectionCard>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </WorkspaceShell>
  );
}
