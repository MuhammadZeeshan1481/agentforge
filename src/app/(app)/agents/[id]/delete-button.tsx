"use client";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";

export function DeleteButton({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Delete this agent and all its runs?")) e.preventDefault();
      }}
    >
      <Button type="submit" variant="secondary">
        <Trash2 className="size-4" />
        Delete
      </Button>
    </form>
  );
}
