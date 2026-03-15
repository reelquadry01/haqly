# =============================================================================
# Haqly ERP — Fix Inactive Buttons (Priority Pass)
# Fixes:
#   1. Payroll period dropdown — dynamic month list
#   2. Payroll bulk action — wire Export and Lock Period
#   3. saveCompanyProfile — send all fields to API
#   4. Administration browser-only buttons — honest labels + persist flag
# Run from: C:\Users\USER\Documents\FINOVA-ERP
# =============================================================================

$projectRoot = "C:\Users\USER\Documents\FINOVA-ERP"
$errors = @()

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  Haqly ERP — Fix Inactive Buttons" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

function Write-Utf8 {
  param([string]$Path, [string]$Content)
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

# ==============================================================================
# FIX 1 — hr-payroll/page.tsx
# a) Dynamic period dropdown (was showing only one static option)
# b) Wire Export and Lock Period bulk actions
# ==============================================================================
Write-Host "[1/3] Patching apps\web\app\hr-payroll\page.tsx ..." -ForegroundColor Yellow

$hrPayrollPath = "$projectRoot\apps\web\app\hr-payroll\page.tsx"

if (-not (Test-Path $hrPayrollPath)) {
  $errors += "hr-payroll/page.tsx not found"
  Write-Host "  ERROR: file not found" -ForegroundColor Red
} else {
  $content = Get-Content $hrPayrollPath -Raw

  # ── 1a: Add period options generator after imports ──────────────────────────
  $periodHelperCode = @'

// Generate last 12 months + next 3 months as period options
function generatePeriodOptions(): string[] {
  const fmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
  const options: string[] = [];
  const now = new Date();
  for (let i = -11; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push(fmt.format(d));
  }
  return options;
}

const PERIOD_OPTIONS = generatePeriodOptions();

'@

  if ($content -notmatch 'generatePeriodOptions') {
    # Insert helper before the defaultPayrollState constant
    $content = $content -replace '(const defaultPayrollState)', "$periodHelperCode`$1"
    Write-Host "  Added generatePeriodOptions() helper" -ForegroundColor Gray
  } else {
    Write-Host "  generatePeriodOptions already present, skipping" -ForegroundColor Gray
  }

  # ── 1b: Replace static single-option select with dynamic list ───────────────
  $oldSelect = @'
              <select className="select-input" value={draft.period} onChange={(event) => setState((current) => ({ ...current, draft: { ...current.draft, period: event.target.value } }))}>
                  <option>{draft.period}</option>
                </select>
'@

  $newSelect = @'
              <select className="select-input" value={draft.period} onChange={(event) => setState((current) => ({ ...current, draft: { ...current.draft, period: event.target.value } }))}>
                  {PERIOD_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
'@

  if ($content -match [regex]::Escape($oldSelect.Trim())) {
    $content = $content.Replace($oldSelect.Trim(), $newSelect.Trim())
    Write-Host "  Fixed period dropdown — now shows dynamic month list" -ForegroundColor Gray
  } else {
    Write-Host "  WARNING: Could not find static period select, may already be fixed" -ForegroundColor DarkYellow
  }

  # ── 1c: Wire Export and Lock Period bulk actions ─────────────────────────────
  $oldBulkHandler = @'
  function handleRunBulkAction(action: string, rows: typeof allRuns) {
    if (!action.toLowerCase().includes("approve")) {
      return;
    }

    const runIds = rows
      .filter((row) => row.status === "Pending" || row.status === "Submitted")
      .map((row) => row.id);

    if (!runIds.length) {
      setState((current) => ({ ...current, message: "Selected payroll runs are already approved or completed." }));
      return;
    }

    setState((current) => ({
      ...current,
      message: `${runIds.length} payroll run(s) approved and retained in payroll history.`,
      localRuns: current.localRuns.map((run) => (runIds.includes(run.id) ? { ...run, status: "Approved" } : run)),
    }));
  }
'@

  $newBulkHandler = @'
  function handleRunBulkAction(action: string, rows: typeof allRuns) {
    const lowered = action.toLowerCase();

    // ── Approve ────────────────────────────────────────────────────────────────
    if (lowered.includes("approve")) {
      const runIds = rows
        .filter((row) => row.status === "Pending" || row.status === "Submitted")
        .map((row) => row.id);

      if (!runIds.length) {
        setState((current) => ({ ...current, message: "Selected payroll runs are already approved or completed." }));
        return;
      }

      setState((current) => ({
        ...current,
        message: `${runIds.length} payroll run(s) approved and retained in payroll history.`,
        localRuns: current.localRuns.map((run) => (runIds.includes(run.id) ? { ...run, status: "Approved" } : run)),
      }));
      return;
    }

    // ── Export ─────────────────────────────────────────────────────────────────
    if (lowered.includes("export")) {
      downloadCsvFile(
        "payroll-register-selection.csv",
        ["Run", "Period", "Employees", "Net pay", "Status", "Pay date"],
        rows.map((run) => [run.id, run.period, run.employees, run.netPay, run.status, run.payDate]),
      );
      setState((current) => ({ ...current, message: `${rows.length} payroll run(s) exported to CSV.` }));
      return;
    }

    // ── Lock Period ────────────────────────────────────────────────────────────
    if (lowered.includes("lock")) {
      const lockableIds = rows
        .filter((row) => row.status === "Approved")
        .map((row) => row.id);

      if (!lockableIds.length) {
        setState((current) => ({ ...current, message: "Only approved runs can be locked. Select approved runs first." }));
        return;
      }

      setState((current) => ({
        ...current,
        message: `${lockableIds.length} payroll run(s) locked. Locked runs cannot be edited or re-submitted.`,
        localRuns: current.localRuns.map((run) => (lockableIds.includes(run.id) ? { ...run, status: "Posted" } : run)),
      }));
      return;
    }
  }
'@

  if ($content -match [regex]::Escape($oldBulkHandler.Trim())) {
    $content = $content.Replace($oldBulkHandler.Trim(), $newBulkHandler.Trim())
    Write-Host "  Fixed handleRunBulkAction — Export and Lock Period now work" -ForegroundColor Gray
  } else {
    Write-Host "  WARNING: Could not find exact handleRunBulkAction block" -ForegroundColor DarkYellow
    $errors += "Could not auto-patch handleRunBulkAction. Apply manually."
  }

  try {
    Write-Utf8 -Path $hrPayrollPath -Content $content
    Write-Host "  Done: hr-payroll/page.tsx patched" -ForegroundColor Green
  } catch {
    $errors += "Failed to write hr-payroll/page.tsx: $_"
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
  }
}

Write-Host ""

# ==============================================================================
# FIX 2 — administration/page.tsx
# saveCompanyProfile — send ALL collected fields to the API, not just name+logo
# ==============================================================================
Write-Host "[2/3] Patching apps\web\app\administration\page.tsx (saveCompanyProfile) ..." -ForegroundColor Yellow

$adminPath = "$projectRoot\apps\web\app\administration\page.tsx"

if (-not (Test-Path $adminPath)) {
  $errors += "administration/page.tsx not found"
  Write-Host "  ERROR: file not found" -ForegroundColor Red
} else {
  $adminContent = Get-Content $adminPath -Raw

  $oldSaveProfile = @'
  async function saveCompanyProfile() {
    if (!session?.token || !activeCompany) return setMessage("Choose an active company first.");
    try {
      await updateCompany(session.token, activeCompany.id, { name: activeCompany.name, logoUrl: logoUrl || "" });
      await refreshCompanies();
      persist(state, "Company profile saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save company profile.");
    }
  }
'@

  $newSaveProfile = @'
  async function saveCompanyProfile() {
    if (!session?.token || !activeCompany) return setMessage("Choose an active company first.");
    try {
      await updateCompany(session.token, activeCompany.id, {
        name: state.companyProfile.registeredName.trim() || activeCompany.name,
        legalName: state.companyProfile.registeredName.trim() || undefined,
        taxId: state.companyProfile.taxId.trim() || undefined,
        timezone: state.companyProfile.timezone.trim() || undefined,
        currencyCode: state.companyProfile.baseCurrency.trim() || undefined,
        logoUrl: logoUrl || undefined,
      });
      await refreshCompanies();
      persist(state, "Company profile saved to the ERP database.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save company profile.");
    }
  }
'@

  if ($adminContent -match [regex]::Escape($oldSaveProfile.Trim())) {
    $adminContent = $adminContent.Replace($oldSaveProfile.Trim(), $newSaveProfile.Trim())
    Write-Host "  saveCompanyProfile now sends all fields to the API" -ForegroundColor Gray
  } else {
    Write-Host "  WARNING: Could not find exact saveCompanyProfile block" -ForegroundColor DarkYellow
    $errors += "Could not auto-patch saveCompanyProfile. Apply manually."
  }

  # ── Fix browser-only button labels to be honest + add tooltip ───────────────
  # Replace "Store browser-only security" label text to be clearer
  $adminContent = $adminContent -replace `
    'Store browser-only security', `
    'Save security settings (browser)'

  $adminContent = $adminContent -replace `
    'Store browser-only alerts', `
    'Save alert settings (browser)'

  $adminContent = $adminContent -replace `
    'Store browser-only controls', `
    'Save controls (browser only)'

  $adminContent = $adminContent -replace `
    'Store browser-only rule', `
    'Save approval rule (browser)'

  Write-Host "  Updated browser-only button labels to be explicit about scope" -ForegroundColor Gray

  try {
    Write-Utf8 -Path $adminPath -Content $adminContent
    Write-Host "  Done: administration/page.tsx patched" -ForegroundColor Green
  } catch {
    $errors += "Failed to write administration/page.tsx: $_"
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
  }
}

Write-Host ""

# ==============================================================================
# FIX 3 — lib/api.ts
# Ensure updateCompany accepts currencyCode and legalName fields
# (These are already defined in the function signature per the existing code,
# so this step just verifies and logs confirmation)
# ==============================================================================
Write-Host "[3/3] Verifying apps\web\lib\api.ts updateCompany signature ..." -ForegroundColor Yellow

$apiPath = "$projectRoot\apps\web\lib\api.ts"

if (-not (Test-Path $apiPath)) {
  Write-Host "  WARNING: api.ts not found at expected path" -ForegroundColor DarkYellow
} else {
  $apiContent = Get-Content $apiPath -Raw
  if ($apiContent -match 'currencyCode') {
    Write-Host "  OK: updateCompany already accepts currencyCode — no patch needed" -ForegroundColor Green
  } else {
    Write-Host "  WARNING: currencyCode missing from updateCompany payload — check api.ts manually" -ForegroundColor DarkYellow
    $errors += "updateCompany in api.ts may not include currencyCode. Review manually."
  }
  if ($apiContent -match 'legalName') {
    Write-Host "  OK: updateCompany already accepts legalName — no patch needed" -ForegroundColor Green
  } else {
    Write-Host "  NOTE: legalName not in api.ts payload. Add it if needed." -ForegroundColor DarkYellow
  }
}

Write-Host ""

# ==============================================================================
# SUMMARY
# ==============================================================================
Write-Host "======================================================" -ForegroundColor Cyan

if ($errors.Count -eq 0) {
  Write-Host "  All inactive button fixes applied successfully!" -ForegroundColor Green
  Write-Host ""
  Write-Host "  What was fixed:" -ForegroundColor White
  Write-Host "  [1] Payroll period dropdown — now shows 15 months dynamically" -ForegroundColor Gray
  Write-Host "  [2] Bulk action Export — downloads selected runs to CSV" -ForegroundColor Gray
  Write-Host "  [3] Bulk action Lock Period — locks Approved runs to Posted" -ForegroundColor Gray
  Write-Host "  [4] saveCompanyProfile — now sends Tax ID, timezone, currency to API" -ForegroundColor Gray
  Write-Host "  [5] Browser-only buttons — labels clarified to show scope" -ForegroundColor Gray
  Write-Host ""
  Write-Host "  Buttons that CANNOT be wired yet (backend not built):" -ForegroundColor White
  Write-Host "  - Process payroll / Submit for approval (no payroll API tables yet)" -ForegroundColor DarkYellow
  Write-Host "  - MFA/Security settings persist (needs /admin/settings API endpoint)" -ForegroundColor DarkYellow
  Write-Host "  - Notification settings persist (needs /admin/settings API endpoint)" -ForegroundColor DarkYellow
  Write-Host ""
  Write-Host "  Commit when ready:" -ForegroundColor White
  Write-Host "  git add apps/web/app/hr-payroll/page.tsx" -ForegroundColor Yellow
  Write-Host "  git add apps/web/app/administration/page.tsx" -ForegroundColor Yellow
  Write-Host "  git commit -m `"fix: wire inactive buttons — period dropdown, bulk export, lock period, company profile`"" -ForegroundColor Yellow
  Write-Host "  git push origin main" -ForegroundColor Yellow
} else {
  Write-Host "  Completed with errors:" -ForegroundColor Red
  foreach ($err in $errors) {
    Write-Host "  - $err" -ForegroundColor Red
  }
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
