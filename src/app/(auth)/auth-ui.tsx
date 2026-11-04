"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export function PasswordInput({ showStrength, ...props }: React.ComponentProps<"input"> & { showStrength?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const score = strength(value);
  return (
    <div>
      <div className="relative">
        <Input
          {...props}
          type={visible ? "text" : "password"}
          className="pr-10"
          onChange={(e) => {
            setValue(e.target.value);
            props.onChange?.(e);
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {showStrength && value && (
        <div className="mt-2">
          <div className="flex gap-1" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full bg-muted transition-colors",
                  i < score && (score <= 1 ? "bg-destructive" : score === 2 ? "bg-warning" : "bg-success"),
                )}
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {["Too weak", "Weak", "Okay", "Good", "Strong"][score]} · 8+ characters with a letter and a number
          </p>
        </div>
      )}
    </div>
  );
}

function strength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^a-zA-Z0-9]/.test(p) || p.length >= 14) s++;
  return Math.min(s, 4);
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative my-6 text-center text-xs text-muted-foreground">
      <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
      <span className="relative bg-background px-3">{children}</span>
    </div>
  );
}
