import Link from "next/link";
import { Bot, ShieldCheck, Workflow, Zap } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme-toggle";

const points = [
  { icon: Bot, title: "Agents with real tools", text: "Web, APIs, Gmail, Sheets, Notion, Slack and your own knowledge base." },
  { icon: Workflow, title: "Visual workflows", text: "Drag agents, approvals and conditions into a flow. Trigger by webhook or schedule." },
  { icon: ShieldCheck, title: "Human in the loop", text: "Pause any workflow for a review before it emails a customer." },
  { icon: Zap, title: "Every step, live", text: "Watch tool calls and tokens stream in as the agent works." },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(0,560px)] xl:grid-cols-[1fr_640px]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/"><Logo /></Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          AgentForge · Built with Next.js, Supabase &amp; Gemini
        </p>
      </div>
      <aside className="relative hidden overflow-hidden border-l bg-[#0c0b1d] text-white lg:flex lg:flex-col lg:justify-center lg:px-12 xl:px-16">
        <div className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-violet-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 -left-24 size-[480px] rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.08]" />
        <div className="relative">
          <p className="text-sm font-medium text-violet-300">AI agent platform</p>
          <h2 className="mt-3 text-3xl leading-tight font-semibold tracking-tight xl:text-4xl">
            Put AI agents to work —<br />and stay in control.
          </h2>
          <ul className="mt-10 space-y-6">
            {points.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <Icon className="size-5 text-violet-300" />
                </span>
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="mt-0.5 block text-sm text-white/60">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
