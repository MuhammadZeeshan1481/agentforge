"use client";
import { useTransition } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/dialog";
import { deleteDocument, reindexDocument } from "./actions";

export function DocActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex justify-end gap-1">
      <Button size="icon-sm" variant="ghost" title="Re-index" aria-label="Re-index" loading={pending} onClick={() => start(() => reindexDocument(id))}>{!pending && <RefreshCw />}</Button>
      <ConfirmDialog
        title="Delete document?"
        description="Agents will no longer find it."
        destructive
        confirmLabel="Delete"
        onConfirm={() => start(() => deleteDocument(id))}
        trigger={<Button size="icon-sm" variant="ghost" aria-label="Delete"><Trash2 /></Button>}
      />
    </div>
  );
}
