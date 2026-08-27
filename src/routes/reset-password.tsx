import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/utils";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password – POS" },
      { name: "description", content: "Set a new POS account password." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    if (!supabase) {
      setError("Supabase configuration မတွေ့ပါ");
      return;
    }
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError || !data.session) {
        setError(
          "Password reset link သက်တမ်းကုန်သွားပါသည်။ အသစ်တစ်စောင် တောင်းပေးပါ။",
        );
      } else {
        setReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setError(null);
    if (password.length < 8) {
      setError("Password ကို အနည်းဆုံး ၈ လုံးထားပါ");
      return;
    }
    if (password !== confirmPassword) {
      setError("Password နှစ်ခု မတူပါ");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;
      navigate({ to: "/" });
    } catch (err) {
      setError(getErrorMessage(err, "Password ပြောင်း၍မရပါ"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
        <h1 className="text-2xl font-bold">Password အသစ်သတ်မှတ်ရန်</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          လုံခြုံသော password အသစ်တစ်ခု ထည့်ပါ။
        </p>

        {error && (
          <p className="mt-5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {ready && (
          <form onSubmit={savePassword} className="mt-6 space-y-4">
            {[
              ["Password အသစ်", password, setPassword],
              ["Password အတည်ပြု", confirmPassword, setConfirmPassword],
            ].map(([label, value, setValue]) => (
              <label key={label as string} className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                  {label as string}
                </span>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={value as string}
                    onChange={(event) =>
                      (setValue as (nextValue: string) => void)(
                        event.target.value,
                      )
                    }
                    className="w-full rounded-2xl border border-border bg-background py-3 pl-11 pr-12 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                  />
                  <button
                    type="button"
                    aria-label="Show or hide password"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </label>
            ))}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {loading ? "သိမ်းနေသည်..." : "Password အသစ်သိမ်းမည်"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
