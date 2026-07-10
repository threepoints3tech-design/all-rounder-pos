import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { LockScreen } from "./LockScreen";
import { store, lock } from "@/lib/pos-store";

export function Shell({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage.getItem("pos.suspended") === "true") {
      window.location.href = "/suspended";
      return;
    }

    store.getSettings().then((s) => {
      setLocked(Boolean(s.pinHash) && !lock.isUnlocked());
      setReady(true);
    });
  }, []);

  if (!ready) return null;
  if (locked) return <LockScreen onUnlock={() => setLocked(false)} />;

  return (
    <div className="min-h-screen bg-background p-3 sm:p-5">
      <div className="mx-auto flex max-w-[1400px] gap-4">
        <Sidebar />
        <main className="min-h-[calc(100vh-2.5rem)] flex-1 rounded-3xl bg-surface p-4 shadow-[var(--shadow-card)] sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
