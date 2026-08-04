import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyMemberJoined } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error("Clerk webhook verification failed:", err);
    return new Response("Webhook verification failed", { status: 400 });
  }

  switch (evt.type) {
    case "organization.created":
    case "organization.updated": {
      const { id, name } = evt.data;
      await prisma.organization.upsert({
        where: { clerkOrgId: id },
        update: { name },
        create: { clerkOrgId: id, name },
      });
      break;
    }

    case "organizationMembership.created": {
      const { organization, public_user_data } = evt.data;

      const org = await prisma.organization.upsert({
        where: { clerkOrgId: organization.id },
        update: { name: organization.name },
        create: { clerkOrgId: organization.id, name: organization.name },
      });

      const name = [public_user_data.first_name, public_user_data.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

      const user = await prisma.user.upsert({
        where: { clerkUserId: public_user_data.user_id },
        update: {
          email: public_user_data.identifier,
          name: name || null,
          organizationId: org.id,
        },
        create: {
          clerkUserId: public_user_data.user_id,
          email: public_user_data.identifier,
          name: name || null,
          organizationId: org.id,
        },
      });

      await notifyMemberJoined(user.id);
      break;
    }

    default:
      break;
  }

  return new Response("OK", { status: 200 });
}
