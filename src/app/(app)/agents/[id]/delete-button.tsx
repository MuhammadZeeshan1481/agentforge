"use client";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/dialog";

export function DeleteButton({ action, what = "agent" }: { action: () => Promise<void>; what?: string }) {
  const [pending, start] = useTransition();
  return (
    <ConfirmDialog
      title={`Delete this ${what}?`}
      description={`This permanently deletes the ${what} and its run history.`}
      confirmLabel="Delete"
      destructive
      onConfirm={() => start(() => action())}
      trigger={<Button variant="outline" loading={pending}><Trash2 /> Delete</Button>}
    />
  );
}
