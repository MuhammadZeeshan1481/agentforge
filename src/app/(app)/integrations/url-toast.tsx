"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const ERRORS: Record<string, string> = {
  invalid_state: "The connection request expired. Please try again.",
  not_admin: "Only workspace admins can connect integrations.",
  signed_out: "You were signed out. Sign in and try again.",
  unknown_provider: "Unknown integration.",
};

export function UrlToastIntegrations() {
  const params = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const ok = params.get("connected");
    const err = params.get("error");
    if (!ok && !err) return;
    if (ok) toast.success(`${ok === "google" ? "Google" : "Notion"} connected`);
    if (err) toast.error(ERRORS[err] ?? err);
    router.replace("/integrations", { scroll: false });
  }, [params, router]);
  return null;
}
