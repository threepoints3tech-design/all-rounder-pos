import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Receipt, ShoppingCart, Settings as SettingsIcon, Package } from "lucide-react";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/transactions", label: "Sales", icon: Receipt },
  { to: "/products", label: "Products", icon: Package },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function Sidebar() {
  const { location } = useRouterState();
  return (
    <aside className="flex w-20 shrink-0 flex-col items-center gap-2 rounded-3xl bg-sidebar py-6 text-sidebar-foreground">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-lg font-bold">
        <ShoppingCart className="h-5 w-5" />
      </div>
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
    </aside>
  );
}
