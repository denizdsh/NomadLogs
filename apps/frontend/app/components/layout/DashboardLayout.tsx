import { Link, Outlet, useLocation } from "react-router";
import {
  LayoutDashboard,
  Bell,
  Bookmark,
  Heart,
  Settings,
} from "lucide-react";

import { ROUTES } from "~/constants/routes";

const sidebarLinks = [
  { to: ROUTES.DASHBOARD.INDEX, label: "Dashboard", icon: <LayoutDashboard size={18} />, exact: true },
  { to: ROUTES.DASHBOARD.NOTIFICATIONS, label: "Notifications", icon: <Bell size={18} /> },
  { to: `${ROUTES.EXPLORE}?saved=true&type=all`, label: "Saved Content", icon: <Bookmark size={18} /> },
  { to: `${ROUTES.EXPLORE}?liked=true&type=all`, label: "Liked Content", icon: <Heart size={18} /> },
  { to: ROUTES.DASHBOARD.SETTINGS, label: "Settings", icon: <Settings size={18} /> },
];

export default function DashboardLayout() {
  const location = useLocation();

  const isActive = (to: string, exact?: boolean) => {
    if (exact) return location.pathname === to;
    return location.pathname.startsWith(to);
  };

  return (
    <section className="flex min-h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border-custom bg-surface p-4 flex-shrink-0 hidden lg:block">
        <nav aria-label="Dashboard navigation">
          <ul className="space-y-1">
            {sidebarLinks.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-label-lg transition-all ${
                    isActive(link.to, link.exact)
                      ? "bg-primary/10 text-primary"
                      : "text-on-surface-muted hover:text-on-surface hover:bg-border-custom/30"
                  }`}
                >
                  {link.icon}
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Content */}
      <section className="flex-1 overflow-y-auto">
        <Outlet />
      </section>
    </section>
  );
}
