"use client";

type SubnavTabsProps = {
  tabs: string[];
  activeTab?: string;
  onChange: (tab: string) => void;
};

export function SubnavTabs({ tabs, activeTab, onChange }: SubnavTabsProps) {
  if (!tabs.length) {
    return null;
  }

  return (
    <div className="tab-strip" role="tablist" aria-label="Module navigation">
      {tabs.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={isActive ? "tab-chip active" : "tab-chip"}
            onClick={() => onChange(tab)}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}
