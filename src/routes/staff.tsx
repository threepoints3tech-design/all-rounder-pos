import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { UserPlus, UserRoundX, Users } from "lucide-react";
import { Shell } from "@/components/pos/Shell";
import { auth, type UserProfile } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/utils";

export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [
      { title: "Staff – POS" },
      { name: "description", content: "Manage shop staff accounts." },
    ],
  }),
  component: StaffPage,
});

type StaffMember = {
  id: string;
  email: string;
  active: boolean;
  created_at: string;
};

type StaffInvite = {
  id: string;
  email: string;
  status: "pending" | "accepted" | "cancelled" | "expired";
  expires_at: string;
};

function StaffPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [invites, setInvites] = useState<StaffInvite[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        { data: staffData, error: staffError },
        { data: inviteData, error: inviteError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, email, active, created_at")
          .eq("tenant_id", currentProfile.tenant_id)
          .eq("role", "staff")
          .order("created_at", { ascending: false }),
        supabase
          .from("staff_invites")
          .select("id, email, status, expires_at")
          .eq("tenant_id", currentProfile.tenant_id)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
      ]);
      if (staffError) throw staffError;
      if (inviteError) throw inviteError;
      setStaff((staffData ?? []) as StaffMember[]);
      setInvites((inviteData ?? []) as StaffInvite[]);
    } catch (err) {
      setError(getErrorMessage(err, "Staff စာရင်းဖတ်၍မရပါ"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const { data: inviteData, error: inviteError } = await supabase
        .rpc("create_staff_invite", { invited_email: email.trim() })
        .single();
      if (inviteError) throw inviteError;

      const { error: deliveryError } = await supabase.functions.invoke(
        "invite-staff",
        {
          body: { invite_id: inviteData.id },
        },
      );
      if (deliveryError) throw deliveryError;

      setEmail("");
      setMessage("Staff invitation email ပို့ပြီးပါပြီ ✓");
      await load();
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Invitation ပို့၍မရပါ။ Supabase Edge Function deploy လုပ်ပြီးကြောင်း စစ်ပေးပါ။",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const deactivate = async (member: StaffMember) => {
    if (
      !supabase ||
      !window.confirm(`${member.email} ကို staff access ပိတ်မှာ သေချာပါသလား?`)
    )
      return;
    setError(null);
    try {
      const { error: deactivateError } = await supabase.rpc(
        "deactivate_staff",
        { target_profile_id: member.id },
      );
      if (deactivateError) throw deactivateError;
      setMessage("Staff access ပိတ်ပြီးပါပြီ ✓");
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Staff access ပိတ်၍မရပါ"));
    }
  };

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
          <h1 className="text-xl font-semibold">Staff Management</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            ဆိုင်ရှင် (Owner) အကောင့်ဖြင့်သာ staff ကို စီမံနိုင်ပါသည်။
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Staff Management</h1>
          <p className="text-sm text-muted-foreground">
            Cashier staff အကောင့်များနှင့် access ကို စီမံပါ။
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {message}
        </div>
      )}

      <form
        onSubmit={invite}
        className="mb-6 rounded-2xl border border-border bg-card p-5"
      >
        <h2 className="text-base font-semibold">Staff အသစ်ဖိတ်ရန်</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Email invitation က ၇ ရက်အတွင်း အသက်ဝင်ပါမည်။ Staff သည် sale
          ပြုလုပ်နိုင်သော်လည်း settings နှင့် product catalog ကို မပြင်နိုင်ပါ။
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="cashier@yourshop.com"
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
          />
          <button
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />{" "}
            {submitting ? "ပို့နေသည်..." : "Invitation ပို့မည်"}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold">
          လက်ရှိ Staff ({staff.filter((member) => member.active).length})
        </h2>
        <div className="mt-3 divide-y divide-border">
          {staff.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Staff မရှိသေးပါ
            </p>
          )}
          {staff.map((member) => (
            <div
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="text-sm font-medium">{member.email}</p>
                <p
                  className={`mt-0.5 text-xs ${member.active ? "text-emerald-600" : "text-muted-foreground"}`}
                >
                  {member.active ? "Active" : "Access ပိတ်ထားသည်"}
                </p>
              </div>
              {member.active && (
                <button
                  onClick={() => deactivate(member)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                >
                  <UserRoundX className="h-3.5 w-3.5" /> Access ပိတ်မည်
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {invites.length > 0 && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">
            စောင့်ဆိုင်းနေသော Invitation
          </h2>
          <div className="mt-3 divide-y divide-border">
            {invites.map((inviteItem) => (
              <div
                key={inviteItem.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <span>{inviteItem.email}</span>
                <span className="text-xs text-muted-foreground">
                  Expires {new Date(inviteItem.expires_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}
