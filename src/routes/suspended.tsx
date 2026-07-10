import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertOctagon, LogOut, ShieldAlert } from "lucide-react";
import { auth } from "@/lib/auth";

export const Route = createFileRoute("/suspended")({
  head: () => ({
    meta: [
      { title: "Account Suspended – POS" },
      { name: "description", content: "Your account has been suspended." },
    ],
  }),
  component: SuspendedPage,
});

function SuspendedPage() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await auth.logout();
    navigate({ to: "/login" });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Background gradients */}
      <div className="absolute -left-1/4 -top-1/4 h-[600px] w-[600px] rounded-full bg-destructive/10 blur-[120px]" />
      <div className="absolute -bottom-1/4 -right-1/4 h-[600px] w-[600px] rounded-full bg-amber-500/5 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md border border-border bg-card/60 p-8 text-center shadow-[var(--shadow-card)] backdrop-blur-md rounded-3xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive-soft text-destructive shadow-lg shadow-destructive/10">
          <AlertOctagon className="h-8 w-8" />
        </div>

        <h1 className="text-xl font-bold tracking-tight text-foreground">
          အကောင့်ဝင်ရောက်ခွင့် ဆိုင်းငံ့ထားပါသည်
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          သင့်ရဲ့ ဆိုင်အကောင့် သက်တမ်းကုန်ဆုံးသွားခြင်း သို့မဟုတ် သုံးစွဲခွင့်ကို
          စီမံခန့်ခွဲသူ (Administrator) မှ ခေတ္တပိတ်ထားပါသဖြင့် ဝင်ရောက်၍ မရနိုင်သေးပါ။
        </p>

        <div className="mt-6 rounded-2xl bg-sidebar/50 p-4 border border-border text-xs leading-relaxed text-muted-foreground text-left">
          <div className="flex items-center gap-2 font-semibold text-foreground mb-1">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
          </div>
          သက်တမ်းတိုးမြှင့်ရန် သို့မဟုတ် အသေးစိတ်မေးမြန်းရန်အတွက် စနစ်စီမံခန့်ခွဲသူ
          (Super Admin) သို့ တိုက်ရိုက်ဆက်သွယ် ဆောင်ရွက်ပေးပါရန် မေတ္တာရပ်ခံအပ်ပါသည်။
        </div>

        <button
          onClick={handleLogout}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background py-3 text-sm font-semibold text-foreground transition-all hover:bg-accent"
        >
          <LogOut className="h-4 w-4" /> အကောင့်မှ ထွက်မည်
        </button>
      </div>
    </div>
  );
}
