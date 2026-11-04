import { Suspense } from "react";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { LocalTime } from "@/components/local-time";
import { getContext } from "@/lib/workspace";
import { DocForm } from "./doc-form";
import { deleteDocument } from "./actions";

async function KnowledgeContent() {
  const { supabase, workspace, canEdit } = await getContext();
  const { data: docs } = await supabase
    .from("knowledge_docs")
    .select("id, title, created_at, knowledge_chunks(count)")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="Knowledge base"
        description="Documents your agents can search with the “Knowledge base search” tool (full-text search)."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {canEdit && (
          <Card>
            <h2 className="mb-3 font-semibold">Add a document</h2>
            <DocForm />
          </Card>
        )}
        <div>
          <h2 className="mb-3 font-semibold">Documents ({docs?.length ?? 0})</h2>
          {!docs?.length ? (
            <EmptyState title="No documents yet">Add FAQs, policies or product docs.</EmptyState>
          ) : (
            <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white text-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span>
                    <span className="font-medium">{d.title}</span>
                    <span className="ml-2 text-xs text-zinc-500">
                      {(d.knowledge_chunks as unknown as { count: number }[])[0]?.count ?? 0} chunks ·{" "}
                      <LocalTime iso={d.created_at} format="short" />
                    </span>
                  </span>
                  {canEdit && (
                    <form action={deleteDocument.bind(null, d.id)}>
                      <button className="text-xs text-zinc-500 hover:text-red-600">Delete</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

export default function KnowledgePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <KnowledgeContent />
    </Suspense>
  );
}
