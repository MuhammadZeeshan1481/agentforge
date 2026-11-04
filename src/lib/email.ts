import "server-only";
import { Resend } from "resend";

export const emailEnabled = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

/** Sends via Resend when RESEND_API_KEY + EMAIL_FROM are set; otherwise a no-op. */
export async function sendEmail(opts: { to: string | string[]; subject: string; html: string; text?: string; replyTo?: string }) {
  if (!emailEnabled()) return { ok: false as const, skipped: true, error: "Email is not configured (RESEND_API_KEY / EMAIL_FROM)" };
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    replyTo: opts.replyTo,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, id: data?.id };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Minimal branded email layout. */
export function emailLayout({ title, body, cta }: { title: string; body: string; cta?: { label: string; url: string } }) {
  return `<!doctype html><html><body style="margin:0;background:#f6f6f9;font-family:Inter,Segoe UI,Arial,sans-serif;color:#18181b">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #e7e7ee;border-radius:14px;padding:32px">
  <tr><td style="font-size:15px;font-weight:600;color:#5b4cf0">AgentForge</td></tr>
  <tr><td style="padding-top:20px;font-size:20px;font-weight:600">${esc(title)}</td></tr>
  <tr><td style="padding-top:12px;font-size:14px;line-height:1.6;color:#52525b">${body}</td></tr>
  ${cta ? `<tr><td style="padding-top:24px"><a href="${esc(cta.url)}" style="display:inline-block;background:#5b4cf0;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:500">${esc(cta.label)}</a></td></tr>` : ""}
  </table><p style="font-size:12px;color:#a1a1aa;margin-top:16px">You’re receiving this because of activity in your AgentForge workspace.</p>
  </td></tr></table></body></html>`;
}
export { esc as escapeHtml };
