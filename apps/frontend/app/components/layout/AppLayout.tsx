import { Outlet, useLocation } from "react-router";
import { Header } from "~/components/layout/Header";
import { Footer } from "~/components/layout/Footer";
import { CompactHeader } from "~/components/layout/CompactHeader";
import { ThemeProvider } from "~/providers/ThemeProvider";
import { ToastProvider } from "~/providers/ToastProvider";
import { TRPCProvider } from "~/providers/TRPCProvider";
import { AuthProvider } from "~/providers/AuthProvider";

export default function AppLayout() {
  const location = useLocation();

  // Match edit / details views for compact layout
  const isCompactPage = /^\/(blog|journal|plan)\/(new|[^/]+)$/.test(
    location.pathname,
  );

  return (
    <ThemeProvider>
      <TRPCProvider>
        <AuthProvider>
          <ToastProvider>
            <section className="flex min-h-screen flex-col">
              {isCompactPage ? <CompactHeader /> : <Header />}
              <main className="flex-1">
                <Outlet />
              </main>
              {!isCompactPage && <Footer />}
            </section>
          </ToastProvider>
        </AuthProvider>
      </TRPCProvider>
    </ThemeProvider>
  );
}
