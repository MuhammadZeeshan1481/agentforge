"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/dialog";

export function WebhookBox({ url, onRotate }: { url: string; onRotate?: () => Promise<void> }) {
  const [pending, start] = useTransition();
  const curl = `curl -X POST '${url}' \\\n  -H 'content-type: application/json' \\\n  -d '{"text":"hello"}'`;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2">
        <code className="min-w-0 flex-1 truncate px-1 text-xs">{url}</code>
        <Button size="sm" variant="outline" type="button" onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Webhook URL copied"))}><Copy /> Copy</Button>
      </div>
      <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs">{curl}</pre>
      {onRotate && (
        <ConfirmDialog
          title="Rotate webhook token?"
          description="The current URL stops working immediately. Update any app that calls it."
          confirmLabel="Rotate"
          onConfirm={() => start(async () => { await onRotate(); toast.success("Token rotated"); })}
          trigger={<Button size="sm" variant="ghost" loading={pending}><RefreshCw /> Rotate token</Button>}
        />
      )}
    </div>
  );
}
