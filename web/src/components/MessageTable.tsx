import { memo } from 'react';

import type { MessageRecord } from '@/api/types';
import { ChatIcon } from '@/components/Icons';
import { EmptyState } from '@/components/EmptyState';
import { formatClock, formatDateTime } from '@/lib/format';

interface MessageTableProps {
  messages: MessageRecord[];
}

export const MessageTable = memo(function MessageTable({ messages }: MessageTableProps) {
  if (messages.length === 0) {
    return (
      <EmptyState
        icon={<ChatIcon size={26} />}
        title="No messages yet"
        description="Incoming and outgoing WhatsApp messages appear here as soon as they arrive."
      />
    );
  }

  return (
    <div className="table-wrap">
      <table className="msg-table">
        <caption className="visually-hidden">Recent WhatsApp messages, newest first</caption>
        <thead>
          <tr>
            <th scope="col">Dir</th>
            <th scope="col">Chat</th>
            <th scope="col">Sender</th>
            <th scope="col">Message</th>
            <th scope="col">Time</th>
          </tr>
        </thead>
        <tbody>
          {messages.map((message) => {
            const failed = !message.success;
            return (
              <tr key={message.id}>
                <td data-col="direction">
                  <span className="dir-cell">
                    <span className={`chip chip--${message.direction}`}>
                      {message.direction === 'in' ? 'In' : 'Out'}
                    </span>
                    {failed ? (
                      <span className="chip chip--failed" title="This message was not delivered">
                        Failed
                      </span>
                    ) : null}
                  </span>
                </td>
                <td data-col="chat">
                  <span className="mono truncate" title={message.chatId}>
                    {message.chatId}
                  </span>
                </td>
                <td data-col="sender">
                  <span className="sender">
                    <span className="sender__name">
                      {message.senderName ?? message.senderId}
                    </span>
                    {message.senderName ? (
                      <span className="sender__jid mono" title={message.senderId}>
                        {message.senderId}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td data-col="text">
                  {message.text ? (
                    <span className="msg-text" title={message.text}>
                      {message.text}
                    </span>
                  ) : (
                    <span className="msg-text msg-text--empty">(no text)</span>
                  )}
                </td>
                <td data-col="time">
                  <time dateTime={message.timestamp} title={formatDateTime(message.timestamp)}>
                    {formatClock(message.timestamp)}
                  </time>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});
