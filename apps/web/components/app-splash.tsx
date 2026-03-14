"use client";

import { useEffect, useState } from "react";
import { BrandLockup } from "./ui/brand-lockup";

export function AppSplash() {
  const [hidden, setHidden] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const rafA = window.requestAnimationFrame(() => {
      const rafB = window.requestAnimationFrame(() => {
        setMounted(true);
        setHidden(true);
      });
      return () => window.cancelAnimationFrame(rafB);
    });

    return () => window.cancelAnimationFrame(rafA);
  }, []);

  if (mounted && hidden) {
    return null;
  }

  return (
    <div className={`app-splash${hidden ? " app-splash--hidden" : ""}`} aria-hidden="true">
      <div className="app-splash__inner">
        <BrandLockup className="app-splash__lockup" subtitle="Loading workspace" />
        <div className="app-splash__bar">
          <div className="app-splash__fill" />
        </div>
      </div>
    </div>
  );
}
