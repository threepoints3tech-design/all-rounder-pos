import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Home, Receipt, ShoppingCart, Settings as SettingsIcon, Package, LogOut } from "lucide-react";
import { auth } from "@/lib/auth";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/transactions", label: "Sales", icon: Receipt },
  { to: "/products", label: "Products", icon: Package },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function Sidebar() {
  const { location } = useRouterState();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await auth.logout();
    navigate({ to: "/login" });
  };

  return (
    <aside className="flex w-20 shrink-0 flex-col items-center gap-2 rounded-3xl bg-sidebar py-6 text-sidebar-foreground min-h-[500px]">
      <img src="/logo.png" alt="Logo" className="mb-4 h-11 w-11 rounded-2xl object-cover shadow-sm bg-white" />
      {items.map((it) => {
        const active = location.pathname === it.to;
        const Icon = it.icon;
        return (
          <Link
            key={it.to}
            to={it.to}
            className={`flex w-14 flex-col items-center gap-1 rounded-2xl px-2 py-3 text-[10px] font-medium transition-colors ${
              active
                ? "bg-white text-sidebar-accent shadow-md"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span>{it.label}</span>
          </Link>
        );
      })}
      
      <button
        onClick={handleLogout}
        className="mt-auto flex w-14 flex-col items-center gap-1 rounded-2xl px-2 py-3 text-[10px] font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        title="Log Out"
      >
        <LogOut className="h-5 w-5" />
        <span>Logout</span>
      </button>
    </aside>
  );
}
