import { headers } from "next/headers";
import { Suspense } from "react";
import { Button, Card, PageHeader, Select } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { LocalTime } from "@/components/local-time";
import { getContext } from "@/lib/workspace";
import { ApiKeyForm, CopyField, RenameForm } from "./forms";
import { createInvite, deleteInvite, removeMember, revokeApiKey } from "./actions";

async function SettingsContent() {
  const { supabase, workspace, user, isAdmin, role } = await getContext();
  const [{ data: members }, { data: keys }, { data: invites }] = await Promise.all([
    supabase.from("workspace_members").select("user_id, email, role, created_at").eq("workspace_id", workspace.id).order("created_at"),
    isAdmin
      ? supabase.from("api_keys").select("id, name, prefix, created_at, last_used_at, revoked_at").eq("workspace_id", workspace.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("workspace_invites").select("id, token, role, expires_at, accepted_at").eq("workspace_id", workspace.id).is("accepted_at", null).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;

  return (
    <>
      <PageHeader title="Settings" description={`Workspace settings · your role: ${role}`} />
      <div className="space-y-6">
        <Card>
          <h2 className="mb-3 font-semibold">Workspace</h2>
          <RenameForm name={workspace.name} disabled={workspace.owner_id !== user.id} />
          <p className="mt-3 text-sm text-zinc-500">
            Monthly token budget: {workspace.monthly_token_limit.toLocaleString()} tokens. Change it in Supabase
            (workspaces.monthly_token_limit) — it can’t be changed from the app, by design.
          </p>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Members</h2>
          <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            {(members ?? []).map((m) => (
              <li key={m.user_id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  {m.email ?? m.user_id}
                  {m.user_id === user.id && <span className="ml-1 text-zinc-500">(you)</span>}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500">{m.role}</span>
                  {isAdmin && m.role !== "owner" && m.user_id !== user.id && (
                    <form action={removeMember.bind(null, m.user_id)}>
                      <button className="text-xs text-zinc-500 hover:text-red-600">Remove</button>
                    </form>
                  )}
                </span>
              </li>
            ))}
          </ul>

          {isAdmin && (
            <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <p className="mb-2 text-sm font-medium">Invite someone</p>
              <form action={createInvite} className="flex flex-wrap gap-2">
                <Select name="role" defaultValue="editor" className="max-w-40" aria-label="Role">
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </Select>
                <Button type="submit" variant="secondary">Create invite link</Button>
              </form>
              {(invites ?? []).length > 0 && (
                <ul className="mt-3 space-y-3 text-sm">
                  {(invites ?? []).map((inv) => (
                    <li key={inv.id} className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-950">
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span>{inv.role} · expires <LocalTime iso={inv.expires_at} format="short" /></span>
                        <form action={deleteInvite.bind(null, inv.id)}>
                          <button className="hover:text-red-600">Delete</button>
                        </form>
                      </div>
                      <CopyField value={`${origin}/invite/${inv.token}`} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>

        {isAdmin && (
          <Card>
            <h2 className="mb-1 font-semibold">API keys</h2>
            <p className="mb-3 text-sm text-zinc-500">Run agents and workflows from your own code.</p>
            <ApiKeyForm />
            {(keys ?? []).length > 0 && (
              <ul className="mt-4 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
                {(keys ?? []).map((k) => (
                  <li key={k.id} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      <span className="font-medium">{k.name}</span>
                      <code className="ml-2 text-xs text-zinc-500">{k.prefix}…</code>
                    </span>
                    <span className="flex items-center gap-3 text-xs text-zinc-500">
                      {k.revoked_at ? (
                        <span className="text-red-600">revoked</span>
                      ) : (
                        <>
                          <span>{k.last_used_at ? <>used <LocalTime iso={k.last_used_at} format="short" /></> : "never used"}</span>
                          <form action={revokeApiKey.bind(null, k.id)}>
                            <button className="hover:text-red-600">Revoke</button>
                          </form>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <pre className="mt-4 overflow-x-auto rounded bg-zinc-50 p-3 text-xs dark:bg-zinc-950">{`# Start an agent run
curl -X POST ${origin}/api/v1/agents/<AGENT_ID>/runs \\
  -H "Authorization: Bearer af_..." -H "content-type: application/json" \\
  -d '{"input":"Summarize https://example.com"}'

# Poll the result
curl ${origin}/api/v1/runs/<RUN_ID> -H "Authorization: Bearer af_..."

# Workflows: POST /api/v1/workflows/<ID>/runs, GET /api/v1/workflow-runs/<ID>`}</pre>
          </Card>
        )}
      </div>
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}
