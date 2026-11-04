import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/workspace";
import { Logo } from "@/components/app/logo";
import { PageSkeleton } from "@/components/page-skeleton";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Welcome" };

async function Onboarding() {
  const { user, workspace, profile } = await getContext();
  if (profile.onboarded) redirect("/dashboard");
  return (
    <>
      <p className="text-sm font-medium text-primary">Welcome to AgentForge 👋</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Let’s set up your workspace</h1>
      <p className="mt-2 text-muted-foreground">Two quick steps and you’ll have your first agent ready to run.</p>
      <div className="mt-10 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <OnboardingForm name={profile.fullName} workspace={workspace.name} isOwner={workspace.owner_id === user.id} />
      </div>
    </>
  );
}

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-transparent">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Logo />
        <div className="mt-14">
          <Suspense fallback={<PageSkeleton />}><Onboarding /></Suspense>
        </div>
      </div>
    </div>
  );
}
