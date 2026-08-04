import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Best-effort: si falla la creación de una notificación no se propaga el
 * error al llamador (workers de BullMQ), ya que el evento que la origina
 * (transcripción/acta lista, o reunión fallida) ya se completó con éxito y
 * no debe reintentarse solo porque la notificación no se pudo guardar.
 */
async function createNotification(args: {
  type: NotificationType;
  title: string;
  message: string;
  userId: string;
  meetingId?: string;
}) {
  try {
    await prisma.notification.create({ data: args });
  } catch (err) {
    console.error("No se pudo crear la notificación:", err);
  }
}

export async function notifyTranscriptReady(meetingId: string) {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) return;

  await createNotification({
    type: NotificationType.TRANSCRIPT_READY,
    title: "Transcripción lista",
    message: `La transcripción de "${meeting.title}" ya está disponible.`,
    userId: meeting.createdById,
    meetingId: meeting.id,
  });
}

export async function notifySummaryReady(meetingId: string) {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) return;

  await createNotification({
    type: NotificationType.SUMMARY_READY,
    title: "Acta generada",
    message: `El acta de "${meeting.title}" ya está lista.`,
    userId: meeting.createdById,
    meetingId: meeting.id,
  });
}

export async function notifyMeetingFailed(meetingId: string) {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) return;

  await createNotification({
    type: NotificationType.MEETING_FAILED,
    title: "No se pudo procesar la reunión",
    message: `Ocurrió un error al procesar "${meeting.title}".`,
    userId: meeting.createdById,
    meetingId: meeting.id,
  });
}

/**
 * Notifica a los miembros existentes de una organización (todos menos el
 * que se acaba de unir) cuando alguien nuevo se une. Las invitaciones en sí
 * las envía Clerk por correo directamente: no hay forma de notificar "te
 * invitaron" dentro de la app porque el invitado no tiene un `User` en
 * nuestra base hasta que acepta y se une.
 */
export async function notifyMemberJoined(newUserId: string) {
  const newUser = await prisma.user.findUnique({ where: { id: newUserId } });
  if (!newUser) return;

  const existingMembers = await prisma.user.findMany({
    where: { organizationId: newUser.organizationId, id: { not: newUser.id } },
  });

  const displayName = newUser.name || newUser.email;

  await Promise.all(
    existingMembers.map((member) =>
      createNotification({
        type: NotificationType.MEMBER_JOINED,
        title: "Nuevo miembro en el equipo",
        message: `${displayName} se unió a la organización.`,
        userId: member.id,
      }),
    ),
  );
}

// Rango Unicode de marcas diacríticas combinantes (acentos, tildes, etc.)
// tras normalizar a NFD. Se construye con fromCharCode en vez de un literal
// de regex con caracteres combinantes para que el código fuente se vea bien
// en cualquier editor/encoding.
const COMBINING_DIACRITICS = new RegExp(
  `[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`,
  "g",
);

function normalizeName(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(COMBINING_DIACRITICS, "");
}

/**
 * Busca, dentro de una organización, al usuario cuyo nombre coincide (nombre
 * completo o solo el primer nombre) con el texto de `assignee` que Gemini
 * extrajo de la transcripción. Es un match best-effort por nombre (no hay
 * relación estructurada entre `Task.assignee` y `User`, ya que Gemini solo
 * conoce el nombre hablado, no el id del usuario): si no hay coincidencia
 * clara, no se notifica a nadie en lugar de arriesgar un falso positivo.
 */
async function findUserByAssigneeName(
  organizationId: string,
  assignee: string,
) {
  const normalizedAssignee = normalizeName(assignee);
  const members = await prisma.user.findMany({ where: { organizationId } });

  return members.find((member) => {
    if (!member.name) return false;
    const normalizedName = normalizeName(member.name);
    if (normalizedName === normalizedAssignee) return true;
    return normalizedName.split(" ")[0] === normalizedAssignee;
  });
}

/**
 * Notifica al usuario de la organización cuyo nombre coincide con el
 * `assignee` de una tarea recién creada. No notifica nada si el `assignee`
 * es null o no hay ningún miembro cuyo nombre coincida.
 */
export async function notifyTaskAssigned(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { summary: { include: { meeting: true } } },
  });
  if (!task || !task.assignee) return;

  const meeting = task.summary.meeting;
  const assignedUser = await findUserByAssigneeName(
    meeting.organizationId,
    task.assignee,
  );
  if (!assignedUser) return;

  await createNotification({
    type: NotificationType.TASK_ASSIGNED,
    title: "Nueva tarea asignada",
    message: `Se te asignó: "${task.description}" (de "${meeting.title}").`,
    userId: assignedUser.id,
    meetingId: meeting.id,
  });
}
