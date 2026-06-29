import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, FileText, Users, ShieldCheck, LogOut, Plus, Inbox, Plug } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/routes/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FeedbackButton } from "@/components/feedback-button";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  const nav: Array<{ to: string; label: string; icon: typeof LayoutDashboard }> = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/proposals", label: "Proposals", icon: FileText },
    { to: "/clients", label: "Clients", icon: Users },
    { to: "/integrations", label: "Integrations", icon: Plug },
    ...(isAdmin ? [
      { to: "/admin", label: "Admin", icon: ShieldCheck },
      { to: "/admin/requests", label: "Requests", icon: Inbox },
    ] : []),
  ];

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (user?.user_metadata?.full_name as string | undefined)?.split(" ").map((p) => p[0]).slice(0, 2).join("") ||
    user?.email?.[0]?.toUpperCase() || "U";

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="p-6"><Logo light /></div>

        <div className="px-4">
          <Button asChild className="w-full justify-start gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/proposals/new"><Plus className="h-4 w-4" /> New proposal</Link>
          </Button>
        </div>

        <nav className="mt-6 px-3 space-y-1">
          {nav.map((item) => {
            const active = loc.pathname === item.to || loc.pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-9 w-9 rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold uppercase">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{user?.user_metadata?.full_name || user?.email}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">{isAdmin ? "Admin" : "Member"}</p>
            </div>
            <button onClick={signOut} className="text-sidebar-foreground/60 hover:text-sidebar-foreground" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <Logo />
          <button onClick={signOut} className="text-muted-foreground"><LogOut className="h-4 w-4" /></button>
        </div>
        {children}
      </main>
      <FeedbackButton />
    </div>
  );
}
