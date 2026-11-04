import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckCircle2, ExternalLink, KeyRound, Mail, MessageSquare, Plug } from "lucide-react";
import { Badge, Button, Card, CardContent, PageHeader, Section } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { LocalTime } from "@/components/local-time";
import { UrlToastIntegrations } from "./url-toast";
import { getContext } from "@/lib/workspace";
import { emailEnabled } from "@/lib/email";
import { providerConfigured } from "@/lib/integrations/oauth";
import { PROVIDERS, type ProviderId } from "@/lib/integrations/providers";
import { TOOL_CATALOG, type ToolId } from "@/lib/tools/catalog";
import { DisconnectButton } from "./disconnect-button";

export const metadata: Metadata = { title: "Integrations" };

const logos: Record<ProviderId, React.ReactNode> = {
  google: (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  ),
  notion: (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden><rect x="3" y="3" width="18" height="18" rx="3" className="fill-foreground" /><path d="M8 7.5v9M8 7.5l7 9M15 7.5v9" className="stroke-background" strokeWidth="1.8" fill="none" /></svg>
  ),
};

async function IntegrationsContent() {
  const { supabase, workspace, isAdmin } = await getContext();
  const { data: conns } = await supabase.from("connections").select("provider, account_label, updated_at").eq("workspace_id", workspace.id);
  const byProvider = new Map((conns ?? []).map((c) => [c.provider, c]));
  const email = emailEnabled();

  return (
    <>
      <Suspense><UrlToastIntegrations /></Suspense>
      <PageHeader title="Integrations" description="Connect accounts so agents can act in your tools. Tokens are encrypted (AES-256-GCM) and never shown to the browser." />
      <div className="grid gap-4 lg:grid-cols-2">
        {(Object.keys(PROVIDERS) as ProviderId[]).map((p) => {
          const meta = PROVIDERS[p];
          const conn = byProvider.get(p);
          const configured = providerConfigured(p);
          return (
            <Card key={p} className="flex flex-col">
              <CardContent className="flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-12 items-center justify-center rounded-xl border bg-background">{logos[p]}</span>
                    <div>
                      <p className="font-semibold">{meta.name}</p>
                      <p className="text-sm text-muted-foreground">{meta.description}</p>
                    </div>
                  </div>
                  {conn ? <Badge variant="success"><CheckCircle2 /> Connected</Badge> : <Badge variant="secondary">Not connected</Badge>}
                </div>
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {meta.tools.map((t) => <Badge key={t} variant="outline">{TOOL_CATALOG[t as ToolId].label}</Badge>)}
                </div>
                {conn && <p className="mt-4 text-sm text-muted-foreground">Signed in as <b className="text-foreground">{conn.account_label}</b> · <LocalTime iso={conn.updated_at} format="short" /></p>}
                {!configured && (
                  <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                    <KeyRound className="mt-0.5 size-3.5 shrink-0" />
                    <span>Server not configured yet. Set {meta.envVars.map((v, i) => <span key={v}>{i > 0 && " and "}<code className="text-foreground">{v}</code></span>)} in Vercel, then redeploy. See the README for the 5-minute setup.</span>
                  </p>
                )}
              </CardContent>
              <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
                {!isAdmin ? (
                  <span className="text-xs text-muted-foreground">Only admins can manage integrations</span>
                ) : conn ? (
                  <>
                    <DisconnectButton provider={p} name={meta.name} />
                    <Button variant="outline" asChild><a href={`/api/integrations/${p}/start`}>Reconnect</a></Button>
                  </>
                ) : (
                  <Button asChild={configured} disabled={!configured}>
                    {configured ? <a href={`/api/integrations/${p}/start`}><Plug /> Connect {meta.name}</a> : <span><Plug /> Connect {meta.name}</span>}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Section title="Built-in channels" description="These don’t need an account connection.">
        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardContent className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Mail className="size-5" /></span>
            <div className="flex-1">
              <p className="flex items-center justify-between font-medium">Email (Resend) {email ? <Badge variant="success">Ready</Badge> : <Badge variant="secondary">Not configured</Badge>}</p>
              <p className="mt-1 text-sm text-muted-foreground">Powers the “Send email” tool, invite emails and approval notifications. Set <code>RESEND_API_KEY</code> and <code>EMAIL_FROM</code>.</p>
            </div>
          </CardContent></Card>
          <Card><CardContent className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><MessageSquare className="size-5" /></span>
            <div className="flex-1">
              <p className="flex items-center justify-between font-medium">Slack <Badge variant="success">Per agent</Badge></p>
              <p className="mt-1 text-sm text-muted-foreground">Add a Slack incoming-webhook URL in an agent’s configuration to use “Post to Slack”.</p>
              <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">How to create a webhook <ExternalLink className="size-3" /></a>
            </div>
          </CardContent></Card>
        </div>
      </Section>
    </>
  );
}

export default function IntegrationsPage() {
  return <Suspense fallback={<PageSkeleton />}><IntegrationsContent /></Suspense>;
}
