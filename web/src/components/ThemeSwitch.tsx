import { THEMES, type Theme } from '@/config';

interface ThemeSwitchProps {
  theme: Theme;
  onChange: (theme: Theme) => void;
}

export function ThemeSwitch({ theme, onChange }: ThemeSwitchProps) {
  return (
    <div className="theme-switch" role="group" aria-label="Color theme">
      {THEMES.map((option) => (
        <button
          key={option.id}
          type="button"
          className={theme === option.id ? 'theme-switch__btn theme-switch__btn--active' : 'theme-switch__btn'}
          aria-pressed={theme === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
