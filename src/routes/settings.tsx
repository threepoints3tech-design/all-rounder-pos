import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, LogOut, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/pos/Shell";
import {
  store,
  defaultSettings,
  hashPin,
  lock,
  type Settings,
} from "@/lib/pos-store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings – POS" },
      { name: "description", content: "Configure shop name, currency, tax and owner PIN." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [s, setS] = useState<Settings>(defaultSettings);
  const [saved, setSaved] = useState(false);

  // PIN form
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinMsg, setPinMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    store.getSettings().then(setS);
  }, []);

  const save = async () => {
    await store.setSettings(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const hasPin = Boolean(s.pinHash);

  const savePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMsg(null);
    if (hasPin) {
      const h = await hashPin(currentPin);
      if (h !== s.pinHash) {
        setPinMsg({ type: "err", text: "လက်ရှိ PIN မှားနေပါသည်" });
        return;
      }
    }
    if (!/^\d{4,12}$/.test(newPin)) {
      setPinMsg({ type: "err", text: "PIN ကို ဂဏန်း ၄-၁၂ လုံး ထားပါ" });
      return;
    }
    if (newPin !== confirmPin) {
      setPinMsg({ type: "err", text: "PIN နှစ်ခု တူညီရမည်" });
      return;
    }
    const hash = await hashPin(newPin);
    const next = { ...s, pinHash: hash };
    setS(next);
    await store.setSettings(next);
    lock.setUnlocked(true);
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setPinMsg({ type: "ok", text: hasPin ? "PIN ပြောင်းပြီး ✓" : "PIN ဖန်တီးပြီး ✓" });
  };

  const removePin = async () => {
    setPinMsg(null);
    if (hasPin) {
      const h = await hashPin(currentPin);
      if (h !== s.pinHash) {
        setPinMsg({ type: "err", text: "လက်ရှိ PIN မှားနေပါသည်" });
        return;
      }
    }
    const next = { ...s, pinHash: "" };
    setS(next);
    await store.setSettings(next);
    setCurrentPin("");
    setPinMsg({ type: "ok", text: "PIN lock ဖျက်ပြီး" });
  };

  const lockNow = () => {
    lock.setUnlocked(false);
    window.location.href = "/";
  };

  return (
    <Shell>
      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Shop settings */}
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-muted-foreground">ဆိုင်ဆက်တင်</h2>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Shop name</span>
            <input
              value={s.shopName}
              onChange={(e) => setS({ ...s, shopName: e.target.value })}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Owner name</span>
            <input
              value={s.ownerName ?? ""}
              onChange={(e) => setS({ ...s, ownerName: e.target.value })}
              placeholder="ဆိုင်ရှင် အမည်"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Currency</span>
            <input
              value={s.currency}
              onChange={(e) => setS({ ...s, currency: e.target.value })}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Tax rate (%)</span>
            <input
              type="number"
              value={s.taxRate}
              onChange={(e) => setS({ ...s, taxRate: Number(e.target.value) })}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <button
            onClick={save}
            className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            {saved ? "Saved ✓" : "Save"}
          </button>
        </div>

        {/* Account / PIN lock */}
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <ShieldCheck className="h-4 w-4" /> Owner login (PIN)
            </h2>
            {hasPin && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                ACTIVE
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            App ဖွင့်တိုင်း PIN ဖြင့် အတည်ပြုမှသာ ဝင်ရောက်နိုင်စေရန်။
          </p>

          <form onSubmit={savePin} className="space-y-3">
            {hasPin && (
              <label className="block">
                <span className="mb-1 block text-xs font-medium">လက်ရှိ PIN</span>
                <input
                  type="password"
                  inputMode="numeric"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value)}
                  maxLength={12}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm tracking-widest"
                />
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-xs font-medium">
                {hasPin ? "New PIN" : "PIN အသစ်"} (ဂဏန်း ၄-၁၂ လုံး)
              </span>
              <input
                type="password"
                inputMode="numeric"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                maxLength={12}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm tracking-widest"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium">PIN အတည်ပြု</span>
              <input
                type="password"
                inputMode="numeric"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                maxLength={12}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm tracking-widest"
              />
            </label>

            {pinMsg && (
              <p
                className={`text-xs ${
                  pinMsg.type === "ok" ? "text-emerald-600" : "text-destructive"
                }`}
              >
                {pinMsg.text}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                {hasPin ? "PIN ပြောင်းမည်" : "PIN သတ်မှတ်မည်"}
              </button>
              {hasPin && (
                <>
                  <button
                    type="button"
                    onClick={removePin}
                    className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
                  >
                    PIN ဖျက်မည်
                  </button>
                  <button
                    type="button"
                    onClick={lockNow}
                    className="ml-auto flex items-center gap-1 rounded-xl bg-sidebar px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    <LogOut className="h-4 w-4" /> Lock now
                  </button>
                </>
              )}
            </div>
          </form>

          {!hasPin && (
            <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-[11px] text-muted-foreground">
              <Lock className="mt-0.5 h-3.5 w-3.5" />
              <span>
                PIN မသတ်မှတ်ရသေးပါ။ PIN သတ်မှတ်ပြီးလျှင် app ဖွင့်တိုင်း PIN တောင်းပါမည်။
              </span>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
