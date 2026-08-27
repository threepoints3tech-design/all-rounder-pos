import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Lock, LogOut, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/pos/Shell";
import {
  store,
  defaultSettings,
  hashPin,
  lock,
  type Settings,
} from "@/lib/pos-store";
import { auth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings – POS" },
      {
        name: "description",
        content: "Configure shop name, currency, tax and owner PIN.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [s, setS] = useState<Settings>(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [canManageSettings, setCanManageSettings] = useState<boolean | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  // PIN form
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinMsg, setPinMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([store.getSettings(), auth.getUserProfile()])
      .then(([settings, profile]) => {
        if (!active) return;
        setS(settings);
        setCanManageSettings(profile?.role === "owner");
      })
      .catch((err) => {
        if (active)
          setLoadError(getErrorMessage(err, "Settings ကို မဖွင့်နိုင်ပါ"));
      });
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    try {
      await store.setSettings(s);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setLoadError(getErrorMessage(err, "Settings ကို save မလုပ်နိုင်ပါ"));
    }
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
    setPinMsg({
      type: "ok",
      text: hasPin ? "PIN ပြောင်းပြီး ✓" : "PIN ဖန်တီးပြီး ✓",
    });
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

  const exportBackup = async () => {
    const [products, sales, settings] = await Promise.all([
      store.getProducts(),
      store.getSales(),
      store.getSettings(),
    ]);
    const { pinHash: _pinHash, ...backupSettings } = settings;
    const payload = {
      format: "all-rounder-pos-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      products,
      sales,
      settings: backupSettings,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Shell>
      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>

      {loadError && (
        <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {canManageSettings === null ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Settings permissions ကို စစ်ဆေးနေပါသည်…
        </div>
      ) : canManageSettings === false ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Settings နှင့် owner PIN ကို ဆိုင်ရှင် account ဖြင့်သာ
          ပြင်ဆင်နိုင်ပါသည်။
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Shop settings */}
          <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-muted-foreground">
              ဆိုင်ဆက်တင်
            </h2>
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
              <span className="mb-1 block text-sm font-medium">
                Tax rate (%)
              </span>
              <input
                type="number"
                value={s.taxRate}
                onChange={(e) =>
                  setS({ ...s, taxRate: Number(e.target.value) })
                }
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
                  <span className="mb-1 block text-xs font-medium">
                    လက်ရှိ PIN
                  </span>
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
                <span className="mb-1 block text-xs font-medium">
                  PIN အတည်ပြု
                </span>
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
                    pinMsg.type === "ok"
                      ? "text-emerald-600"
                      : "text-destructive"
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
                  PIN မသတ်မှတ်ရသေးပါ။ PIN သတ်မှတ်ပြီးလျှင် app ဖွင့်တိုင်း PIN
                  တောင်းပါမည်။
                </span>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Download className="h-4 w-4" /> Data Backup
            </h2>
            <p className="text-xs text-muted-foreground">
              Products, sales history နှင့် settings ကို JSON backup အဖြစ်
              download လုပ်ထားနိုင်ပါသည်။ အနည်းဆုံး တစ်ပတ်တစ်ခါ သိမ်းထားပါ။
            </p>
            <button
              onClick={() => void exportBackup()}
              className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-accent"
            >
              Backup Download လုပ်မည်
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}
