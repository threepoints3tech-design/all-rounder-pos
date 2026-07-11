import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Minus, Plus, X, Trash2, ScanBarcode, Camera, AlertCircle } from "lucide-react";
import { Shell } from "@/components/pos/Shell";
import { BarcodeScanner } from "@/components/pos/BarcodeScanner";
import {
  store,
  defaultCategories,
  type Product,
  type CartItem,
  type Settings,
  defaultSettings,
} from "@/lib/pos-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "POS – General Point of Sale" },
      { name: "description", content: "Simple general-purpose POS for any shop." },
    ],
  }),
  component: POSPage,
});

function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [error, setError] = useState<string | null>(null);
  const [orderNo, setOrderNo] = useState<number>(1);
  const [now, setNow] = useState<string>("");
  const [scan, setScan] = useState("");
  const [scanMsg, setScanMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [camOpen, setCamOpen] = useState(false);

  useEffect(() => {
    store.getProducts().then(setProducts);
    store.getSettings().then(setSettings);
    store.getSales().then((sales) => setOrderNo(sales.length + 1));
    const tick = () =>
      setNow(
        new Date().toLocaleString(undefined, {
          weekday: "short",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>(defaultCategories);
    products.forEach((p) => set.add(p.category));
    return ["All", ...Array.from(set)];
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const inCat = category === "All" || p.category === category;
      const q = query.trim().toLowerCase();
      const match = !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
      return inCat && match;
    });
  }, [products, category, query]);

  const addToCart = (p: Product) => {
    const stock = p.stock ?? 0;
    if (stock <= 0) return;
    setCart((c) => {
      const existing = c.find((i) => i.id === p.id);
      if (existing) {
        if (existing.qty >= stock) return c;
        return c.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...c, { ...p, qty: 1 }];
    });
  };

  const changeQty = (id: string, delta: number) => {
    setCart((c) =>
      c
        .map((i) => {
          if (i.id !== id) return i;
          const stock = products.find((p) => p.id === id)?.stock ?? i.qty;
          const next = Math.min(i.qty + delta, stock);
          return { ...i, qty: next };
        })
        .filter((i) => i.qty > 0),
    );
  };

  const removeItem = (id: string) => setCart((c) => c.filter((i) => i.id !== id));

  const lookupAndAdd = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;
    const found = products.find(
      (p) => (p.barcode ?? "").trim().toLowerCase() === code.toLowerCase() || p.id === code,
    );
    if (!found) {
      setScanMsg({ text: `Barcode "${code}" ကို ရှာမတွေ့ပါ`, ok: false });
    } else if ((found.stock ?? 0) <= 0) {
      setScanMsg({ text: `${found.name} ကုန်သွားပြီ`, ok: false });
    } else {
      addToCart(found);
      setScanMsg({ text: `${found.name} — cart ထဲထည့်ပြီး`, ok: true });
    }
    setTimeout(() => setScanMsg(null), 2000);
  };

  const submitScan = () => {
    const code = scan.trim();
    if (!code) return;
    lookupAndAdd(code);
    setScan("");
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = Math.round((subtotal * settings.taxRate) / 100);
  const total = subtotal + tax;

  const checkout = async () => {
    if (cart.length === 0) return;
    try {
      setError(null);
      const sale = {
        id: `#${String(orderNo).padStart(4, "0")}`,
        date: new Date().toISOString(),
        items: cart,
        subtotal,
        tax,
        total,
      };
      await store.addSale(sale);
      const updated = products.map((p) => {
        const sold = cart.find((i) => i.id === p.id)?.qty ?? 0;
        if (!sold) return p;
        return { ...p, stock: Math.max(0, (p.stock ?? 0) - sold) };
      });
      setProducts(updated);
      await store.setProducts(updated);
      setCart([]);
      setOrderNo((n) => n + 1);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "ငွေရှင်းခြင်း ဆာဗာသို့ ပေးပို့၍မရပါ");
    }
  };

  const fmt = (n: number) => `${settings.currency} ${n.toLocaleString()}`;

  return (
    <Shell>
      {error && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive-soft/10 p-4 text-xs text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold">ငွေရှင်းခြင်း အဆင်မပြေပါ (Checkout Error):</p>
            <p className="mt-0.5 opacity-90">{error}</p>
          </div>
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* LEFT */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                Order No. #{String(orderNo).padStart(4, "0")}
              </h1>
              <p className="text-xs text-muted-foreground">{settings.shopName}</p>
            </div>
            <p className="text-sm text-muted-foreground">{now}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter item name or code..."
                className="w-full rounded-2xl border border-border bg-background py-3 pl-11 pr-4 text-sm outline-none transition-shadow focus:shadow-[var(--shadow-soft)] focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <div className="relative sm:w-64">
              <ScanBarcode className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
              <input
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitScan();
                  }
                }}
                placeholder="Scan barcode..."
                autoFocus
                className="w-full rounded-2xl border border-primary/40 bg-primary-soft/40 py-3 pl-11 pr-12 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
              <button
                type="button"
                onClick={() => setCamOpen(true)}
                className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:opacity-90"
                aria-label="Open camera scanner"
                title="Camera နဲ့ ဖတ်ရန်"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>
          </div>
          {scanMsg && (
            <div
              className={`rounded-xl px-3 py-2 text-xs font-medium ${scanMsg.ok ? "bg-primary-soft text-primary" : "bg-destructive/10 text-destructive"}`}
            >
              {scanMsg.text}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Products</span>
            <span>
              {filtered.length} of {products.length}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {filtered.map((p) => {
              const stock = p.stock ?? 0;
              const isOut = stock <= 0;
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={isOut}
                  className="group relative flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-card)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-border disabled:hover:shadow-none"
                >
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-primary-soft text-4xl">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      p.emoji
                    )}
                  </div>
                  <div className="w-full">
                    <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{fmt(p.price)}</p>
                    <p className={`mt-0.5 text-[11px] font-medium ${isOut ? "text-destructive" : stock <= 5 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                      {isOut ? "ကုန်သွားပြီ" : `${stock} ကျန်`}
                    </p>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
                No products found.
              </p>
            )}
          </div>

          <div className="mt-auto flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-3">
            {categories.map((c) => {
              const active = c === category;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-xl px-4 py-2 text-xs font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </section>

        {/* RIGHT — CART */}
        <aside className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Cart</h2>
            <button
              onClick={() => setCart([])}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
              aria-label="Clear cart"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto pr-1" style={{ maxHeight: 380 }}>
            {cart.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">Cart is empty.</p>
            )}
            {cart.map((i) => (
              <div key={i.id} className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft text-2xl">
                  {i.image ? (
                    <img src={i.image} alt={i.name} className="h-full w-full object-cover" />
                  ) : (
                    i.emoji
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{i.name}</p>
                  <p className="text-xs text-muted-foreground">{fmt(i.price)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => changeQty(i.id, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-foreground hover:bg-accent"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-5 text-center text-sm font-medium">{i.qty}</span>
                  <button
                    onClick={() => changeQty(i.id, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => removeItem(i.id)}
                    className="ml-1 text-muted-foreground hover:text-destructive"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2 border-t border-border pt-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Sub Total</span>
              <span className="font-medium text-foreground">{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tax ({settings.taxRate}%)</span>
              <span className="font-medium text-foreground">{fmt(tax)}</span>
            </div>
          </div>

          <div className="rounded-2xl bg-primary-soft p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Total</span>
              <span className="text-2xl font-bold text-foreground">{fmt(total)}</span>
            </div>
            <button
              onClick={checkout}
              disabled={cart.length === 0}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold uppercase tracking-wide text-primary-foreground shadow-[var(--shadow-soft)] transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Check Out
            </button>
            <button
              onClick={() => setCart([])}
              className="mt-2 w-full rounded-xl py-2 text-sm font-semibold uppercase tracking-wide text-primary hover:bg-white/50"
            >
              Pending
            </button>
          </div>
        </aside>
      </div>
      <BarcodeScanner
        open={camOpen}
        onClose={() => setCamOpen(false)}
        onDetected={(code) => {
          setCamOpen(false);
          lookupAndAdd(code);
        }}
      />
    </Shell>
  );
}
