import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Users,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Plus,
  Calendar,
  Lock,
  Mail,
  Store,
  Trash2,
  AlertCircle,
  CheckCircle,
  LogOut,
} from "lucide-react";
import { auth, type UserProfile } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Super Admin Panel – POS" },
      { name: "description", content: "Manage SaaS tenants and subscriptions." },
    ],
  }),
  component: AdminPage,
});

interface TenantInfo {
  id: string;
  name: string;
  status: "active" | "suspended" | "inactive";
  subscription_ends_at: string | null;
  created_at: string;
  owner_email?: string;
  owner_id?: string;
}

function AdminPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states for creating a new shop
  const [openModal, setOpenModal] = useState(false);
  const [shopName, setShopName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [subMonths, setSubMonths] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  // Verify super_admin role and load tenants
  const verifyAndLoadData = async () => {
    setLoading(true);
    setError(null);
    const profile = await auth.getUserProfile();
    if (!profile || profile.role !== "super_admin") {
      navigate({ to: "/login" });
      return;
    }
    setUser(profile);

    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      // Fetch tenants and their owners
      const { data: tenantData, error: tError } = await supabase
        .from("tenants")
        .select(`
          id,
          name,
          status,
          subscription_ends_at,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (tError) throw tError;

      // Fetch profiles to map owner emails
      const { data: profileData, error: pError } = await supabase
        .from("profiles")
        .select("id, email, tenant_id")
        .eq("role", "owner");

      if (pError) throw pError;

      const mappedTenants = (tenantData || []).map((t) => {
        const owner = profileData?.find((p) => p.tenant_id === t.id);
        return {
          ...t,
          owner_email: owner?.email || "No Owner Linked",
          owner_id: owner?.id,
        };
      }) as TenantInfo[];

      setTenants(mappedTenants);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "အချက်အလက်များ ဖတ်၍မရပါ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verifyAndLoadData();
  }, []);

  const handleToggleStatus = async (tenantId: string, currentStatus: string) => {
    if (!supabase) return;
    const nextStatus = currentStatus === "active" ? "suspended" : "active";

    try {
      const { error: err } = await supabase
        .from("tenants")
        .update({ status: nextStatus })
        .eq("id", tenantId);

      if (err) throw err;

      setTenants((prev) =>
        prev.map((t) => (t.id === tenantId ? { ...t, status: nextStatus } : t))
      );
      setSuccess(`ဆိုင်အကောင့် အခြေအနေကို ${nextStatus === "active" ? "ဖွင့်လှစ်ပြီး" : "ဆိုင်းငံ့ပြီး"} ပါပြီ ✓`);
      setTimeout(() => setSuccess(null), 2500);
    } catch (err: any) {
      setError(err.message || "ပြင်ဆင်၍မရပါ");
    }
  };

  const handleExtendSubscription = async (tenantId: string, months: number) => {
    if (!supabase) return;

    try {
      const tenant = tenants.find((t) => t.id === tenantId);
      const currentExpiry = tenant?.subscription_ends_at
        ? new Date(tenant.subscription_ends_at)
        : new Date();
      
      const newExpiry = new Date(currentExpiry);
      newExpiry.setMonth(newExpiry.getMonth() + months);

      const { error: err } = await supabase
        .from("tenants")
        .update({ subscription_ends_at: newExpiry.toISOString() })
        .eq("id", tenantId);

      if (err) throw err;

      setTenants((prev) =>
        prev.map((t) =>
          t.id === tenantId ? { ...t, subscription_ends_at: newExpiry.toISOString() } : t
        )
      );
      setSuccess(`ဆိုင်သက်တမ်းကို ${months} လ တိုးမြှင့်ပြီးပါပြီ ✓`);
      setTimeout(() => setSuccess(null), 2500);
    } catch (err: any) {
      setError(err.message || "ပြင်ဆင်၍မရပါ");
    }
  };

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    setError(null);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    try {
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + subMonths);

      // 1. Create the tenant row
      const { data: tenant, error: tenantErr } = await supabase
        .from("tenants")
        .insert({
          name: shopName,
          status: "active",
          subscription_ends_at: expiryDate.toISOString(),
        })
        .select()
        .single();

      if (tenantErr) throw tenantErr;

      // 2. Sign up the new user WITHOUT altering the current admin session
      const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });

      const { data: authData, error: authErr } = await tempClient.auth.signUp({
        email: ownerEmail,
        password: ownerPassword,
      });

      if (authErr) {
        // Rollback tenant row if user creation fails
        await supabase.from("tenants").delete().eq("id", tenant.id);
        throw authErr;
      }

      const newUserId = authData.user?.id;
      if (!newUserId) throw new Error("အကောင့်ဖန်တီးမှု မအောင်မြင်ပါ");

      // 3. Update the newly created user's profile with the tenant_id
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ tenant_id: tenant.id })
        .eq("id", newUserId);

      if (profileErr) throw profileErr;

      // 4. Initialize default settings row for the new tenant
      await supabase.from("settings").insert({
        tenant_id: tenant.id,
        shop_name: shopName,
        currency: "Ks",
        tax_rate: 5,
      });

      setSuccess("ဆိုင်အကောင့်အသစ်ကို အောင်မြင်စွာ ဖန်တီးပြီးပါပြီ ✓");
      setOpenModal(false);
      setShopName("");
      setOwnerEmail("");
      setOwnerPassword("");
      setSubMonths(1);
      verifyAndLoadData();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "ဆိုင်ဖန်တီးမှု မအောင်မြင်ပါ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await auth.logout();
    navigate({ to: "/login" });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">လုဒ်ဆွဲနေသည်...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-[1200px]">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">SaaS Admin Control Panel</h1>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
          >
            <LogOut className="h-3.5 w-3.5" /> ထွက်မည်
          </button>
        </header>

        {/* Notifications */}
        {error && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive-soft/10 p-4 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-500">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <p>{success}</p>
          </div>
        )}

        {/* Controls */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4" /> ဆိုင်အကောင့်များ စာရင်း ({tenants.length})
          </h2>
          <button
            onClick={() => setOpenModal(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90 shadow-md shadow-primary/10"
          >
            <Plus className="h-4 w-4" /> ဆိုင်အသစ်ဖွင့်ရန်
          </button>
        </div>

        {/* Table List */}
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-sidebar border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="p-4 font-semibold">ဆိုင်အမည်</th>
                  <th className="p-4 font-semibold">အကောင့် Email</th>
                  <th className="p-4 font-semibold">သက်တမ်းကုန်ဆုံးရက်</th>
                  <th className="p-4 font-semibold">အခြေအနေ</th>
                  <th className="p-4 font-semibold text-right">လုပ်ဆောင်ချက်</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tenants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      ဆိုင်အကောင့် မရှိသေးပါ
                    </td>
                  </tr>
                ) : (
                  tenants.map((t) => (
                    <tr key={t.id} className="hover:bg-sidebar/20">
                      <td className="p-4 font-medium flex items-center gap-2">
                        <Store className="h-4 w-4 text-primary" />
                        {t.name}
                      </td>
                      <td className="p-4 text-muted-foreground">{t.owner_email}</td>
                      <td className="p-4 text-xs font-medium">
                        {t.subscription_ends_at ? (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            {new Date(t.subscription_ends_at).toLocaleDateString()}
                          </span>
                        ) : (
                          "အကန့်အသတ်မရှိ"
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            t.status === "active"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {t.status === "active" ? "Active" : "Suspended"}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleToggleStatus(t.id, t.status)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-accent"
                            title={t.status === "active" ? "ဆိုင်းငံ့ရန်" : "အသက်သွင်းရန်"}
                          >
                            {t.status === "active" ? (
                              <>
                                <ToggleLeft className="h-4 w-4 text-destructive" /> ဆိုင်းငံ့မည်
                              </>
                            ) : (
                              <>
                                <ToggleRight className="h-4 w-4 text-emerald-500" /> ဖွင့်လှစ်မည်
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleExtendSubscription(t.id, 1)}
                            className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-semibold hover:bg-accent"
                          >
                            +၁ လတိုးရန်
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Create Shop */}
        {openModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
              <h3 className="mb-4 text-base font-bold flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" /> ဆိုင်အကောင့်အသစ် ဖန်တီးရန်
              </h3>

              <form onSubmit={handleCreateShop} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium">ဆိုင်အမည် (Shop Name)</label>
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="ဥပမာ - မုန့်ဆိုင်လေး"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium">အကောင့် Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      placeholder="owner@shop.com"
                      className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium">စကားဝှက် (Password)</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="password"
                      required
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      placeholder="အနည်းဆုံး ၆ လုံး"
                      minLength={6}
                      className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium">ကနဦး သက်တမ်းသတ်မှတ်ရန်</label>
                  <select
                    value={subMonths}
                    onChange={(e) => setSubMonths(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
                  >
                    <option value={1}>၁ လ</option>
                    <option value={3}>၃ လ</option>
                    <option value={6}>၆ လ</option>
                    <option value={12}>၁ နှစ် (၁၂ လ)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpenModal(false)}
                    className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-accent"
                  >
                    ပယ်ဖျက်မည်
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? "ဖန်တီးနေသည်..." : "ဖန်တီးမည်"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
