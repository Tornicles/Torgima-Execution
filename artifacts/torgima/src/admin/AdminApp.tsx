import { useEffect, useState } from "react";
import { Route, Switch, useLocation } from "wouter";
import { adminLogout, adminMe } from "@/admin/api/adminClient";
import { AdminSidebar } from "@/admin/components/AdminSidebar";
import AdminLoginPage from "@/admin/pages/AdminLogin";
import AdminDashboardPage from "@/admin/pages/AdminDashboard";
import AdminUsersPage from "@/admin/pages/AdminUsers";
import AdminUserDetailPage from "@/admin/pages/AdminUserDetail";
import AdminSystemHealthPage from "@/admin/pages/AdminSystemHealth";
import AdminAnalyticsPage from "@/admin/pages/AdminAnalytics";
import AdminBhudhiPage from "@/admin/pages/AdminBhudhi";
import AdminDeadLetterPage from "@/admin/pages/AdminDeadLetter";
import AdminAuditPage from "@/admin/pages/AdminAudit";

function AdminShell({ email, onLogout }: { email: string; onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-[#0B0F1A] text-slate-100 flex">
      <AdminSidebar email={email} onLogout={onLogout} />
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        <Switch>
          <Route path="/admin/dashboard" component={AdminDashboardPage} />
          <Route path="/admin/users/:userId" component={AdminUserDetailPage} />
          <Route path="/admin/users" component={AdminUsersPage} />
          <Route path="/admin/health" component={AdminSystemHealthPage} />
          <Route path="/admin/analytics" component={AdminAnalyticsPage} />
          <Route path="/admin/bhudhi" component={AdminBhudhiPage} />
          <Route path="/admin/dead-letter" component={AdminDeadLetterPage} />
          <Route path="/admin/audit" component={AdminAuditPage} />
          <Route>
            <AdminDashboardPage />
          </Route>
        </Switch>
      </main>
    </div>
  );
}

export default function AdminApp() {
  const [location, setLocation] = useLocation();
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (location === "/admin/login") {
      setChecking(false);
      return;
    }
    void adminMe()
      .then((me) => setEmail(me.email))
      .catch(() => {
        setEmail(null);
        setLocation("/admin/login");
      })
      .finally(() => setChecking(false));
  }, [location, setLocation]);

  if (location === "/admin/login") {
    return <AdminLoginPage />;
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0B0F1A] flex items-center justify-center text-slate-400">
        Verifying admin session…
      </div>
    );
  }

  if (!email) return null;

  async function logout() {
    await adminLogout().catch(() => null);
    setEmail(null);
    setLocation("/admin/login");
  }

  return <AdminShell email={email} onLogout={() => void logout()} />;
}
