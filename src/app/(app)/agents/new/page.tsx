import { Card, PageHeader } from "@/components/ui";
import { AgentForm } from "../agent-form";
import { createAgent } from "../actions";

export default function NewAgentPage() {
  return (
    <>
      <PageHeader title="New agent" />
      <Card>
        <AgentForm action={createAgent} submitLabel="Create agent" />
      </Card>
    </>
  );
}
