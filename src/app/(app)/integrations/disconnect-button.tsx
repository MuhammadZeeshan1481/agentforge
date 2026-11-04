"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/dialog";
import { disconnect } from "./actions";

export function DisconnectButton({ provider, name }: { provider: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <ConfirmDialog
      title={`Disconnect ${name}?`}
      description="Agents using these tools will fail until you reconnect."
      destructive
      confirmLabel="Disconnect"
      onConfirm={() => start(async () => { await disconnect(provider); toast.success(`${name} disconnected`); })}
      trigger={<Button variant="outline" loading={pending}>Disconnect</Button>}
    />
  );
}
