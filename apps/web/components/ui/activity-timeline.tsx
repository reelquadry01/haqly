import type { TimelineItem } from "../../lib/erp";
import { StatusBadge } from "./status-badge";

export function ActivityTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <div className="timeline-list">
      {items.map((item) => (
        <article key={item.id} className="timeline-item">
          <div className="timeline-item__dot" />
          <div className="timeline-item__body">
            <div className="timeline-item__topline">
              <strong>{item.title}</strong>
              <span>{item.timestamp}</span>
            </div>
            <p>{item.subtitle}</p>
            <div className="timeline-item__meta">
              <span>{item.user}</span>
              {item.status ? <StatusBadge status={item.status} /> : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
