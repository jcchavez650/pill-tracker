import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  return (
    <AppShell
      selfId={user.id}
      userName={user.name}
      isCaregiver={user.role === "CAREGIVER"}
      timezone={user.timezone}
    >
      {children}
    </AppShell>
  );
}
