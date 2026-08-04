import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface UpdateTaskBody {
  completed?: boolean;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return NextResponse.json(
      { error: "No autenticado o sin organización activa" },
      { status: 401 },
    );
  }

  const { completed } = (await req.json()) as UpdateTaskBody;

  if (typeof completed !== "boolean") {
    return NextResponse.json(
      { error: "El campo 'completed' es requerido y debe ser booleano" },
      { status: 400 },
    );
  }

  const task = await prisma.task.findFirst({
    where: {
      id,
      summary: { meeting: { organization: { clerkOrgId: orgId } } },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
  }

  const updated = await prisma.task.update({
    where: { id },
    data: { completed },
  });

  return NextResponse.json(updated);
}
