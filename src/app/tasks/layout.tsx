import AppHeader from "@/components/layout/AppHeader";

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="flex-1 flex flex-col h-[calc(100vh-60px)]">{children}</main>
    </>
  );
}
