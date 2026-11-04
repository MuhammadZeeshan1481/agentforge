"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Renders a timestamp in the viewer's own timezone (server render shows a neutral placeholder). */
export function LocalTime({ iso, format = "datetime" }: { iso: string; format?: "datetime" | "short" | "time" }) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  const d = new Date(iso);
  const text = !isClient
    ? ""
    : format === "time"
      ? d.toLocaleTimeString()
      : format === "short"
        ? d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
        : d.toLocaleString();
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
