import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminAuth } from "@/lib/firebase/admin";
import { requireAdminSession } from "@/lib/server/admin-auth";
import { badRequest, internalError, zodDetails } from "@/lib/server/errors";
import { isEmailConfigured, sendEmail } from "@/lib/email/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const emailSchema = z.object({
  to: z.string().trim().min(1).max(254).optional(),
  broadcast: z.boolean().optional().default(false),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  body: z.string().trim().min(1, "Body is required").max(10000),
});

export async function GET() {
  try {
    requireAdminSession();
  } catch (res) {
    if (res instanceof Response) return res;
    return internalError();
  }
  return Response.json({ configured: isEmailConfigured() });
}

/**
 * Send email to one user, or broadcast to all users (individually addressed,
 * capped at 500 recipients per request).
 */
export async function POST(req: NextRequest) {
  try {
    requireAdminSession();
  } catch (res) {
    if (res instanceof Response) return res;
    return internalError();
  }
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }
  const parsed = emailSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid email payload.", zodDetails(parsed.error.issues));
  if (!isEmailConfigured()) {
    return internalError(
      "Email service is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM in .env.local."
    );
  }
  try {
    let recipients: string[] = [];
    if (parsed.data.broadcast) {
      let pageToken: string | undefined;
      do {
        const page = await getAdminAuth().listUsers(200, pageToken);
        for (const u of page.users) if (u.email) recipients.push(u.email);
        pageToken = page.pageToken;
        if (recipients.length >= 500) {
          recipients = recipients.slice(0, 500);
          break;
        }
      } while (pageToken);
    } else {
      if (!parsed.data.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.data.to)) {
        return badRequest("A valid recipient email is required.");
      }
      recipients = [parsed.data.to];
    }
    let sent = 0;
    const failed: string[] = [];
    for (const to of recipients) {
      try {
        await sendEmail({ to, subject: parsed.data.subject, text: parsed.data.body });
        sent += 1;
      } catch {
        failed.push(to);
      }
    }
    return Response.json({ ok: true, sent, failed, total: recipients.length });
  } catch (err) {
    console.error("[POST /api/admin/email]", err);
    return internalError();
  }
}
