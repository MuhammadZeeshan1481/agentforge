import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Check, FilePlus2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, PageHeader } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { getContext } from "@/lib/workspace";
import { emailEnabled } from "@/lib/email";
import { AGENT_TEMPLATES, getTemplate } from "@/lib/templates";
import { AgentForm } from "../agent-form";
import { createAgent } from "../actions";

export const metadata: Metadata = { title: "New agent" };

async function NewAgentContent({ searchParams }: PageProps<"/agents/new">) {
  const { template: t } = await searchParams;
  const template = getTemplate(typeof t === "string" ? t : null);
  const { supabase, workspace } = await getContext();
  const { data: conns } = await supabase.from("connections").select("provider").eq("workspace_id", workspace.id);
  const tile = (active: boolean) =>
    cn("relative flex h-full flex-col rounded-xl border bg-card p-4 text-sm transition hover:border-primary/50", active && "border-primary ring-2 ring-primary/20");

  return (
    <>
      <PageHeader title="New agent" description="Start from a template or from scratch." back={{ href: "/agents", label: "Agents" }} />
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/agents/new" className={tile(!template)}>
          {!template && <Check className="absolute top-3 right-3 size-4 text-primary" />}
          <FilePlus2 className="mb-2 size-5 text-muted-foreground" />
          <p className="font-medium">Blank agent</p>
          <p className="mt-1 text-muted-foreground">Write your own instructions.</p>
        </Link>
        {AGENT_TEMPLATES.map((tpl) => (
          <Link key={tpl.id} href={`/agents/new?template=${tpl.id}`} className={tile(template?.id === tpl.id)}>
            {template?.id === tpl.id && <Check className="absolute top-3 right-3 size-4 text-primary" />}
            <Sparkles className="mb-2 size-5 text-primary" />
            <p className="font-medium">{tpl.name}</p>
            <p className="mt-1 text-muted-foreground">{tpl.description}</p>
          </Link>
        ))}
      </div>
      <Card>
        <CardContent className="p-6">
          {template && (
            <p className="mb-6 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              <b className="text-foreground">Try it with:</b> {template.example_input}
            </p>
          )}
          <AgentForm
            key={template?.id ?? "blank"}
            agent={template ? { ...template, id: undefined } : undefined}
            action={createAgent}
            submitLabel="Create agent"
            connected={(conns ?? []).map((c) => c.provider)}
            emailReady={emailEnabled()}
          />
        </CardContent>
      </Card>
    </>
  );
}

export default function NewAgentPage(props: PageProps<"/agents/new">) {
  return <Suspense fallback={<PageSkeleton />}><NewAgentContent {...props} /></Suspense>;
}
