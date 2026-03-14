export function SectionCard({
  title,
  eyebrow,
  action,
  children,
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="surface section-card">
      <header className="section-card__header">
        <div>
          {eyebrow ? <span className="section-eyebrow">{eyebrow}</span> : null}
          <h3>{title}</h3>
        </div>
        {action ? <div className="section-card__action">{action}</div> : null}
      </header>
      {children}
    </section>
  );
}
