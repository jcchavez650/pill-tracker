import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push";

// POST — send a test reminder to the current user's devices.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const es = body?.locale === "es";

  await sendPushToUser(user.id, {
    title: es ? "Recordatorio de prueba" : "Test reminder",
    body: es
      ? "Las notificaciones funcionan en este dispositivo. ✨"
      : "Notifications are working on this device. ✨",
    url: "/today",
    tag: "test",
  });

  return NextResponse.json({ ok: true });
}
