import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface UpdateNotificationBody {
  read?: boolean;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { read } = (await req.json()) as UpdateNotificationBody;
  if (typeof read !== "boolean") {
    return NextResponse.json(
      { error: "El campo 'read' es requerido y debe ser booleano" },
      { status: 400 },
    );
  }

  const notification = await prisma.notification.findFirst({
    where: { id, user: { clerkUserId: userId } },
  });

  if (!notification) {
    return NextResponse.json({ error: "Notificación no encontrada" }, { status: 404 });
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { read },
  });

  return NextResponse.json(updated);
}
