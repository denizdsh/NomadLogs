import { useState } from "react";
import { Link, useLocation } from "react-router";
import { Bell, Compass, Newspaper, PenTool, Menu, X } from "lucide-react";
import { useScrollPosition } from "~/hooks/useScrollPosition";
import { ThemeToggle } from "~/components/ui/ThemeToggle";
import { Logo } from "~/components/ui/Logo";
import { Tooltip } from "~/components/ui/Tooltip";
import { Avatar } from "~/components/ui/Avatar";
import { Button } from "~/components/ui/Button";
import {
  NotificationsPopover,
  type NotificationData,
} from "~/components/ui/NotificationsPopover";
import { ROUTES } from "~/constants/routes";

import { useAuth } from "~/providers/AuthProvider";
import { trpc } from "~/utils/trpc";

export function Header() {
  const scrollY = useScrollPosition();
  const location = useLocation();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const isAuthenticated = !!user;

  const utils = trpc.useUtils();
  const { data: unreadData } = trpc.notification.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const unreadCount = unreadData?.count ?? 0;

  const { data: notificationsData } = trpc.notification.list.useQuery(
    { limit: 5 },
    { enabled: isAuthenticated }
  );

  const markAllReadMutation = trpc.notification.markAllRead.useMutation();

  const handleToggleNotifications = async () => {
    const nextState = !isNotificationsOpen;
    setIsNotificationsOpen(nextState);
    if (nextState && unreadCount > 0) {
      await markAllReadMutation.mutateAsync();
      utils.notification.unreadCount.invalidate();
      utils.notification.list.invalidate();
    }
  };

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

  const isActiveRoute = (path: string) => location.pathname === path;

  return (
    <header
      className={`sticky top-0 z-30 bg-neutral/80 backdrop-blur-lg border-b transition-all duration-300 ${
        scrollY > 0 ? "border-border-custom shadow-sm" : "border-transparent"
      }`}
    >
      <nav className="mx-auto flex items-center justify-between px-6 py-3">
        {/* Left section */}
        <section className="flex items-center gap-8">
          {/* Logo */}
          <Link
            to={ROUTES.HOME}
            aria-label="NomadLogs Home"
          >
            <Logo size="md" />
          </Link>

          {/* Nav links - Desktop */}
          <ul className="hidden md:flex items-center gap-1">
            {isAuthenticated && (
              <li>
                <Link
                  to={ROUTES.FEED}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-label-lg transition-all ${
                    isActiveRoute(ROUTES.FEED)
                      ? "text-primary bg-primary/10"
                      : "text-on-surface-muted hover:text-on-surface hover:bg-border-custom/50"
                  }`}
                >
                  <Newspaper size={16} />
                  Feed
                </Link>
              </li>
            )}
            <li>
              <Link
                to={ROUTES.EXPLORE}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-label-lg transition-all ${
                  isActiveRoute(ROUTES.EXPLORE)
                    ? "text-primary bg-primary/10"
                    : "text-on-surface-muted hover:text-on-surface hover:bg-border-custom/50"
                }`}
              >
                <Compass size={16} />
                Explore Travels & Plans
              </Link>
            </li>
          </ul>
        </section>

        {/* Right section */}
        <section className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              {/* Editor Studio */}
              <Link
                to={ROUTES.STUDIO}
                className={`hidden md:flex items-center gap-2 px-3.5 py-2 rounded-lg text-label-lg transition-all ${
                  isActiveRoute(ROUTES.STUDIO)
                    ? "text-primary bg-primary/10"
                    : "text-on-surface-muted hover:text-on-surface hover:bg-border-custom/50"
                }`}
              >
                <PenTool size={16} />
                Editor Studio
              </Link>

              {/* Notifications */}
              <nav className="relative" aria-label="Notifications">
                <Tooltip content="Notifications" position="bottom">
                  <button
                    type="button"
                    onClick={handleToggleNotifications}
                    className="relative p-2 rounded-lg text-on-surface-muted hover:text-on-surface hover:bg-border-custom/50 transition-all"
                    aria-label="Notifications"
                    aria-expanded={isNotificationsOpen}
                  >
                    <Bell size={20} />
                    {unreadCount > 0 && (
                      <span className="notification-dot">{unreadCount}</span>
                    )}
                  </button>
                </Tooltip>

                <NotificationsPopover
                  notifications={notificationsList}
                  isOpen={isNotificationsOpen}
                  onClose={() => setIsNotificationsOpen(false)}
                />
              </nav>

              {/* User Avatar */}
              <Link
                to={ROUTES.DASHBOARD.INDEX}
                className="hidden md:flex items-center hover:opacity-80 transition-opacity"
                aria-label="Dashboard"
              >
                <Avatar
                  src={user?.avatarUrl}
                  alt={user?.name || "User"}
                  size="sm"
                />
              </Link>
            </>
          ) : (
            <Link to={ROUTES.LOGIN} className="hidden md:block">
              <Button variant="primary" size="sm">
                Login / Sign up
              </Button>
            </Link>
          )}

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-on-surface-muted hover:text-on-surface hover:bg-border-custom/50 transition-all"
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </section>
      </nav>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <nav className="md:hidden border-t border-border-custom bg-neutral animate-slide-down">
          <ul className="px-6 py-4 space-y-1">
            {isAuthenticated && (
              <li>
                <Link
                  to={ROUTES.FEED}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-body-md text-on-surface hover:bg-border-custom/50 transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Newspaper size={18} />
                  Feed
                </Link>
              </li>
            )}
            <li>
              <Link
                to={ROUTES.EXPLORE}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-body-md text-on-surface hover:bg-border-custom/50 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Compass size={18} />
                Explore Travels & Plans
              </Link>
            </li>
            {isAuthenticated && (
              <>
                <li>
                  <Link
                    to={ROUTES.STUDIO}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-body-md text-on-surface hover:bg-border-custom/50 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <PenTool size={18} />
                    Editor Studio
                  </Link>
                </li>
                <li>
                  <Link
                    to={ROUTES.DASHBOARD.INDEX}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-body-md text-on-surface hover:bg-border-custom/50 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                </li>
              </>
            )}
            {!isAuthenticated && (
              <li className="pt-2">
                <Link to={ROUTES.LOGIN} onClick={() => setIsMobileMenuOpen(false)}>
                  <Button variant="primary" className="w-full">
                    Login / Sign up
                  </Button>
                </Link>
              </li>
            )}
          </ul>
        </nav>
      )}
    </header>
  );
}
