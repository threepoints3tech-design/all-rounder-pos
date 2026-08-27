import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClipboardList, PackageSearch, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/pos/Shell";
import { auth, type UserProfile } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/utils";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity – POS" },
      {
        name: "description",
        content: "View stock movements and audit history.",
      },
    ],
  }),
  component: ActivityPage,
});

type StockMovement = {
  id: string;
  product_id: string;
  sale_id: string | null;
  quantity_delta: number;
  reason: "sale" | "refund" | "adjustment" | "import";
  note: string | null;
  created_at: string;
};

type AuditLog = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
};

function ActivityPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const currentProfile = await auth.getUserProfile();
      setProfile(currentProfile);
      if (
        !supabase ||
        !currentProfile?.tenant_id ||
        currentProfile.role !== "owner"
      ) {
        setLoading(false);
        return;
      }
      try {
        const [
          { data: movementData, error: movementError },
          { data: logData, error: logError },
        ] = await Promise.all([
          supabase
            .from("stock_movements")
            .select(
              "id, product_id, sale_id, quantity_delta, reason, note, created_at",
            )
            .eq("tenant_id", currentProfile.tenant_id)
            .order("created_at", { ascending: false })
            .limit(100),
          supabase
            .from("audit_logs")
            .select("id, action, entity_type, entity_id, created_at")
            .eq("tenant_id", currentProfile.tenant_id)
            .order("created_at", { ascending: false })
            .limit(100),
        ]);
        if (movementError) throw movementError;
        if (logError) throw logError;
        setMovements((movementData ?? []) as StockMovement[]);
        setLogs((logData ?? []) as AuditLog[]);
      } catch (err) {
        setError(getErrorMessage(err, "Activity history ဖတ်၍မရပါ"));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        လုဒ်ဆွဲနေသည်...
      </div>
    );
  }

  if (profile?.role !== "owner") {
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-card p-6">
          <h1 className="text-xl font-semibold">Activity History</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            ဆိုင်ရှင် (Owner) အကောင့်ဖြင့်သာ stock နှင့် audit history
            ကိုကြည့်နိုင်ပါသည်။
          </p>
        </div>
      </Shell>
    );
  }

  const movementLabel: Record<StockMovement["reason"], string> = {
    sale: "Sale",
    refund: "Refund",
    adjustment: "Stock Adjustment",
    import: "Import",
  };

  return (
    <Shell>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Activity History</h1>
          <p className="text-sm text-muted-foreground">
            နောက်ဆုံး record 100 ခုစီကိုပြသထားပါသည်။
          </p>
        </div>
      </div>
      {error && (
        <div className="mb-5 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <PackageSearch className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Stock Movement</h2>
          </div>
          <div className="divide-y divide-border">
            {movements.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Stock movement မရှိသေးပါ
              </p>
            )}
            {movements.map((movement) => (
              <div
                key={movement.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {movementLabel[movement.reason]} · {movement.product_id}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {movement.note ||
                      movement.sale_id ||
                      new Date(movement.created_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${movement.quantity_delta > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}
                >
                  {movement.quantity_delta > 0 ? "+" : ""}
                  {movement.quantity_delta}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Audit Log</h2>
          </div>
          <div className="divide-y divide-border">
            {logs.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Audit history မရှိသေးပါ
              </p>
            )}
            {logs.map((log) => (
              <div key={log.id} className="py-3 text-sm">
                <p className="font-medium">{log.action}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {log.entity_type}
                  {log.entity_id ? ` · ${log.entity_id}` : ""} ·{" "}
                  {new Date(log.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Shell>
  );
}
