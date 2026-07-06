import { Bell, MessageCircle, CheckCircle, AlertCircle, UserPlus } from "lucide-react";
import { Link } from "react-router";
import { ROUTES } from "~/constants/routes";

interface NotificationData {
  id: string;
  type: "comment" | "reply" | "verification" | "chat" | "new-content";
  message: string;
  isRead: boolean;
  createdAt: string;
  linkTo?: string;
}

interface NotificationItemProps {
  notification: NotificationData;
}

const typeIcons: Record<string, React.ReactNode> = {
  comment: <MessageCircle size={16} className="text-info" />,
  reply: <MessageCircle size={16} className="text-primary" />,
  verification: <CheckCircle size={16} className="text-success" />,
  chat: <AlertCircle size={16} className="text-warning" />,
  "new-content": <UserPlus size={16} className="text-tertiary" />,
};

export function NotificationItem({ notification }: NotificationItemProps) {
  const content = (
    <article
      className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-border-custom/30 ${
        !notification.isRead
          ? "bg-primary/5 border-l-3 border-l-primary unread-pulse"
          : ""
      }`}
    >
      <figure className="flex-shrink-0 mt-0.5">
        {typeIcons[notification.type] ?? <Bell size={16} className="text-on-surface-muted" />}
      </figure>
      <section className="flex-1 min-w-0">
        <p className={`text-body-sm ${notification.isRead ? "text-on-surface-muted" : "text-on-surface font-medium"}`}>
          {notification.message}
        </p>
        <time className="text-label-sm text-on-surface-muted mt-0.5 block">
          {notification.createdAt}
        </time>
      </section>
      {!notification.isRead && (
        <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" aria-hidden="true" />
      )}
    </article>
  );

  if (notification.linkTo) {
    return <Link to={notification.linkTo} className="block">{content}</Link>;
  }

  return content;
}

interface NotificationsPopoverProps {
  notifications: NotificationData[];
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationsPopover({
  notifications,
  isOpen,
  onClose,
}: NotificationsPopoverProps) {
  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />

      <aside className="absolute right-0 top-full mt-2 z-50 w-96 max-h-[480px] overflow-hidden rounded-2xl bg-surface border border-border-custom shadow-2xl animate-slide-down">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border-custom">
          <h3 className="text-label-lg text-on-surface">
            Notifications {unreadCount > 0 && `(${unreadCount})`}
          </h3>
          <Link
            to={ROUTES.DASHBOARD.NOTIFICATIONS}
            className="text-label-md text-primary hover:text-secondary transition-colors"
            onClick={onClose}
          >
            See all
          </Link>
        </header>

        <ul className="overflow-y-auto max-h-[400px] divide-y divide-border-custom">
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <li key={notification.id}>
                <NotificationItem notification={notification} />
              </li>
            ))
          ) : (
            <li className="py-12 text-center">
              <Bell size={32} className="mx-auto text-on-surface-muted/40 mb-2" />
              <p className="text-body-sm text-on-surface-muted">No notifications yet</p>
            </li>
          )}
        </ul>
      </aside>
    </>
  );
}

export type { NotificationData };
