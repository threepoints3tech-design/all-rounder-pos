import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Shell } from "@/components/pos/Shell";
import { store, type Sale, type Settings, defaultSettings } from "@/lib/pos-store";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Sales History – POS" },
      { name: "description", content: "View past sales and transactions." },
    ],
  }),
  component: TransactionsPage,
});

type Period = "day" | "month" | "year";

function TransactionsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [period, setPeriod] = useState<Period>("day");
  const [dateStr, setDateStr] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  useEffect(() => {
    store.getSales().then(setSales);
    store.getSettings().then(setSettings);
  }, []);

  const fmt = (n: number) => `${settings.currency} ${n.toLocaleString()}`;

  const selected = useMemo(() => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return { y, m: m - 1, d };
  }, [dateStr]);

  const periodLabel = useMemo(() => {
    const dt = new Date(selected.y, selected.m, selected.d);
    if (period === "day") return dt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    if (period === "month") return dt.toLocaleDateString(undefined, { year: "numeric", month: "long" });
    return String(selected.y);
  }, [period, selected]);

  const filtered = useMemo(() => {
    return sales.filter((s) => {
      const d = new Date(s.date);
      if (d.getFullYear() !== selected.y) return false;
      if (period === "year") return true;
      if (d.getMonth() !== selected.m) return false;
      if (period === "month") return true;
      return d.getDate() === selected.d;
    });
  }, [sales, selected, period]);

  const stats = useMemo(() => {
    const revenue = filtered.reduce((s, x) => s + x.total, 0);
    const items = filtered.reduce((s, x) => s + x.items.reduce((a, i) => a + i.qty, 0), 0);
    return { revenue, items, orders: filtered.length };
  }, [filtered]);

  const bestSellers = useMemo(() => {
    const map = new Map<string, { name: string; emoji: string; qty: number; revenue: number }>();
    filtered.forEach((s) =>
      s.items.forEach((i) => {
        const cur = map.get(i.id) ?? { name: i.name, emoji: i.emoji, qty: 0, revenue: 0 };
        cur.qty += i.qty;
        cur.revenue += i.qty * i.price;
        map.set(i.id, cur);
      }),
    );
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }, [filtered]);

  const exportPDF = () => {
    const doc = new jsPDF();
    const title = `${settings.shopName} — Sales Report`;
    doc.setFontSize(16);
    doc.text(title, 14, 18);
    doc.setFontSize(11);
    doc.text(`Period: ${period.toUpperCase()} — ${periodLabel}`, 14, 26);
    doc.text(
      `Orders: ${stats.orders}   Items: ${stats.items}   Revenue: ${fmt(stats.revenue)}`,
      14,
      33,
    );

    autoTable(doc, {
      startY: 40,
      head: [["#", "Product", "Sold", "Revenue"]],
      body: bestSellers.map((b, i) => [
        i + 1,
        b.name,
        b.qty,
        `${settings.currency} ${b.revenue.toLocaleString()}`,
      ]),
      headStyles: { fillColor: [30, 30, 30] },
    });

    const afterBest = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    doc.setFontSize(13);
    doc.text("Orders", 14, afterBest);

    autoTable(doc, {
      startY: afterBest + 4,
      head: [["Order", "Date", "Items", "Total"]],
      body: filtered.map((s) => [
        s.id.split("-")[0],
        new Date(s.date).toLocaleString(),
        s.items.map((i) => `${i.name} x${i.qty}`).join(", "),
        `${settings.currency} ${s.total.toLocaleString()}`,
      ]),
      headStyles: { fillColor: [30, 30, 30] },
      styles: { fontSize: 9, cellWidth: "wrap" },
      columnStyles: { 2: { cellWidth: 80 } },
    });

    doc.save(`sales-${period}-${dateStr}.pdf`);
  };

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sales & Reports</h1>
          <p className="text-sm text-muted-foreground">{sales.length} total transactions</p>
        </div>
        <button
          onClick={exportPDF}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
        >
          <Download className="h-4 w-4" /> Export PDF
        </button>
      </div>

      {/* Period selector */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <div className="inline-flex rounded-xl bg-secondary p-1">
          {(["day", "month", "year"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
                period === p ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          type="date"
          value={dateStr}
          onChange={(e) => setDateStr(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        />
        <span className="ml-auto text-sm text-muted-foreground">{periodLabel}</span>
      </div>

      {/* Summary */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-primary-soft p-4">
          <p className="text-xs text-muted-foreground">Revenue</p>
          <p className="mt-1 text-2xl font-bold">{fmt(stats.revenue)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Orders</p>
          <p className="mt-1 text-2xl font-bold">{stats.orders}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Items Sold</p>
          <p className="mt-1 text-2xl font-bold">{stats.items}</p>
        </div>
      </div>

      {/* Best sellers */}
      <div className="mb-6 rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Best Sellers</h2>
          <span className="text-xs text-muted-foreground">{periodLabel}</span>
        </div>
        {bestSellers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No sales in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="w-10 py-2">#</th>
                  <th className="py-2">Product</th>
                  <th className="py-2 text-right">Sold</th>
                  <th className="py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {bestSellers.slice(0, 10).map((b, idx) => (
                  <tr key={b.name} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 font-semibold text-muted-foreground">{idx + 1}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{b.emoji}</span>
                        <span className="font-medium">{b.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-semibold">{b.qty}</td>
                    <td className="py-2.5 text-right">{fmt(b.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Orders */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Orders</h2>
        <span className="text-sm text-muted-foreground">
          Total: <span className="font-semibold text-foreground">{fmt(stats.revenue)}</span>
        </span>
      </div>
      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No sales in this period.</p>
        )}
        {filtered.map((s) => (
          <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="font-semibold">Order {s.id.split("-")[0]}</p>
                <p className="text-xs text-muted-foreground">{new Date(s.date).toLocaleString()}</p>
              </div>
              <p className="text-lg font-bold">{fmt(s.total)}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {s.items.map((i) => (
                <span
                  key={i.id}
                  className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground"
                >
                  {i.emoji} {i.name} × {i.qty}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
