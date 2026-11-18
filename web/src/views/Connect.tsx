import { useId, useState, type FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { connectWhatsApp, disconnectWhatsApp } from '@/api/client';
import type { ConnectMethod } from '@/api/types';
import { CheckIcon, CopyIcon, PhoneIcon, PlugIcon, QrIcon } from '@/components/Icons';
import { SectionCard } from '@/components/SectionCard';
import { Spinner } from '@/components/Spinner';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';
import type { DashboardStore } from '@/hooks/useDashboard';
import { useNow } from '@/hooks/useNow';
import type { Route } from '@/config';
import { errorMessage, isAbortError } from '@/lib/errors';
import { formatDateTime, formatDuration, formatPairingCode, uptimeMs } from '@/lib/format';
import { statusMeta } from '@/lib/status';

interface ConnectProps {
  store: DashboardStore;
  onNavigate: (route: Route) => void;
}

type PendingAction = 'connect' | 'disconnect' | 'logout' | null;

export function Connect({ store, onNavigate }: ConnectProps) {
  const toast = useToast();
  const now = useNow(1000);
  const phoneId = useId();
  const phoneHintId = useId();

  const platform = store.whatsapp;
  const status = platform?.status ?? 'disconnected';
  const meta = statusMeta(status);
  const stats = platform?.stats;
  const connected = status === 'connected';
  const connectedSince = stats?.connected ? stats.startedAt : null;
  const uptime = connectedSince ? uptimeMs(connectedSince, now) : null;

  const [method, setMethod] = useState<ConnectMethod | null>(null);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const qr = platform?.qr;
  const pairingCode = platform?.pairingCode;
  const errorText = actionError ?? (status === 'error' ? platform?.error : undefined);
  const phoneValid = /^\d{8,15}$/.test(phone);

  async function startConnect(target: ConnectMethod) {
    setActionError(null);
    setMethod(target);
    setPendingAction('connect');
    try {
      const result = await connectWhatsApp(
        target,
        target === 'pairing-code' ? phone : undefined,
      );
      if (result.status === 'connected') {
        toast.push('info', 'WhatsApp is already connected.');
      } else {
        toast.push(
          'info',
          target === 'pairing-code'
            ? 'Requesting a pairing code…'
            : 'Starting WhatsApp and preparing a QR code…',
        );
      }
      await store.refreshPlatform('whatsapp');
    } catch (error) {
      if (isAbortError(error)) return;
      const message = errorMessage(error);
      setActionError(message);
      toast.push('error', message);
    } finally {
      setPendingAction(null);
    }
  }

  function startPairing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!phoneValid) {
      setPhoneError('Use digits only, including the country code (8–15 digits).');
      return;
    }
    setPhoneError(null);
    void startConnect('pairing-code');
  }

  async function handleDisconnect(logout: boolean) {
    setActionError(null);
    setPendingAction(logout ? 'logout' : 'disconnect');
    try {
      await disconnectWhatsApp(logout);
      toast.push(
        'success',
        logout
          ? 'Logged out of WhatsApp and deleted the stored session.'
          : 'Disconnected. Stored credentials were kept.',
      );
      setMethod(null);
      setConfirmLogout(false);
      setPhoneError(null);
      await store.refreshPlatform('whatsapp');
    } catch (error) {
      if (isAbortError(error)) return;
      const message = errorMessage(error);
      setActionError(message);
      toast.push('error', message);
    } finally {
      setPendingAction(null);
    }
  }

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.push('success', `${label} copied.`);
    } catch {
      toast.push('error', 'Clipboard access is unavailable in this browser.');
    }
  }

  const showQr = status === 'qr';
  const showPairing = status === 'pairing';
  const showPending = !connected && (status === 'connecting' || pendingAction === 'connect');
  const showChooser = !connected && !showQr && !showPairing && !showPending;

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2 className="view-title">Connection</h2>
          <p className="view-subtitle">Link, monitor, or reset the WhatsApp session.</p>
        </div>
      </div>

      <div className="connect-status" role="status" aria-live="polite">
        <StatusBadge status={status} />
        <span className="connect-status__hint">{meta.hint}</span>
        {pendingAction === 'disconnect' || pendingAction === 'logout' ? (
          <span className="connect-status__busy">
            <Spinner /> Working…
          </span>
        ) : null}
      </div>

      {errorText ? (
        <div className="alert alert--error" role="alert">
          <div className="alert__body">
            <strong>{status === 'error' ? 'Connection error' : 'Action failed'}</strong>
            <span>{errorText}</span>
          </div>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {connected ? (
        <section className="card connect-hero" aria-labelledby="connected-heading">
          <div className="connect-hero__top">
            <span className="connect-hero__mark" aria-hidden="true">
              <CheckIcon size={24} />
            </span>
            <div>
              <h3 className="connect-hero__title" id="connected-heading">
                WhatsApp is connected
              </h3>
              <p className="connect-hero__hint">The bot can receive and send messages.</p>
            </div>
          </div>

          <dl className="meta-grid">
            <div className="meta">
              <dt className="meta__label">Linked account</dt>
              <dd className="meta__value mono meta__value--with-action">
                <span className="truncate" title={platform?.botJid ?? undefined}>
                  {platform?.botJid ?? '—'}
                </span>
                {platform?.botJid ? (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => void copyValue(platform.botJid ?? '', 'Bot JID')}
                    aria-label="Copy bot JID"
                    title="Copy bot JID"
                  >
                    <CopyIcon />
                  </button>
                ) : null}
              </dd>
            </div>
            <div className="meta">
              <dt className="meta__label">Connected since</dt>
              <dd className="meta__value">{formatDateTime(connectedSince)}</dd>
            </div>
            <div className="meta">
              <dt className="meta__label">Uptime</dt>
              <dd className="meta__value mono">{uptime === null ? '—' : formatDuration(uptime)}</dd>
            </div>
            <div className="meta">
              <dt className="meta__label">Messages</dt>
              <dd className="meta__value mono">
                {stats?.messagesReceived ?? 0} in · {stats?.messagesSent ?? 0} out
              </dd>
            </div>
          </dl>

          <div className="connect-hero__actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => void handleDisconnect(false)}
              disabled={pendingAction !== null}
            >
              {pendingAction === 'disconnect' ? <Spinner label="Disconnecting" /> : <PlugIcon size={16} />}
              {pendingAction === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => setConfirmLogout(true)}
              disabled={pendingAction !== null}
            >
              Log out
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => onNavigate('send')}>
              Send a message
            </button>
          </div>
          <p className="connect-hero__note">
            Disconnect closes the session but keeps credentials. Log out deletes the stored session
            — you’ll need to scan a new QR code to reconnect.
          </p>
        </section>
      ) : null}

      {showQr ? (
        <section className="card connect-panel" aria-labelledby="qr-heading">
          <div className="card__header">
            <div className="card__heading">
              <h3 className="card__title" id="qr-heading">
                Scan to link WhatsApp
              </h3>
              <p className="card__subtitle">WhatsApp → Linked devices → Link a device</p>
            </div>
          </div>
          <div className="card__body qr-layout">
            <div className="qr-box" role="img" aria-label="QR code for linking WhatsApp">
              {qr ? (
                <QRCodeSVG value={qr} size={232} level="M" bgColor="#ffffff" fgColor="#05050A" />
              ) : (
                <div className="qr-box__loading">
                  <Spinner label="Loading QR code" />
                  <span>Preparing QR…</span>
                </div>
              )}
            </div>
            <div className="connect-steps">
              <ol className="steps">
                <li>Open WhatsApp on the phone you want to link.</li>
                <li>Go to Settings → Linked devices → Link a device.</li>
                <li>Point the phone at this QR code.</li>
              </ol>
              <p className="waiting">
                <Spinner /> Waiting for scan… the QR refreshes automatically.
              </p>
              <div className="connect-steps__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => void handleDisconnect(false)}
                  disabled={pendingAction !== null}
                >
                  Cancel linking
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {showPairing ? (
        <section className="card connect-panel" aria-labelledby="pairing-heading">
          <div className="card__header">
            <div className="card__heading">
              <h3 className="card__title" id="pairing-heading">
                Pair with a phone number
              </h3>
              <p className="card__subtitle">WhatsApp → Linked devices → Link with phone number</p>
            </div>
          </div>
          <div className="card__body pairing-layout">
            {pairingCode ? (
              <div className="pairing-code-block">
                <p className="pairing-code-label">Enter this code on your phone</p>
                <p className="pairing-code" aria-label={`Pairing code ${pairingCode.split('').join(' ')}`}>
                  {formatPairingCode(pairingCode)}
                </p>
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => void copyValue(pairingCode, 'Pairing code')}
                >
                  <CopyIcon /> Copy code
                </button>
              </div>
            ) : (
              <div className="pairing-code-block">
                <Spinner label="Loading pairing code" />
                <p className="pairing-code-label">Requesting your pairing code…</p>
                <p className="waiting">This usually takes a few seconds.</p>
              </div>
            )}
            <ol className="steps">
              <li>Open WhatsApp on your phone.</li>
              <li>Tap Linked devices → Link with phone number.</li>
              <li>Type the 8-character code shown here.</li>
            </ol>
            <div className="connect-steps__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => void handleDisconnect(false)}
                disabled={pendingAction !== null}
              >
                Cancel pairing
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {showPending ? (
        <section className="card connect-panel" aria-labelledby="pending-heading">
          <div className="pending-panel">
            <Spinner label="Connecting to WhatsApp" />
            <h3 className="connect-hero__title" id="pending-heading">
              Connecting to WhatsApp…
            </h3>
            <p className="connect-hero__hint">
              {method === 'pairing-code'
                ? 'Requesting a pairing code. Keep this page open — the code appears here as soon as WhatsApp returns it.'
                : 'Starting the session and preparing the QR code. This can take a few seconds.'}
            </p>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void handleDisconnect(false)}
              disabled={pendingAction !== null}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {showChooser ? (
        <div className="connect-grid">
          <SectionCard
            title="Link with QR code"
            subtitle="Fastest option · scan from your phone"
            actions={<QrIcon size={18} />}
          >
            <p className="option-desc">
              Generate a QR code and scan it with WhatsApp. The code refreshes automatically until
              the device is linked.
            </p>
            <ol className="steps steps--compact">
              <li>Open WhatsApp on your phone.</li>
              <li>Go to Linked devices → Link a device.</li>
              <li>Scan the QR code shown here.</li>
            </ol>
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => void startConnect('qr')}
              disabled={pendingAction !== null}
            >
              {pendingAction === 'connect' && method === 'qr' ? (
                <Spinner label="Starting QR session" />
              ) : (
                <QrIcon size={16} />
              )}
              {pendingAction === 'connect' && method === 'qr' ? 'Starting…' : 'Generate QR code'}
            </button>
          </SectionCard>

          <SectionCard
            title="Link with pairing code"
            subtitle="Enter a code on your phone instead"
            actions={<PhoneIcon size={18} />}
          >
            <p className="option-desc">
              Use your phone number to receive an 8-character code, then enter it on WhatsApp.
            </p>
            <form className="form form--compact" onSubmit={startPairing} noValidate>
              <div className="field">
                <label className="field__label" htmlFor={phoneId}>
                  Phone number
                </label>
                <input
                  id={phoneId}
                  className="input mono"
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value.replace(/\D/g, '').slice(0, 15));
                    if (phoneError) setPhoneError(null);
                  }}
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="5511999999999"
                  aria-describedby={phoneHintId}
                  aria-invalid={phoneError !== null}
                />
                <p className="field__hint" id={phoneHintId}>
                  Digits only, E.164 without “+”, including country code (8–15 digits).
                </p>
                {phoneError ? <p className="field__error">{phoneError}</p> : null}
              </div>
              <button
                type="submit"
                className="btn btn--secondary btn--block"
                disabled={pendingAction !== null}
              >
                {pendingAction === 'connect' && method === 'pairing-code' ? (
                  <Spinner label="Requesting pairing code" />
                ) : (
                  <PhoneIcon size={16} />
                )}
                {pendingAction === 'connect' && method === 'pairing-code'
                  ? 'Requesting code…'
                  : 'Get pairing code'}
              </button>
            </form>
          </SectionCard>
        </div>
      ) : null}

      {showChooser && status === 'error' ? (
        <div className="connect-tools">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void handleDisconnect(false)}
            disabled={pendingAction !== null}
          >
            Reset session
          </button>
        </div>
      ) : null}

      <p className="inline-note">
        <PlugIcon size={15} />
        Connection updates arrive over SSE; this page also re-fetches the platform snapshot after
        every connection event.
      </p>

      <ConfirmDialog
        open={confirmLogout}
        title="Log out of WhatsApp?"
        description="This deletes the stored WhatsApp session on the server. The bot will be offline until you link a device again with a new QR code or pairing code."
        confirmLabel="Log out"
        tone="danger"
        busy={pendingAction === 'logout'}
        onConfirm={() => void handleDisconnect(true)}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
}
