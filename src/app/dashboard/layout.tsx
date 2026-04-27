import AppHeader from "@/components/layout/AppHeader";
import AuthGuard from "@/components/AuthGuard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppHeader />
      <main className="flex-1">{children}</main>
    </AuthGuard>
  );
}
