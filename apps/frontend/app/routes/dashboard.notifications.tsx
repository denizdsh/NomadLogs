import { useEffect } from "react";
import { NotificationItem, type NotificationData } from "~/components/ui/NotificationsPopover";
import { trpc } from "~/utils/trpc";
import { useAuth } from "~/providers/AuthProvider";

export function meta() {
  return [
    { title: "Notifications — NomadLogs" },
    { name: "description", content: "View all your notifications." },
  ];
}

export default function Notifications() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isAuthenticated = !!user;

  // Query notifications list
  const { data: notificationsData, isLoading } = trpc.notification.list.useQuery(
    { limit: 50 },
    { enabled: isAuthenticated }
  );

  // Mutation to mark all read
  const markAllReadMutation = trpc.notification.markAllRead.useMutation();

  useEffect(() => {
    if (isAuthenticated) {
      markAllReadMutation.mutateAsync().then(() => {
        utils.notification.unreadCount.invalidate();
      });
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return <div className="p-8 text-center text-body-lg skeleton-shimmer">Loading notifications...</div>;
  }

  const mapNotificationType = (type: string): "comment" | "reply" | "verification" | "chat" | "new-content" => {
    switch (type) {
      case "NEW_COMMENT": return "comment";
      case "COMMENT_REPLY": return "reply";
      case "VERIFICATION_CHANGE": return "verification";
      case "CHAT_MESSAGE": return "chat";
      case "NEW_CONTENT": return "new-content";
      default: return "comment";
    }
  };

  const notificationsList: NotificationData[] = (notificationsData?.notifications ?? []).map((n) => ({
    id: n.id,
    type: mapNotificationType(n.type),
    message: n.message,
    isRead: n.isRead,
    createdAt: new Date(n.createdAt).toLocaleDateString(),
    linkTo: n.linkUrl ?? undefined,
  }));

  return (
    <article className="p-8 max-w-3xl animate-fade-in">
      <header className="mb-6">
        <h1 className="text-headline-lg text-on-surface">Notifications</h1>
        <p className="text-body-md text-on-surface-muted mt-1">
          All notifications are marked as read when you open this page.
        </p>
      </header>

      {notificationsList.length > 0 ? (
        <ul className="rounded-2xl bg-surface border border-border-custom overflow-hidden divide-y divide-border-custom">
          {notificationsList.map((notification) => (
            <li key={notification.id}>
              <NotificationItem notification={notification} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-8 border border-dashed border-border-custom rounded-2xl text-center text-on-surface-muted italic">
          No notifications yet.
        </div>
      )}
    </article>
  );
}
