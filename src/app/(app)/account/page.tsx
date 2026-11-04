import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { getContext } from "@/lib/workspace";
import { DeleteAccountForm, EmailForm, PasswordForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "Account" };

async function AccountContent() {
  const { user, profile } = await getContext();
  const providers = (user.app_metadata?.providers as string[] | undefined) ?? [user.app_metadata?.provider ?? "email"];
  return (
    <>
      <PageHeader title="Account" description="Your personal profile and sign-in settings." />
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle><CardDescription>How you appear to teammates.</CardDescription></CardHeader>
          <CardContent><ProfileForm name={profile.fullName} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Email</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              Sign-in methods: {providers.map((p) => <Badge key={p} variant="secondary" className="capitalize">{p}</Badge>)}
            </CardDescription>
          </CardHeader>
          <CardContent><EmailForm email={user.email ?? ""} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Password</CardTitle></CardHeader>
          <CardContent><PasswordForm hasPassword={providers.includes("email")} /></CardContent>
        </Card>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Delete account</CardTitle>
            <CardDescription>Permanently deletes your account and every workspace you own, including its agents, workflows and data. This can’t be undone.</CardDescription>
          </CardHeader>
          <CardContent><DeleteAccountForm /></CardContent>
        </Card>
      </div>
    </>
  );
}

export default function AccountPage() {
  return <Suspense fallback={<PageSkeleton />}><AccountContent /></Suspense>;
}
