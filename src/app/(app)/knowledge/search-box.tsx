"use client";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { testSearch } from "./actions";

export function SearchBox() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ title: string; content: string; score: number }[] | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => setResults(await testSearch(q)));
        }}
        className="flex gap-2"
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask a question to test retrieval…" aria-label="Test search" />
        <Button type="submit" variant="outline" loading={pending}>{!pending && <Search />} Search</Button>
      </form>
      {results && (
        <ul className="mt-4 space-y-2">
          {results.length === 0 && <li className="text-sm text-muted-foreground">No matches.</li>}
          {results.map((r, i) => (
            <li key={i} className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="flex items-center justify-between gap-2 font-medium">{r.title}<span className="text-xs font-normal text-muted-foreground">score {r.score.toFixed(3)}</span></p>
              <p className="mt-1 line-clamp-3 text-muted-foreground">{r.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
