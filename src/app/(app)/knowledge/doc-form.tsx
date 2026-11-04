"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { addDocument, type FormState } from "./actions";

export function DocForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addDocument, {});
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState("upload");
  const [drag, setDrag] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [prev, setPrev] = useState(state);
  if (state !== prev) {
    setPrev(state);
    if (state.ok) setFile(null);
  }
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok) {
      toast.success(state.message ?? "Document added");
      formRef.current?.reset();
    }
  }, [state]);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) return toast.error("File is too large (4 MB max).");
    setFile(f);
    if (inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(f);
      inputRef.current.files = dt.files;
    }
  };

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <Field label="Title" hint="optional for uploads"><Input name="title" placeholder="Refund policy" /></Field>
      <Tabs value={mode} onValueChange={setMode}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Upload file</TabsTrigger>
          <TabsTrigger value="paste">Paste text</TabsTrigger>
        </TabsList>
        <TabsContent value="upload" forceMount className="data-[state=inactive]:hidden">
          <input ref={inputRef} type="file" name="file" accept=".pdf,.txt,.md,.markdown,.csv,.json,.html,.xml,.yaml,.yml,application/pdf,text/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          {file ? (
            <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4">
              <FileText className="size-8 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <button type="button" onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }} aria-label="Remove file"><X className="size-4 text-muted-foreground" /></button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
              className={cn("flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition", drag ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-muted/40")}
            >
              <UploadCloud className="size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Drop a file or click to browse</p>
              <p className="mt-1 text-xs text-muted-foreground">PDF, TXT, MD, CSV, JSON, HTML · up to 4 MB</p>
            </button>
          )}
        </TabsContent>
        <TabsContent value="paste" forceMount className="data-[state=inactive]:hidden">
          <Textarea name="content" rows={8} placeholder="Paste FAQs, policies, product docs…" disabled={mode !== "paste"} />
        </TabsContent>
      </Tabs>
      <Button type="submit" className="w-full" loading={pending}>{pending ? "Indexing…" : "Add to knowledge base"}</Button>
    </form>
  );
}
