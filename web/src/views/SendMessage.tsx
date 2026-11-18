import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';

import { sendMessage } from '@/api/client';
import { EmptyState } from '@/components/EmptyState';
import { SendIcon, ChatIcon, PlugIcon } from '@/components/Icons';
import { SectionCard } from '@/components/SectionCard';
import { Spinner } from '@/components/Spinner';
import { useToast } from '@/components/Toast';
import type { DashboardStore } from '@/hooks/useDashboard';
import type { Route } from '@/config';
import { errorMessage, isAbortError } from '@/lib/errors';
import { formatClock } from '@/lib/format';
import { normalizeRecipient, parseMentions } from '@/lib/mentions';

interface SendMessageProps {
  store: DashboardStore;
  onNavigate: (route: Route) => void;
}

export function SendMessage({ store, onNavigate }: SendMessageProps) {
  const toast = useToast();
  const [recipient, setRecipient] = useState('');
  const [content, setContent] = useState('');
  const [mentionsInput, setMentionsInput] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const recipientId = useId();
  const recipientHintId = useId();
  const contentId = useId();
  const contentHintId = useId();
  const mentionsId = useId();
  const mentionsHintId = useId();

  const status = store.whatsapp?.status ?? 'disconnected';
  const connected = status === 'connected';
  const recipientInfo = normalizeRecipient(recipient);
  const parsedMentions = parseMentions(mentionsInput);
  const contentLength = content.length;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!connected || sending) return;

    const text = content.trim();
    if (!recipientInfo.valid) {
      setFormError('Enter a valid phone number (8–15 digits) or a full WhatsApp JID.');
      return;
    }
    if (!text) {
      setFormError('Write a message before sending.');
      return;
    }

    setFormError(null);
    setSending(true);
    try {
      const result = await sendMessage({
        to: recipientInfo.to,
        content: text,
        ...(parsedMentions.mentions.length > 0 ? { mentions: parsedMentions.mentions } : {}),
      });

      if (result.success) {
        toast.push('success', `Message sent to ${recipientInfo.preview}.`);
        setContent('');
        setMentionsInput('');
      } else {
        toast.push('error', result.error ?? 'The message could not be sent.');
      }

      store.recordSent({
        id: result.id,
        to: recipientInfo.preview,
        content: text,
        success: result.success,
        ...(result.error ? { error: result.error } : {}),
      });
    } catch (error) {
      if (isAbortError(error)) return;
      const message = errorMessage(error);
      setFormError(message);
      toast.push('error', message);
      store.recordSent({
        to: recipientInfo.preview,
        content: text,
        success: false,
        error: message,
      });
    } finally {
      setSending(false);
    }
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2 className="view-title">Send message</h2>
          <p className="view-subtitle">
            Send a plain-text WhatsApp message through the connected bot.
          </p>
        </div>
      </div>

      {!connected ? (
        <div className="alert alert--info" role="status">
          <div className="alert__body">
            <strong>WhatsApp is not connected</strong>
            <span>Sending is disabled until the platform reports a live connection.</span>
          </div>
          <button type="button" className="btn btn--sm btn--secondary" onClick={() => onNavigate('connect')}>
            Open connection
          </button>
        </div>
      ) : null}

      <div className="send-layout">
        <SectionCard
          title="Compose"
          subtitle="Recipient, body, and optional mentions"
          actions={<span className="card-note">Plain text only</span>}
        >
          <form className="form" onSubmit={(event) => void handleSubmit(event)} noValidate>
            <div className="field">
              <label className="field__label" htmlFor={recipientId}>
                Recipient
              </label>
              <input
                id={recipientId}
                className="input mono"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                placeholder="5511999999999 or 120363…@g.us"
                autoComplete="off"
                spellCheck={false}
                aria-describedby={recipientHintId}
                aria-invalid={recipient.length > 0 && !recipientInfo.valid}
              />
              <p className="field__hint" id={recipientHintId}>
                Phone digits (E.164 without “+”) or a full JID. Groups require the complete
                <span className="mono"> @g.us</span> JID.
              </p>
              {recipient && recipientInfo.valid ? (
                <p className="field__preview">
                  Sends to <span className="mono">{recipientInfo.preview}</span>
                </p>
              ) : null}
            </div>

            <div className="field">
              <label className="field__label" htmlFor={contentId}>
                Message
              </label>
              <textarea
                id={contentId}
                className="textarea"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder="Type your message…"
                rows={6}
                aria-describedby={contentHintId}
              />
              <div className="field__row" id={contentHintId}>
                <span className="field__hint">Ctrl/⌘ + Enter to send</span>
                <span className="field__count">{contentLength.toLocaleString()} chars</span>
              </div>
            </div>

            <div className="field">
              <label className="field__label" htmlFor={mentionsId}>
                Mentions <span className="field__optional">optional</span>
              </label>
              <input
                id={mentionsId}
                className="input mono"
                value={mentionsInput}
                onChange={(event) => setMentionsInput(event.target.value)}
                placeholder="5511888888888, 5511777777777"
                autoComplete="off"
                spellCheck={false}
                aria-describedby={mentionsHintId}
              />
              <p className="field__hint" id={mentionsHintId}>
                Comma-separated JIDs or phone numbers. Type <span className="mono">@name</span> in
                the message for each mention; bare numbers use the digits as the name.
              </p>
              {parsedMentions.mentions.length > 0 ? (
                <ul className="mention-list" aria-label="Parsed mentions">
                  {parsedMentions.mentions.map((mention) => (
                    <li key={mention.jid} className="mention">
                      <span className="mention__name">@{mention.name}</span>
                      <span className="mention__jid mono" title={mention.jid}>
                        {mention.jid}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {parsedMentions.invalid.length > 0 ? (
                <p className="field__error">
                  Ignored invalid entries: {parsedMentions.invalid.join(', ')}
                </p>
              ) : null}
            </div>

            {formError ? (
              <p className="form-error" role="alert">
                {formError}
              </p>
            ) : null}

            <div className="form__actions">
              <button
                type="submit"
                className="btn btn--primary"
                disabled={!connected || sending}
              >
                {sending ? <Spinner label="Sending message" /> : <SendIcon size={16} />}
                {sending ? 'Sending…' : 'Send message'}
              </button>
              {!connected ? <span className="form__note">Connect WhatsApp to enable sending.</span> : null}
            </div>

            <p className="form__note">
              Slash commands are not implemented yet — every message is delivered as plain text.
            </p>
          </form>
        </SectionCard>

        <SectionCard
          title="Sent from this dashboard"
          subtitle="Local history · newest first"
          className="send-history-card"
          actions={<span className="count-badge">{store.sent.length}</span>}
        >
          {store.sent.length === 0 ? (
            <EmptyState
              icon={<SendIcon size={26} />}
              title="Nothing sent yet"
              description="Messages you send from this browser appear here with delivery status."
            />
          ) : (
            <ul className="sent-list">
              {store.sent.map((item) => (
                <li key={item.id} className="sent-item">
                  <div className="sent-item__top">
                    <span className="mono truncate" title={item.to}>
                      {item.to}
                    </span>
                    <span className={`chip ${item.success ? 'chip--out' : 'chip--failed'}`}>
                      {item.success ? 'Sent' : 'Failed'}
                    </span>
                  </div>
                  <p className="sent-item__text">{item.content}</p>
                  {item.error ? <p className="field__error">{item.error}</p> : null}
                  <time className="sent-item__time" dateTime={item.sentAt}>
                    {formatClock(item.sentAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="inline-note">
        <ChatIcon size={15} />
        Mentions are resolved by the backend; incoming messages use display names, so outgoing
        mentions must match the name exactly.
      </div>

      <div className="inline-note">
        <PlugIcon size={15} />
        Tip: keep the Connection tab open while linking a new device.
      </div>
    </div>
  );
}
