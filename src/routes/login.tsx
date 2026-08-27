import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import {
  ShoppingBag,
  Lock,
  Mail,
  AlertCircle,
  Store,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { createTemporaryAuthClient, supabase } from "@/lib/supabase";
import { TurnstileCaptcha } from "@/components/TurnstileCaptcha";
import { getErrorMessage } from "@/lib/utils";

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
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const navigate = useNavigate();
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();
  const captchaEnabled = Boolean(turnstileSiteKey);
  const handleCaptchaToken = useCallback((token: string | null) => {
    setCaptchaToken(token);
  }, []);

  const hasRequiredCaptcha = () => {
    if (!captchaEnabled || captchaToken) return true;
    setError("လုံခြုံရေးအတည်ပြုချက် ပြီးအောင် ခေတ္တစောင့်ပေးပါ");
    return false;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!hasRequiredCaptcha()) return;
      await auth.login(email, password, captchaToken ?? undefined);
      const profile = await auth.getUserProfile();
      if (profile?.role === "super_admin") {
        navigate({ to: "/admin" });
      } else {
        navigate({ to: "/" });
      }
    } catch (err) {
      console.error(err);
      setError(
        getErrorMessage(err, "အီးမေးလ် သို့မဟုတ် စကားဝှက် မှားယွင်းနေပါသည်"),
      );
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

    try {
      if (!turnstileSiteKey) {
        throw new Error(
          "ဆိုင်လျှောက်ထားမှုကို administrator က setup မပြီးသေးပါ",
        );
      }
      if (!hasRequiredCaptcha()) return;
      const authClient = createTemporaryAuthClient();
      if (!authClient) {
        throw new Error("Supabase ကို setup မပြီးသေးပါ");
      }
      const { data, error: signupError } = await authClient.auth.signUp({
        email,
        password,
        options: {
          data: { shop_name: shopName.trim() },
          captchaToken: captchaToken ?? undefined,
        },
      });
      if (signupError) throw signupError;
      if (!data.user) throw new Error("အကောင့်ဖန်တီးမှု မအောင်မြင်ပါ");

      setSuccess(
        "ဆိုင်အကောင့်လျှောက်ထားမှု အောင်မြင်ပါသည်။ Email ကိုအတည်ပြုပြီးနောက် Super Admin မှ အတည်ပြုပေးသည်အထိ ခေတ္တစောင့်ပေးပါရန် ✓",
      );
      setIsLogin(true);
      setShopName("");
      setEmail("");
      setPassword("");
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err, "ဆိုင်လျှောက်ထားမှု မအောင်မြင်ပါ"));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!hasRequiredCaptcha()) return;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/reset-password`,
          captchaToken: captchaToken ?? undefined,
        },
      );
      if (resetError) throw resetError;
      setSuccess(
        "Password ပြန်သတ်မှတ်ရန် link ကို email ထဲသို့ ပို့ပြီးပါပြီ ✓",
      );
      setIsPasswordRecovery(false);
    } catch (err) {
      setError(getErrorMessage(err, "Password reset link ပို့၍မရပါ"));
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
          <img
            src="/logo.png"
            alt="Logo"
            className="mb-4 h-16 w-16 rounded-2xl object-cover shadow-lg bg-white"
          />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            POS System
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isLogin
              ? "သင့်ရဲ့ ဆိုင်အကောင့်ဖြင့် ဝင်ရောက်ပါ"
              : "ဆိုင်အကောင့်သစ် လျှောက်ထားပါ"}
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

        {isPasswordRecovery ? (
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Account email ကိုထည့်ပါ။ Password အသစ်သတ်မှတ်ရန် link
              ပို့ပေးပါမယ်။
            </p>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                အီးမေးလ် (Email)
              </span>
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
            </label>
            {captchaEnabled && turnstileSiteKey && (
              <TurnstileCaptcha
                key="password-recovery-captcha"
                siteKey={turnstileSiteKey}
                onTokenChange={handleCaptchaToken}
              />
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-95 disabled:opacity-50"
            >
              {loading ? "ပို့နေသည်..." : "Reset link ပို့မည်"}
            </button>
            <button
              type="button"
              onClick={() => setIsPasswordRecovery(false)}
              className="w-full text-xs font-semibold text-primary hover:underline"
            >
              Login သို့ပြန်သွားမည်
            </button>
          </form>
        ) : isLogin ? (
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
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {captchaEnabled && turnstileSiteKey && (
              <TurnstileCaptcha
                key="login-captcha"
                siteKey={turnstileSiteKey}
                onTokenChange={handleCaptchaToken}
              />
            )}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-95 disabled:opacity-50"
            >
              {loading ? "ဝင်ရောက်နေသည်..." : "ဝင်မည်"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setSuccess(null);
                setIsPasswordRecovery(true);
              }}
              className="w-full text-xs font-semibold text-primary hover:underline"
            >
              Password မေ့နေပါသလား?
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
                  placeholder="အနည်းဆုံး ၈ လုံး"
                  minLength={8}
                  className="w-full rounded-2xl border border-border bg-background py-3 pl-11 pr-12 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {captchaEnabled && turnstileSiteKey && (
              <TurnstileCaptcha
                key="shop-request-captcha"
                siteKey={turnstileSiteKey}
                onTokenChange={handleCaptchaToken}
              />
            )}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-95 disabled:opacity-50"
            >
              {loading ? "လျှောက်ထားနေသည်..." : "ဆိုင်လျှောက်ထားမည်"}
            </button>
          </form>
        )}

        {!isPasswordRecovery && (
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
              {isLogin
                ? "ဆိုင်အသစ် လျှောက်ထားလိုပါက နှိပ်ရန်"
                : "အကောင့်ရှိပြီးသားဖြစ်ပါက ဝင်ရန် နှိပ်ပါ"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
