import { useRef, type KeyboardEvent } from 'react';

import { TABS, type Route } from '@/config';

interface TabsProps {
  active: Route;
  onChange: (route: Route) => void;
}

export function Tabs({ active, onChange }: TabsProps) {
  const refs = useRef<Map<Route, HTMLButtonElement>>(new Map());

  const focusTab = (route: Route) => {
    onChange(route);
    refs.current.get(route)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = TABS.findIndex((tab) => tab.id === active);
    if (currentIndex < 0) return;

    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = TABS.length - 1;

    if (nextIndex === null) return;
    event.preventDefault();
    const next = TABS[nextIndex];
    if (next) focusTab(next.id);
  };

  return (
    <div className="tabs" role="tablist" aria-label="Dashboard sections" onKeyDown={onKeyDown}>
      {TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              if (node) refs.current.set(tab.id, node);
              else refs.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            className={selected ? 'tab tab--active' : 'tab'}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
