import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ShoppingBag, Lock, Mail, AlertCircle } from "lucide-react";
import { auth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login – POS SaaS" },
      { name: "description", content: "Log in to your POS account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await auth.login(email, password);
      // Fetch profile to determine role
      const profile = await auth.getUserProfile();
      if (profile?.role === "super_admin") {
        navigate({ to: "/admin" });
      } else {
        navigate({ to: "/" });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "အီးမေးလ် သို့မဟုတ် စကားဝှက် မှားယွင်းနေပါသည်");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Premium background gradients */}
      <div className="absolute -left-1/4 -top-1/4 h-[600px] w-[600px] rounded-full bg-primary/10 blur-[120px]" />
      <div className="absolute -bottom-1/4 -right-1/4 h-[600px] w-[600px] rounded-full bg-indigo-500/10 blur-[120px]" />

      <form
        onSubmit={handleLogin}
        className="relative z-10 w-full max-w-md border border-border bg-card/60 p-8 shadow-[var(--shadow-card)] backdrop-blur-md rounded-3xl"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            POS System
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            သင့်ရဲ့ ဆိုင်အကောင့်ဖြင့် ဝင်ရောက်ပါ
          </p>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive-soft/10 p-4 text-sm text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              အီးမေးလ် (Email)
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@yourshop.com"
                className="w-full rounded-2xl border border-border bg-background py-3 pl-11 pr-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/40"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              စကားဝှက် (Password)
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-2xl border border-border bg-background py-3 pl-11 pr-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/40"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-95 disabled:opacity-50"
        >
          {loading ? "ဝင်ရောက်နေသည်..." : "ဝင်မည်"}
        </button>
      </form>
    </div>
  );
}
