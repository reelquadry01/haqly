"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, Plus, Search } from "lucide-react";
import { useWorkspace } from "../hooks/use-workspace";
import {
  getModuleMenuGroups,
  getNavigationForRole,
  getRoleLabel,
  navigationItems,
  notificationFeed,
  quickCreateActions,
  type AppRole,
  type NavItem,
} from "../lib/erp";
import { clearSession } from "../lib/session";
import { AppIcon } from "./ui/app-icon";
import { ActionMenu } from "./ui/action-menu";
import { BrandLockup, BrandMark } from "./ui/brand-lockup";
import { SubnavTabs } from "./ui/subnav-tabs";
import type { UiTone } from "./ui/kpi-card";

function buildBreadcrumbs(pathname: string) {
  const activeItem = navigationItems.find((item) => item.href === pathname);
  if (!activeItem) {
    return ["Home", "Workspace"];
  }
  return ["Home", activeItem.label];
}

export function WorkspaceShell({
  title,
  description,
  children,
  requiredRoles,
  pageActions,
  tabs,
  activeTab,
  breadcrumbs,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  requiredRoles?: AppRole[];
  pageActions?: React.ReactNode;
  tabs?: string[];
  activeTab?: string;
  breadcrumbs?: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, companies, activeCompany, activeBranch, loading, error, setCompany, setBranch, setPeriod } =
    useWorkspace();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [tabView, setTabView] = useState(activeTab);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!loading && !session?.token) {
      router.replace("/");
    }
  }, [loading, router, session?.token]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    setTabView(params.get("view") ?? activeTab);
  }, [activeTab, pathname]);

  const role = session?.role ?? "cfo";
  const currentTab = tabView ?? activeTab;
  const allowedItems = useMemo(() => getNavigationForRole(role), [role]);
  const moduleMenuGroups = useMemo(() => getModuleMenuGroups(pathname), [pathname]);
  const pageAllowed = !requiredRoles || requiredRoles.includes(role);
  const crumbs = breadcrumbs ?? buildBreadcrumbs(pathname);
  const groupedNavigation = useMemo(() => {
    return allowedItems.reduce<Record<string, NavItem[]>>((accumulator, item) => {
      accumulator[item.section] = [...(accumulator[item.section] ?? []), item];
      return accumulator;
    }, {});
  }, [allowedItems]);

  const commandEntries = useMemo(() => {
    const navigable = allowedItems.map((item) => ({ label: item.label, hint: item.section, href: item.href, icon: item.icon }));
    const query = paletteQuery.toLowerCase();
    return [...navigable, ...quickCreateActions].filter((entry) => {
      return `${entry.label} ${entry.hint}`.toLowerCase().includes(query);
    });
  }, [allowedItems, paletteQuery]);

  function signOut() {
    clearSession();
    router.replace("/");
  }

  function setTab(tab: string) {
    const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    params.set("view", tab);
    setTabView(tab);
    router.replace(`${pathname}?${params.toString()}`);
  }

  if (!session?.token) {
    return null;
  }

  return (
    <div className={`erp-shell ${sidebarCollapsed ? "collapsed" : ""}`}>
      <aside className="erp-sidebar">
        <div className="erp-sidebar__top">
          <button type="button" className="brand-block" onClick={() => router.push("/dashboard")}>
            {!sidebarCollapsed ? (
              <BrandLockup className="brand-block__lockup" subtitle={getRoleLabel(role)} />
            ) : (
              <span className="brand-block__mark">
                <BrandMark size={24} />
              </span>
            )}
          </button>

          <button type="button" className="ghost-button icon-only" onClick={() => setSidebarCollapsed((current) => !current)}>
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <div className="workspace-context surface-muted">
          {activeCompany?.logoUrl ? <img src={activeCompany.logoUrl} alt={`${activeCompany.name} logo`} className="workspace-company-logo" /> : null}
          <strong>{session.companyName || "Select company"}</strong>
        </div>

        <nav className="erp-nav">
          {Object.entries(groupedNavigation).map(([section, items]) => (
            <div key={section} className="erp-nav__group">
              {!sidebarCollapsed ? <span className="erp-nav__section">{section}</span> : null}
              <div className="erp-nav__items">
                {items.map((item) => (
                  <Link key={item.href} href={item.href} className={pathname === item.href ? "erp-nav__link active" : "erp-nav__link"}>
                    <span className="erp-nav__icon"><AppIcon name={item.icon} size={18} /></span>
                    {!sidebarCollapsed ? (
                      <span className="erp-nav__content">
                        <span>{item.label}</span>
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="erp-main">
        <header className="erp-topbar">
          <div className="erp-topbar__left">
            <div className="breadcrumb-row">
              {crumbs.map((crumb, index) => (
                <span key={crumb} className="breadcrumb-row__item">
                  {index > 0 ? <span className="breadcrumb-sep">/</span> : null}
                  {crumb}
                </span>
              ))}
            </div>
            <button type="button" className="command-launch" onClick={() => setPaletteOpen(true)}>
              <span className="command-launch__label">
                <Search size={15} />
                Search, jump, or run action
              </span>
              <kbd>Ctrl K</kbd>
            </button>
          </div>

          <div className="erp-topbar__right">
            <label className="topbar-select-wrap">
              <AppIcon name="company" size={16} className="topbar-select-icon" />
              <select
                className="topbar-select"
                value={session.companyId ?? ""}
                onChange={(event) => setCompany(Number(event.target.value))}
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="topbar-select-wrap">
              <AppIcon name="branch" size={16} className="topbar-select-icon" />
              <select
                className="topbar-select"
                value={session.branchId ?? ""}
                onChange={(event) => setBranch(Number(event.target.value))}
                disabled={!activeCompany?.branches.length}
              >
                {(activeCompany?.branches ?? []).map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="topbar-select-wrap">
              <AppIcon name="calendar" size={16} className="topbar-select-icon" />
              <select className="topbar-select" value={session.periodLabel} onChange={(event) => setPeriod(event.target.value)}>
                <option>Month to Date</option>
                <option>This Month</option>
                <option>Last Month</option>
                <option>Quarter to Date</option>
                <option>This Quarter</option>
                <option>Year to Date</option>
                <option>Custom Range</option>
                <option>Mar 2026</option>
                <option>Feb 2026</option>
                <option>Jan 2026</option>
              </select>
            </label>

            <div className="dropdown-wrap">
              <button type="button" className="primary-button with-icon" onClick={() => setQuickMenuOpen((current) => !current)}>
                <Plus size={16} />
                Quick create
              </button>
              {quickMenuOpen ? (
                <div className="floating-menu">
                  {quickCreateActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      className="floating-menu__item"
                      onClick={() => {
                        setQuickMenuOpen(false);
                        router.push(action.href);
                      }}
                    >
                    <span className="floating-menu__icon"><AppIcon name={action.icon ?? "plus"} size={16} /></span>
                      <div>
                        <strong>{action.label}</strong>
                        <span>{action.hint}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <button type="button" className="ghost-button icon-only" onClick={() => setNotificationsOpen((current) => !current)}>
              <AppIcon name="notification" size={17} />
            </button>

            <div className="dropdown-wrap">
              <button
                type="button"
                className="ghost-button icon-only"
                aria-label="Open user menu"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                onClick={() => setUserMenuOpen((current) => !current)}
              >
                <AppIcon name="user" size={18} />
              </button>
              {userMenuOpen ? (
                <div className="floating-menu floating-menu--table floating-menu--user">
                  <div className="floating-menu__profile">
                    <strong>{session.userName || session.userEmail || "Workspace user"}</strong>
                    <span>{getRoleLabel(role)}</span>
                  </div>
                  <button
                    type="button"
                    className="floating-menu__item"
                    onClick={() => {
                      setUserMenuOpen(false);
                      signOut();
                    }}
                  >
                    <div>
                      <strong>Sign out</strong>
                      <span>End this workspace session securely</span>
                    </div>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="erp-page">
          <section className="page-hero surface">
            <div>
              <span className="section-eyebrow">{activeBranch?.name || session.branchName || "Workspace"}</span>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            <div className="page-hero__meta">
              <div className="hero-meta-card">
                <div className="meta-stack">
                  <span className="meta-label">Role</span>
                  <strong className="meta-value">{getRoleLabel(role)}</strong>
                </div>
              </div>
              <div className="hero-meta-card">
                <div className="meta-stack">
                  <span className="meta-label">Period</span>
                  <strong className="meta-value">{session.periodLabel}</strong>
                </div>
              </div>
              <div className="hero-meta-card">
                <div className="meta-stack">
                  <span className="meta-label">Branch</span>
                  <strong className="meta-value">{activeBranch?.name || session.branchName || "All"}</strong>
                </div>
              </div>
              {pageActions ? <div className="hero-actions-inline">{pageActions}</div> : null}
            </div>
          </section>

          {moduleMenuGroups.length ? (
            <div className="module-menu-strip surface">
              <span className="module-menu-strip__label">Browse</span>
              <div className="module-menu-strip__menus">
                {moduleMenuGroups.map((group) => (
                  <ActionMenu
                    key={group.label}
                    label={group.label}
                    items={group.items.map((item) => ({
                      label: item.label,
                      description: item.description,
                      href: item.href,
                    }))}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {tabs?.length ? (
            <SubnavTabs tabs={tabs} activeTab={currentTab} onChange={setTab} />
          ) : null}

          {error ? <div className="banner warning">{error}</div> : null}
          {!pageAllowed ? (
            <section className="surface empty-state">
              <strong>Permission-aware workspace</strong>
              <p>Your selected role does not have this workspace enabled in the current frontend policy.</p>
            </section>
          ) : (
            children
          )}
        </main>
      </div>

      {notificationsOpen ? (
        <aside className="side-panel">
          <div className="side-panel__header">
            <h3>Notifications</h3>
            <button type="button" className="ghost-button small" onClick={() => setNotificationsOpen(false)}>
              Close
            </button>
          </div>
          <div className="notification-list">
            {notificationFeed.map((item) => (
              <article key={item.id} className="notification-item">
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                <span>{item.when}</span>
              </article>
            ))}
          </div>
        </aside>
      ) : null}

      {paletteOpen ? (
        <div className="palette-backdrop" onClick={() => setPaletteOpen(false)}>
          <div className="palette" onClick={(event) => event.stopPropagation()}>
            <input
              autoFocus
              className="palette__input"
              placeholder="Jump to a workspace, report, or action"
              value={paletteQuery}
              onChange={(event) => setPaletteQuery(event.target.value)}
            />
            <div className="palette__results">
              {commandEntries.map((entry) => (
                <button
                  key={`${entry.label}-${entry.href}`}
                  type="button"
                  className="palette__item"
                  onClick={() => {
                    setPaletteOpen(false);
                    setPaletteQuery("");
                    router.push(entry.href);
                  }}
                >
                  <span className="palette__item-main">
                    <AppIcon name={entry.icon ?? "plus"} size={16} />
                    <strong>{entry.label}</strong>
                  </span>
                  <span>{entry.hint}</span>
                </button>
              ))}
              {commandEntries.length === 0 ? <p className="palette__empty">No matching actions.</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ModuleCard({
  title,
  body,
  actionLabel,
  tone = "neutral",
}: {
  title: string;
  body: string;
  actionLabel?: string;
  tone?: UiTone;
}) {
  return (
    <article className={`surface module-card module-card--${tone}`}>
      <h3>{title}</h3>
      <p>{body}</p>
      {actionLabel ? <span className="table-tag">{actionLabel}</span> : null}
    </article>
  );
}
