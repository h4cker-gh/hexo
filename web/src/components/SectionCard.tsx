import { useId, type ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
}: SectionCardProps) {
  const titleId = useId();
  return (
    <section
      className={className ? `card ${className}` : 'card'}
      aria-labelledby={titleId}
    >
      <header className="card__header">
        <div className="card__heading">
          <h3 className="card__title" id={titleId}>
            {title}
          </h3>
          {subtitle ? <p className="card__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="card__actions">{actions}</div> : null}
      </header>
      <div className={bodyClassName ? `card__body ${bodyClassName}` : 'card__body'}>
        {children}
      </div>
    </section>
  );
}
