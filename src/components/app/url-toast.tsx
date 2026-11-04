"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const MESSAGES: Record<string, string> = {
  "password-updated": "Password updated",
  welcome: "Welcome to AgentForge! 🎉",
};

/** Shows a toast for ?toast=… / ?welcome=1 and cleans the URL. */
export function UrlToast() {
  const params = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const key = params.get("toast") ?? (params.get("welcome") ? "welcome" : null);
    if (!key || !MESSAGES[key]) return;
    toast.success(MESSAGES[key]);
    const url = new URL(window.location.href);
    url.searchParams.delete("toast");
    url.searchParams.delete("welcome");
    router.replace(url.pathname + url.search, { scroll: false });
  }, [params, router]);
  return null;
}
