import { useEffect, useState } from "react";
import { Lock, ShoppingCart } from "lucide-react";
import { store, hashPin, lock } from "@/lib/pos-store";

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [shop, setShop] = useState("My Shop");
  const [owner, setOwner] = useState("");

  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    store.getSettings().then((s) => {
      setSettings(s);
      setShop(s.shopName || "My Shop");
      setOwner(s.ownerName || "");
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const s = settings || await store.getSettings();
    if (!s.pinHash) {
      lock.setUnlocked(true);
      onUnlock();
      return;
    }
    const h = await hashPin(pin);
    if (h === s.pinHash) {
      lock.setUnlocked(true);
      onUnlock();
    } else {
      setErr("PIN မှားနေပါသည်");
      setPin("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-sidebar text-white">
            <ShoppingCart className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold">{shop}</h1>
          {owner && <p className="text-xs text-muted-foreground">{owner}</p>}
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Owner PIN ဖြင့် ဝင်ရောက်ပါ
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium">PIN</span>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            maxLength={12}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-center text-lg tracking-[0.5em]"
            placeholder="••••"
          />
        </label>
        {err && (
          <p className="mt-2 text-center text-xs text-destructive">{err}</p>
        )}

        <button
          type="submit"
          className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          ဝင်မည်
        </button>
      </form>
    </div>
  );
}
