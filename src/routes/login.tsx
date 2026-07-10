import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ShoppingBag, Lock, Mail, AlertCircle, Store, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login – POS SaaS" },
      { name: "description", content: "Log in or register your shop." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await auth.login(email, password);
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

  const handleRequestShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    try {
      // 1. Create a pending tenant (requires RLS insert policy for status = 'pending')
      const { data: tenant, error: tenantErr } = await supabase
        .from("tenants")
        .insert({
          name: shopName,
          status: "pending",
        })
        .select()
        .single();

      if (tenantErr) throw tenantErr;

      // 2. Register the user using a temp client to avoid logging out the current session
      const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });

      const { data: authData, error: authErr } = await tempClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            tenant_id: tenant.id,
          },
        },
      });

      if (authErr) {
        await supabase.from("tenants").delete().eq("id", tenant.id);
        throw authErr;
      }

      const newUserId = authData.user?.id;
      if (!newUserId) throw new Error("အကောင့်ဖန်တီးမှု မအောင်မြင်ပါ");

      // Note: Default settings row is automatically created by the public.handle_new_tenant database trigger

      setSuccess("ဆိုင်အကောင့်လျှောက်ထားမှု အောင်မြင်ပါသည်။ စနစ်စီမံခန့်ခွဲသူ (Super Admin) မှ အတည်ပြုပေးသည်အထိ ခေတ္တစောင့်ဆိုင်းပေးပါရန် ✓");
      setIsLogin(true);
      setShopName("");
      setEmail("");
      setPassword("");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "ဆိုင်လျှောက်ထားမှု မအောင်မြင်ပါ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Premium background gradients */}
      <div className="absolute -left-1/4 -top-1/4 h-[600px] w-[600px] rounded-full bg-primary/10 blur-[120px]" />
      <div className="absolute -bottom-1/4 -right-1/4 h-[600px] w-[600px] rounded-full bg-indigo-500/10 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md border border-border bg-card/60 p-8 shadow-[var(--shadow-card)] backdrop-blur-md rounded-3xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            POS System
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isLogin ? "သင့်ရဲ့ ဆိုင်အကောင့်ဖြင့် ဝင်ရောက်ပါ" : "ဆိုင်အကောင့်သစ် လျှောက်ထားပါ"}
          </p>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive-soft/10 p-4 text-xs text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-600">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" />
            <p>{success}</p>
          </div>
        )}

        {isLogin ? (
          <form onSubmit={handleLogin} className="space-y-4">
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
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-border bg-background py-3 pl-11 pr-12 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-95 disabled:opacity-50"
            >
              {loading ? "ဝင်ရောက်နေသည်..." : "ဝင်မည်"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRequestShop} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                ဆိုင်အမည် (Shop Name)
              </label>
              <div className="relative">
                <Store className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="ဥပမာ - မုန့်ဆိုင်လေး"
                  className="w-full rounded-2xl border border-border bg-background py-3 pl-11 pr-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/40"
                />
              </div>
            </div>

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
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="အနည်းဆုံး ၆ လုံး"
                  minLength={6}
                  className="w-full rounded-2xl border border-border bg-background py-3 pl-11 pr-12 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-95 disabled:opacity-50"
            >
              {loading ? "လျှောက်ထားနေသည်..." : "ဆိုင်လျှောက်ထားမည်"}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
              setSuccess(null);
              setShowPassword(false);
            }}
            className="text-xs font-semibold text-primary hover:underline"
          >
            {isLogin ? "ဆိုင်အသစ် လျှောက်ထားလိုပါက နှိပ်ရန်" : "အကောင့်ရှိပြီးသားဖြစ်ပါက ဝင်ရန် နှိပ်ပါ"}
          </button>
        </div>
      </div>
    </div>
  );
}
