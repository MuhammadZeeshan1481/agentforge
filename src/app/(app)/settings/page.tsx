import type { Metadata } from "next";
import { Suspense } from "react";
import { Code2, KeyRound, Settings2, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { LocalTime } from "@/components/local-time";
import { getContext } from "@/lib/workspace";
import { appOrigin } from "@/lib/origin";
import { initials } from "@/lib/utils";
import { ApiKeyForm, CopyField, DangerButton, InviteForm, RenameForm } from "./forms";
import { deleteInvite, removeMember, revokeApiKey } from "./actions";

export const metadata: Metadata = { title: "Settings" };

async function SettingsContent() {
  const { supabase, workspace, user, isAdmin, role } = await getContext();
  const [{ data: members }, { data: keys }, { data: invites }] = await Promise.all([
    supabase.from("workspace_members").select("user_id, email, role, created_at").eq("workspace_id", workspace.id).order("created_at"),
    isAdmin ? supabase.from("api_keys").select("id, name, prefix, created_at, last_used_at, revoked_at").eq("workspace_id", workspace.id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    isAdmin ? supabase.from("workspace_invites").select("id, token, role, email, email_sent_at, expires_at").eq("workspace_id", workspace.id).is("accepted_at", null).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const origin = await appOrigin();

  return (
    <>
      <PageHeader title="Workspace settings" description={<>Manage {workspace.name} · your role: <Badge variant="secondary" className="capitalize">{role}</Badge></>} />
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general"><Settings2 className="size-3.5" /> General</TabsTrigger>
          <TabsTrigger value="members" id="members"><Users className="size-3.5" /> Members</TabsTrigger>
          {isAdmin && <TabsTrigger value="api"><Code2 className="size-3.5" /> API keys</TabsTrigger>}
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>General</CardTitle></CardHeader>
            <CardContent><RenameForm name={workspace.name} disabled={workspace.owner_id !== user.id} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Usage limits</CardTitle><CardDescription>Protects you from runaway costs.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
              <div><p className="text-muted-foreground">Monthly token budget</p><p className="mt-1 text-lg font-semibold tabular-nums">{workspace.monthly_token_limit.toLocaleString()}</p></div>
              <div><p className="text-muted-foreground">Runs per user</p><p className="mt-1 text-lg font-semibold">30 / minute</p></div>
              <div><p className="text-muted-foreground">API & webhooks</p><p className="mt-1 text-lg font-semibold">120 · 60 / minute</p></div>
              <p className="text-xs text-muted-foreground sm:col-span-3">The token budget can only be changed in the database (<code>workspaces.monthly_token_limit</code>) — by design, not from the app.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-6">
          {isAdmin && (
            <Card>
              <CardHeader><CardTitle>Invite teammates</CardTitle><CardDescription>Invites expire after 7 days and can be used once.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <InviteForm />
                {(invites ?? []).length > 0 && (
                  <ul className="space-y-3">
                    {(invites ?? []).map((inv) => (
                      <li key={inv.id} className="rounded-lg border bg-muted/30 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="flex items-center gap-2">
                            <span className="font-medium">{inv.email ?? "Shareable link"}</span>
                            <Badge variant="outline" className="capitalize">{inv.role}</Badge>
                            {inv.email_sent_at && <Badge variant="success">emailed</Badge>}
                          </span>
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            expires <LocalTime iso={inv.expires_at} format="short" />
                            <DangerButton label="Revoke" title="Revoke invite?" description="The link will stop working." onConfirm={deleteInvite.bind(null, inv.id)} icon={false} />
                          </span>
                        </div>
                        <CopyField value={`${origin}/invite/${inv.token}`} />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle>Members ({members?.length ?? 0})</CardTitle></CardHeader>
            <CardContent className="pt-2">
              <ul className="divide-y">
                {(members ?? []).map((m) => (
                  <li key={m.user_id} className="flex items-center gap-3 py-3">
                    <Avatar><AvatarFallback>{initials(m.email ?? "?")}</AvatarFallback></Avatar>
                    <span className="min-w-0 flex-1 truncate text-sm">{m.email ?? m.user_id}{m.user_id === user.id && <span className="ml-1 text-muted-foreground">(you)</span>}</span>
                    <Badge variant={m.role === "owner" ? "default" : "secondary"} className="capitalize">{m.role}</Badge>
                    {isAdmin && m.role !== "owner" && m.user_id !== user.id && (
                      <DangerButton label="Remove" title="Remove member?" description={`${m.email} will lose access to this workspace.`} onConfirm={removeMember.bind(null, m.user_id)} icon={false} />
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="api" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>API keys</CardTitle><CardDescription>Run agents and workflows from your own code. Keys are stored as SHA-256 hashes.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <ApiKeyForm />
                {(keys ?? []).length > 0 && (
                  <ul className="divide-y rounded-lg border">
                    {(keys ?? []).map((k) => (
                      <li key={k.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                        <KeyRound className="size-4 text-muted-foreground" />
                        <span className="font-medium">{k.name}</span>
                        <code className="text-xs text-muted-foreground">{k.prefix}…</code>
                        <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                          {k.revoked_at ? <Badge variant="destructive">revoked</Badge> : (
                            <>
                              <span>{k.last_used_at ? <>used <LocalTime iso={k.last_used_at} format="short" /></> : "never used"}</span>
                              <DangerButton label="Revoke" title="Revoke API key?" description="Requests using this key will fail immediately." onConfirm={revokeApiKey.bind(null, k.id)} icon={false} />
                            </>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Quick start</CardTitle></CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed">{`# Start an agent run → 202 { "run_id": "…" }
curl -X POST ${origin}/api/v1/agents/<AGENT_ID>/runs \\
  -H "Authorization: Bearer af_..." -H "content-type: application/json" \\
  -d '{"input":"Summarize https://example.com"}'

# Poll status, output, usage and steps
curl ${origin}/api/v1/runs/<RUN_ID> -H "Authorization: Bearer af_..."

# Workflows
POST ${origin}/api/v1/workflows/<WORKFLOW_ID>/runs
GET  ${origin}/api/v1/workflow-runs/<WORKFLOW_RUN_ID>`}</pre>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}

export default function SettingsPage() {
  return <Suspense fallback={<PageSkeleton />}><SettingsContent /></Suspense>;
}
