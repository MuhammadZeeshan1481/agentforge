import type { Metadata } from "next";
import { Suspense } from "react";
import { BookOpen, FileText, FileType2, Type } from "lucide-react";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, DataTable, EmptyState, PageHeader } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { LocalTime } from "@/components/local-time";
import { getContext } from "@/lib/workspace";
import { DocForm } from "./doc-form";
import { DocActions } from "./doc-actions";
import { SearchBox } from "./search-box";

export const metadata: Metadata = { title: "Knowledge base" };
const sourceIcon = { pdf: FileType2, file: FileText, text: Type };

async function KnowledgeContent() {
  const { supabase, workspace, canEdit } = await getContext();
  const { data: docs } = await supabase
    .from("knowledge_docs")
    .select("id, title, source, file_name, status, error, created_at, knowledge_chunks(count)")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader title="Knowledge base" description="Documents agents can search with the “Knowledge base” tool — hybrid semantic + keyword retrieval." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          {!docs?.length ? (
            <EmptyState icon={<BookOpen />} title="No documents yet" description="Upload PDFs or paste FAQs, policies and product docs. They’re chunked and embedded automatically." />
          ) : (
            <DataTable>
              <thead><tr><th>Document</th><th>Status</th><th className="text-right">Chunks</th><th className="text-right">Added</th>{canEdit && <th />}</tr></thead>
              <tbody>
                {docs.map((d) => {
                  const Icon = sourceIcon[(d.source as keyof typeof sourceIcon) ?? "text"] ?? FileText;
                  return (
                    <tr key={d.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Icon className="size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{d.title}</p>
                            {d.file_name && <p className="truncate text-xs text-muted-foreground">{d.file_name}</p>}
                          </div>
                        </div>
                      </td>
                      <td title={d.error ?? undefined}>
                        {d.status === "ready" ? <Badge variant={d.error ? "warning" : "success"}>{d.error ? "keyword only" : "indexed"}</Badge> : d.status === "failed" ? <Badge variant="destructive">failed</Badge> : <Badge variant="info">processing</Badge>}
                      </td>
                      <td className="text-right tabular-nums">{(d.knowledge_chunks as unknown as { count: number }[])[0]?.count ?? 0}</td>
                      <td className="text-right whitespace-nowrap text-muted-foreground"><LocalTime iso={d.created_at} format="short" /></td>
                      {canEdit && <td className="w-24"><DocActions id={d.id} /></td>}
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
          <Card>
            <CardHeader><CardTitle>Test retrieval</CardTitle><CardDescription>See exactly what an agent would get back for a question.</CardDescription></CardHeader>
            <CardContent><SearchBox /></CardContent>
          </Card>
        </div>
        {canEdit && (
          <Card className="h-fit lg:sticky lg:top-6">
            <CardHeader><CardTitle>Add a document</CardTitle></CardHeader>
            <CardContent><DocForm /></CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

export default function KnowledgePage() {
  return <Suspense fallback={<PageSkeleton />}><KnowledgeContent /></Suspense>;
}
