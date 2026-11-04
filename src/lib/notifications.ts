import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailEnabled, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/origin";

/** Email the workspace's owners/admins/editors that a workflow run needs approval. */
export async function notifyApprovalNeeded(workflowRunId: string) {
  if (!emailEnabled()) return;
  const db = createAdminClient();
  const { data: wr } = await db
    .from("workflow_runs")
    .select("id, workspace_id, approval_message, workflows(name)")
    .eq("id", workflowRunId)
    .single();
  if (!wr) return;
  const { data: members } = await db
    .from("workspace_members")
    .select("email")
    .eq("workspace_id", wr.workspace_id)
    .in("role", ["owner", "admin", "editor"]);
  const to = (members ?? []).map((m) => m.email).filter(Boolean) as string[];
  if (!to.length) return;
  const name = (wr.workflows as unknown as { name: string } | null)?.name ?? "A workflow";
  await sendEmail({
    to,
    subject: `Approval needed: ${name}`,
    html: emailLayout({
      title: `“${name}” is waiting for your approval`,
      body: escapeHtml(wr.approval_message ?? "Review the output and approve or reject.").slice(0, 2000).replace(/\n/g, "<br/>"),
      cta: { label: "Review now", url: `${siteUrl()}/workflow-runs/${wr.id}` },
    }),
  });
}
