import { StreamBadge } from '@/components/StatusBadge';
import { Tabs } from '@/components/Tabs';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { ToastProvider } from '@/components/Toast';
import { APP_NAME, APP_TAGLINE } from '@/config';
import { useDashboard } from '@/hooks/useDashboard';
import { useHashRoute } from '@/hooks/useHashRoute';
import { useTheme } from '@/hooks/useTheme';
import { Connect } from '@/views/Connect';
import { Dashboard } from '@/views/Dashboard';
import { SendMessage } from '@/views/SendMessage';

export default function App() {
  const [route, navigate] = useHashRoute();
  const store = useDashboard();
  const [theme, setTheme] = useTheme();
  const streamState =
    store.loading && store.platforms.length === 0 ? 'connecting' : store.stream.state;

  return (
    <ToastProvider>
      <a className="skip-link" href="#main-content">
        Skip to dashboard content
      </a>
      <div className="app-shell">
        <header className="app-header">
          <div className="header-inner">
            <div className="brand">
              <span className="brand__mark" aria-hidden="true">
                H
              </span>
              <div className="brand__text">
                <h1 className="brand__name">{APP_NAME}</h1>
                <p className="brand__tagline">{APP_TAGLINE}</p>
              </div>
            </div>
            <div className="header-tools">
              <StreamBadge state={streamState} attempts={store.stream.attempts} />
              <ThemeSwitch theme={theme} onChange={setTheme} />
            </div>
          </div>
        </header>

        <main className="main" id="main-content" tabIndex={-1}>
          <div className="tabs-bar">
            <Tabs active={route} onChange={navigate} />
          </div>

          <div
            role="tabpanel"
            id="panel-dashboard"
            aria-labelledby="tab-dashboard"
            hidden={route !== 'dashboard'}
          >
            <Dashboard store={store} onNavigate={navigate} />
          </div>
          <div
            role="tabpanel"
            id="panel-send"
            aria-labelledby="tab-send"
            hidden={route !== 'send'}
          >
            <SendMessage store={store} onNavigate={navigate} />
          </div>
          <div
            role="tabpanel"
            id="panel-connect"
            aria-labelledby="tab-connect"
            hidden={route !== 'connect'}
          >
            <Connect store={store} onNavigate={navigate} />
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
