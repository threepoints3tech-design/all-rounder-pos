import type { Sale, Settings } from "./pos-store";

const escapeHtml = (value: string | number | undefined) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export function printReceipt(sale: Sale, settings: Settings) {
  if (typeof window === "undefined") return;

  const receiptWindow = window.open("", "pos-receipt", "width=420,height=680");
  if (!receiptWindow) {
    throw new Error(
      "Receipt window ကို ဖွင့်မရပါ။ Browser popup permission ကို ဖွင့်ပေးပါ။",
    );
  }

  const money = (amount: number | undefined) =>
    `${escapeHtml(settings.currency)} ${Number(amount ?? 0).toLocaleString()}`;
  const receiptNo = sale.displayNumber
    ? `#${String(sale.displayNumber).padStart(6, "0")}`
    : sale.id.split("-")[0];
  const rows = sale.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)} × ${escapeHtml(item.qty)}</td>
          <td class="right">${money(item.price * item.qty)}</td>
        </tr>`,
    )
    .join("");

  receiptWindow.document.write(`<!doctype html>
    <html><head><title>Receipt ${escapeHtml(receiptNo)}</title>
    <style>
      @page { margin: 12mm; }
      body { font-family: system-ui, sans-serif; color: #111; font-size: 12px; max-width: 320px; margin: 0 auto; }
      h1, p { margin: 0; } h1 { font-size: 18px; } .center { text-align: center; }
      .muted { color: #666; margin-top: 4px; } .rule { border-top: 1px dashed #777; margin: 14px 0; }
      table { width: 100%; border-collapse: collapse; } td { padding: 4px 0; vertical-align: top; } .right { text-align: right; }
      .total { font-weight: 700; font-size: 15px; } .footer { margin-top: 16px; text-align: center; color: #555; }
    </style></head><body>
      <div class="center"><h1>${escapeHtml(settings.shopName)}</h1>
        <p class="muted">Receipt ${escapeHtml(receiptNo)}</p>
        <p class="muted">${escapeHtml(new Date(sale.date).toLocaleString())}</p>
      </div>
      <div class="rule"></div>
      <table>${rows}</table>
      <div class="rule"></div>
      <table>
        <tr><td>Subtotal</td><td class="right">${money(sale.subtotal)}</td></tr>
        <tr><td>Tax</td><td class="right">${money(sale.tax)}</td></tr>
        <tr class="total"><td>Total</td><td class="right">${money(sale.total)}</td></tr>
        <tr><td>Payment</td><td class="right">${escapeHtml(sale.paymentMethod ?? "cash")}</td></tr>
        ${sale.paymentMethod === "cash" ? `<tr><td>Received</td><td class="right">${money(sale.amountTendered)}</td></tr><tr><td>Change</td><td class="right">${money(sale.changeAmount)}</td></tr>` : ""}
      </table>
      <p class="footer">Thank you for shopping with us.</p>
      <script>window.onload = () => { window.print(); };</script>
    </body></html>`);
  receiptWindow.document.close();
}
