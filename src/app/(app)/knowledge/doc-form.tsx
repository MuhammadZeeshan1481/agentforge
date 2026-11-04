"use client";
import { useActionState, useState } from "react";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { addDocument, type FormState } from "./actions";

export function DocForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addDocument, {});
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [fileKey, setFileKey] = useState(0);
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    // Reset the form after a successful add.
    setLastState(state);
    if (state.ok) {
      setTitle("");
      setContent("");
      setFileKey((k) => k + 1);
    }
  }

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <Label>Title</Label>
        <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Refund policy" required />
      </label>
      <label className="block">
        <Label hint=".txt, .md, .csv, .json">Upload a text file</Label>
        <input
          key={fileKey}
          type="file"
          accept=".txt,.md,.markdown,.csv,.json,text/*"
          className="block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm dark:file:bg-zinc-800"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 2_000_000) return alert("File is too large (2 MB max).");
            setContent(await f.text());
            if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
          }}
        />
      </label>
      <label className="block">
        <Label hint="or paste text">Content</Label>
        <Textarea name="content" rows={8} value={content} onChange={(e) => setContent(e.target.value)} className="font-sans" required />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add document"}</Button>
        {state.ok && !pending && <span className="text-sm text-emerald-600">Added</span>}
      </div>
    </form>
  );
}
