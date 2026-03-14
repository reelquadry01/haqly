import { BrandLockup } from "../components/ui/brand-lockup";

export default function Loading() {
  return (
    <div className="route-loader">
      <div className="route-loader__panel">
        <BrandLockup className="app-splash__lockup" subtitle="Loading workspace" />
        <div className="app-splash__bar">
          <div className="app-splash__fill" />
        </div>
        <p>Please wait while we prepare your ERP workspace.</p>
      </div>
    </div>
  );
}
