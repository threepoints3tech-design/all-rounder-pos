import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Trash2, Plus, Pencil, Check, X, Minus, AlertTriangle, PackageX, PackageCheck, ImagePlus, ScanBarcode, Camera } from "lucide-react";
import { Shell } from "@/components/pos/Shell";
import { BarcodeScanner } from "@/components/pos/BarcodeScanner";
import { store, type Product } from "@/lib/pos-store";

const LOW_STOCK_THRESHOLD = 5;
type StockFilter = "all" | "low" | "out";

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "Products – POS" },
      { name: "description", content: "Manage products in your POS." },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [draft, setDraft] = useState<Product>({
    id: "",
    name: "",
    price: 0,
    category: "General",
    emoji: "📦",
    stock: 0,
    image: "",
    barcode: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Product | null>(null);
  const [filter, setFilter] = useState<StockFilter>("all");
  const [scanTarget, setScanTarget] = useState<"add" | "edit" | null>(null);

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });

  useEffect(() => {
    store.getProducts().then(setProducts);
  }, []);

  const stats = useMemo(() => {
    let out = 0, low = 0, totalUnits = 0;
    for (const p of products) {
      const s = p.stock ?? 0;
      totalUnits += s;
      if (s === 0) out++;
      else if (s <= LOW_STOCK_THRESHOLD) low++;
    }
    return { out, low, totalUnits, totalSkus: products.length };
  }, [products]);

  const visibleProducts = useMemo(() => {
    if (filter === "out") return products.filter((p) => (p.stock ?? 0) === 0);
    if (filter === "low")
      return products.filter((p) => {
        const s = p.stock ?? 0;
        return s > 0 && s <= LOW_STOCK_THRESHOLD;
      });
    return products;
  }, [products, filter]);

  const persist = async (p: Product[]) => {
    setProducts(p);
    await store.setProducts(p);
  };

  const add = () => {
    if (!draft.name || draft.price <= 0) return;
    const p: Product = { ...draft, id: `p${Date.now()}` };
    persist([...products, p]);
    setDraft({ id: "", name: "", price: 0, category: "General", emoji: "📦", stock: 0, image: "", barcode: "" });
  };

  const del = (id: string) => persist(products.filter((p) => p.id !== id));

  const changeStock = (id: string, delta: number) => {
    persist(
      products.map((p) =>
        p.id === id ? { ...p, stock: Math.max(0, (p.stock ?? 0) + delta) } : p,
      ),
    );
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEditDraft({ ...p });
  };

  const saveEdit = () => {
    if (!editDraft) return;
    persist(products.map((p) => (p.id === editDraft.id ? editDraft : p)));
    setEditingId(null);
    setEditDraft(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  return (
    <Shell>
      <h1 className="mb-6 text-2xl font-semibold">Products</h1>

      <div className="mb-6 space-y-2 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-primary">
            {draft.image ? (
              <img src={draft.image} alt="preview" className="h-full w-full object-cover" />
            ) : (
              <ImagePlus className="h-5 w-5" />
            )}
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setDraft({ ...draft, image: await fileToDataUrl(f) });
              }}
            />
          </label>
          <input
            value={draft.emoji}
            onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
            placeholder="🍎"
            className="w-16 rounded-xl border border-border bg-background px-3 py-2 text-center text-lg"
          />
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Product name"
            className="min-w-[160px] flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={draft.price || ""}
            onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
            placeholder="Price"
            className="w-24 rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            placeholder="Category"
            className="w-32 rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={draft.stock || ""}
            onChange={(e) => setDraft({ ...draft, stock: Number(e.target.value) })}
            placeholder="Qty"
            className="w-20 rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="relative flex-1 min-w-[160px]">
            <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={draft.barcode ?? ""}
              onChange={(e) => setDraft({ ...draft, barcode: e.target.value })}
              placeholder="Barcode (scan or type)"
              className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-11 text-sm"
            />
            <button
              type="button"
              onClick={() => setScanTarget("add")}
              className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90"
              aria-label="Scan with camera"
              title="Camera နဲ့ ဖတ်ရန်"
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={add}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-2xl border p-3 text-left transition ${filter === "all" ? "border-primary bg-primary-soft" : "border-border bg-card hover:bg-accent/40"}`}
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <PackageCheck className="h-3.5 w-3.5" /> အားလုံး
          </div>
          <div className="mt-1 text-lg font-semibold">{stats.totalSkus}</div>
          <div className="text-[11px] text-muted-foreground">စုစုပေါင်း {stats.totalUnits} ခု ကျန်</div>
        </button>
        <button
          onClick={() => setFilter("low")}
          className={`rounded-2xl border p-3 text-left transition ${filter === "low" ? "border-amber-500 bg-amber-500/10" : "border-border bg-card hover:bg-accent/40"}`}
        >
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" /> နည်းနေပြီ
          </div>
          <div className="mt-1 text-lg font-semibold">{stats.low}</div>
          <div className="text-[11px] text-muted-foreground">≤ {LOW_STOCK_THRESHOLD} ခု ကျန်</div>
        </button>
        <button
          onClick={() => setFilter("out")}
          className={`col-span-2 rounded-2xl border p-3 text-left transition sm:col-span-2 ${filter === "out" ? "border-destructive bg-destructive/10" : "border-border bg-card hover:bg-accent/40"}`}
        >
          <div className="flex items-center gap-2 text-xs text-destructive">
            <PackageX className="h-3.5 w-3.5" /> ကုန်သွားပြီ
          </div>
          <div className="mt-1 text-lg font-semibold">{stats.out}</div>
          <div className="text-[11px] text-muted-foreground">ဆက်လက် ဖြည့်ရန်လို</div>
        </button>
      </div>

      {visibleProducts.length === 0 && (
        <div className="mb-4 rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          ဒီ filter အတွက် ပစ္စည်း မရှိပါ။
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleProducts.map((p) => {
          const isEditing = editingId === p.id;
          if (isEditing && editDraft) {
            return (
              <div
                key={p.id}
                className="space-y-2 rounded-2xl border border-primary/40 bg-card p-3"
              >
                <div className="flex gap-2">
                  <label className="relative flex h-12 w-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-primary">
                    {editDraft.image ? (
                      <img src={editDraft.image} alt="preview" className="h-full w-full object-cover" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 cursor-pointer opacity-0"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setEditDraft({ ...editDraft, image: await fileToDataUrl(f) });
                      }}
                    />
                  </label>
                  <input
                    value={editDraft.emoji}
                    onChange={(e) => setEditDraft({ ...editDraft, emoji: e.target.value })}
                    className="w-14 rounded-xl border border-border bg-background px-2 py-2 text-center text-lg"
                  />
                  <input
                    value={editDraft.name}
                    onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                    className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    value={editDraft.price || ""}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, price: Number(e.target.value) })
                    }
                    placeholder="Price"
                    className="rounded-xl border border-border bg-background px-2 py-2 text-sm"
                  />
                  <input
                    value={editDraft.category}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, category: e.target.value })
                    }
                    placeholder="Category"
                    className="rounded-xl border border-border bg-background px-2 py-2 text-sm"
                  />
                  <input
                    type="number"
                    value={editDraft.stock ?? 0}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, stock: Number(e.target.value) })
                    }
                    placeholder="Qty"
                    className="rounded-xl border border-border bg-background px-2 py-2 text-sm"
                  />
                </div>
                <div className="relative">
                  <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={editDraft.barcode ?? ""}
                    onChange={(e) => setEditDraft({ ...editDraft, barcode: e.target.value })}
                    placeholder="Barcode"
                    className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-11 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setScanTarget("edit")}
                    className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90"
                    aria-label="Scan with camera"
                    title="Camera နဲ့ ဖတ်ရန်"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
                {editDraft.image && (
                  <button
                    type="button"
                    onClick={() => setEditDraft({ ...editDraft, image: "" })}
                    className="text-left text-[11px] text-muted-foreground hover:text-destructive"
                  >
                    ပုံဖျက်ရန်
                  </button>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={cancelEdit}
                    className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium"
                  >
                    <X className="h-3.5 w-3.5" /> Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  >
                    <Check className="h-3.5 w-3.5" /> Save
                  </button>
                </div>
              </div>
            );
          }
          const stockNum = p.stock ?? 0;
          const isOut = stockNum === 0;
          const isLow = !isOut && stockNum <= LOW_STOCK_THRESHOLD;
          return (
            <div
              key={p.id}
              className={`flex flex-col gap-3 rounded-2xl border bg-card p-3 ${isOut ? "border-destructive/60" : isLow ? "border-amber-500/60" : "border-border"}`}
            >
              {(isOut || isLow) && (
                <div
                  className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold ${isOut ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}
                >
                  {isOut ? (
                    <>
                      <PackageX className="h-3.5 w-3.5" /> ကုန်သွားပြီ — ဖြည့်ရန်လို
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5" /> နည်းနေပြီ — {stockNum} ခုသာ ကျန်
                    </>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft text-2xl">
                  {p.image ? (
                    <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    p.emoji
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.category} · {p.price.toLocaleString()}
                    {p.barcode ? ` · ${p.barcode}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => startEdit(p)}
                  className="text-muted-foreground hover:text-primary"
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => del(p.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground">Stock</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => changeStock(p.id, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-background text-foreground hover:bg-accent"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <input
                    type="number"
                    value={p.stock ?? 0}
                    onChange={(e) =>
                      persist(
                        products.map((x) =>
                          x.id === p.id
                            ? { ...x, stock: Math.max(0, Number(e.target.value)) }
                            : x,
                        ),
                      )
                    }
                    className="w-14 rounded-md border border-border bg-background px-2 py-1 text-center text-sm font-semibold"
                  />
                  <button
                    onClick={() => changeStock(p.id, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <BarcodeScanner
        open={scanTarget !== null}
        onClose={() => setScanTarget(null)}
        onDetected={(code) => {
          if (scanTarget === "add") {
            setDraft((d) => ({ ...d, barcode: code }));
          } else if (scanTarget === "edit" && editDraft) {
            setEditDraft({ ...editDraft, barcode: code });
          }
          setScanTarget(null);
        }}
      />
    </Shell>
  );
}
