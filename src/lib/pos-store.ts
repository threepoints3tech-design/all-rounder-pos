export type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  emoji: string;
  stock?: number;
  image?: string;
  barcode?: string;
};

export type CartItem = Product & { qty: number };

export type Sale = {
  id: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
};

async function getProductsKey(): Promise<string> {
  const tenantId = await getTenantId();
  return tenantId ? `pos.products.${tenantId}` : "pos.products.default";
}

async function getSalesKey(): Promise<string> {
  const tenantId = await getTenantId();
  return tenantId ? `pos.sales.${tenantId}` : "pos.sales.default";
}

async function getSettingsKey(): Promise<string> {
  const tenantId = await getTenantId();
  return tenantId ? `pos.settings.${tenantId}` : "pos.settings.default";
}

export type Settings = {
  shopName: string;
  currency: string;
  taxRate: number; // percent
  ownerName?: string;
  pinHash?: string; // sha-256 hex; empty/undefined = no lock
};

export const defaultSettings: Settings = {
  shopName: "My Shop",
  currency: "Ks",
  taxRate: 5,
  ownerName: "",
  pinHash: "",
};

export const defaultCategories = [
  "General",
  "Food",
  "Drinks",
  "Clothing",
  "Medicine",
  "Grocery",
];

export const seedProducts: Product[] = [
  { id: "p1", name: "T-Shirt", price: 8000, category: "Clothing", emoji: "👕", stock: 20 },
  { id: "p2", name: "Jeans", price: 15000, category: "Clothing", emoji: "👖", stock: 15 },
  { id: "p3", name: "Bread", price: 1500, category: "Food", emoji: "🍞", stock: 30 },
  { id: "p4", name: "Cake", price: 5000, category: "Food", emoji: "🎂", stock: 10 },
  { id: "p5", name: "Coffee", price: 2500, category: "Drinks", emoji: "☕", stock: 50 },
  { id: "p6", name: "Water", price: 500, category: "Drinks", emoji: "💧", stock: 100 },
  { id: "p7", name: "Paracetamol", price: 1000, category: "Medicine", emoji: "💊", stock: 40 },
  { id: "p8", name: "Vitamin C", price: 3000, category: "Medicine", emoji: "🧴", stock: 25 },
  { id: "p9", name: "Rice 1kg", price: 3500, category: "Grocery", emoji: "🌾", stock: 60 },
  { id: "p10", name: "Egg (10)", price: 4500, category: "Grocery", emoji: "🥚", stock: 40 },
  { id: "p11", name: "Milk", price: 2800, category: "Drinks", emoji: "🥛", stock: 30 },
  { id: "p12", name: "Snack", price: 1200, category: "Food", emoji: "🍪", stock: 45 },
];

import { supabase } from "./supabase";
import { auth } from "./auth";

async function getTenantId(): Promise<string | null> {
  const profile = await auth.getUserProfile();
  return profile ? profile.tenant_id : null;
}

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

// Check if Supabase is configured and successfully initialized
const hasSupabase = supabase !== null;

function isSuspended(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("pos.suspended") === "true";
}

export const store = {
  getTenantId: async (): Promise<string | null> => {
    return getTenantId();
  },
  getProducts: async (): Promise<Product[]> => {
    if (isSuspended()) {
      throw new Error("Account suspended");
    }
    const pKey = await getProductsKey();
    const tenantId = await getTenantId();
    if (!hasSupabase || !tenantId) {
      return readLocal<Product[]>(pKey, seedProducts);
    }
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true });

      if (error) throw error;
      writeLocal(pKey, data); // Update cache
      return data as Product[];
    } catch (err) {
      console.warn("Supabase fetch products failed:", err);
      throw err;
    }
  },

  setProducts: async (products: Product[]) => {
    if (isSuspended()) {
      throw new Error("Account suspended");
    }
    const pKey = await getProductsKey();
    const tenantId = await getTenantId();
    // Keep local storage updated as cache / fallback
    writeLocal(pKey, products);

    if (!hasSupabase || !tenantId) return;
    try {
      const ids = products.map((p) => p.id);
      
      // 1. Delete products in the DB that belong to this tenant and are not in the new list
      if (ids.length > 0) {
        const { error: delError } = await supabase
          .from("products")
          .delete()
          .eq("tenant_id", tenantId)
          .not("id", "in", `(${ids.join(",")})`);
        if (delError) throw delError;
      } else {
        const { error: delAllError } = await supabase
          .from("products")
          .delete()
          .eq("tenant_id", tenantId);
        if (delAllError) throw delAllError;
      }

      // 2. Upsert the current list of products with tenant_id injected (omitting created_at to avoid null value constraint errors)
      const productsWithTenant = products.map((p: any) => {
        const { created_at, ...rest } = p;
        return { ...rest, tenant_id: tenantId };
      });
      const { error: upsertError } = await supabase
        .from("products")
        .upsert(productsWithTenant);
      if (upsertError) throw upsertError;
    } catch (err) {
      console.error("Supabase setProducts failed:", err);
      throw err;
    }
  },

  getSales: async (): Promise<Sale[]> => {
    if (isSuspended()) {
      throw new Error("Account suspended");
    }
    const sKey = await getSalesKey();
    const tenantId = await getTenantId();
    if (!hasSupabase || !tenantId) {
      return readLocal<Sale[]>(sKey, []);
    }
    try {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          id,
          date,
          subtotal,
          tax,
          total,
          items:sale_items(
            id:product_id,
            name,
            price,
            category,
            emoji,
            qty
          )
        `)
        .eq("tenant_id", tenantId)
        .order("date", { ascending: false });

      if (error) throw error;
      writeLocal(sKey, data); // Update cache
      return data as unknown as Sale[];
    } catch (err) {
      console.warn("Supabase fetch sales failed:", err);
      throw err;
    }
  },

  addSale: async (sale: Sale) => {
    if (isSuspended()) {
      throw new Error("Account suspended");
    }
    const sKey = await getSalesKey();
    const tenantId = await getTenantId();
    // Keep local storage updated
    const localSales = readLocal<Sale[]>(sKey, []);
    writeLocal(sKey, [sale, ...localSales]);

    if (!hasSupabase || !tenantId) return;
    try {
      // 1. Insert transaction into sales
      const { error: saleError } = await supabase.from("sales").insert({
        id: sale.id,
        date: sale.date,
        subtotal: sale.subtotal,
        tax: sale.tax,
        total: sale.total,
        tenant_id: tenantId,
      });
      if (saleError) throw saleError;

      // 2. Insert items
      const itemsToInsert = sale.items.map((item) => ({
        sale_id: sale.id,
        product_id: item.id,
        name: item.name,
        price: item.price,
        qty: item.qty,
        emoji: item.emoji,
        category: item.category,
      }));

      const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(itemsToInsert);
      if (itemsError) throw itemsError;
    } catch (err) {
      console.error("Supabase addSale failed:", err);
      throw err;
    }
  },

  getSettings: async (): Promise<Settings> => {
    if (isSuspended()) {
      throw new Error("Account suspended");
    }
    const setKey = await getSettingsKey();
    const tenantId = await getTenantId();
    if (!hasSupabase || !tenantId) {
      return readLocal<Settings>(setKey, defaultSettings);
    }
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Create settings row for this tenant if none exists
        await supabase.from("settings").insert({
          id: 1,
          tenant_id: tenantId,
          shop_name: defaultSettings.shopName,
          currency: defaultSettings.currency,
          tax_rate: defaultSettings.taxRate,
        });
        writeLocal(setKey, defaultSettings);
        return defaultSettings;
      }

      const settingsObj = {
        shopName: data.shop_name,
        currency: data.currency,
        taxRate: Number(data.tax_rate),
        ownerName: data.owner_name,
        pinHash: data.pin_hash,
      };
      writeLocal(setKey, settingsObj); // Update cache
      return settingsObj;
    } catch (err) {
      console.warn("Supabase fetch settings failed:", err);
      throw err;
    }
  },

  setSettings: async (s: Settings) => {
    if (isSuspended()) {
      throw new Error("Account suspended");
    }
    const setKey = await getSettingsKey();
    const tenantId = await getTenantId();
    // Keep local storage updated
    writeLocal(setKey, s);

    if (!hasSupabase || !tenantId) return;
    try {
      const { error } = await supabase.from("settings").upsert({
        id: 1,
        tenant_id: tenantId,
        shop_name: s.shopName,
        currency: s.currency,
        tax_rate: s.taxRate,
        owner_name: s.ownerName,
        pin_hash: s.pinHash,
      });
      if (error) throw error;
    } catch (err) {
      console.error("Supabase setSettings failed:", err);
      throw err;
    }
  },
};

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const UNLOCK_KEY = "pos.unlocked";
export const lock = {
  isUnlocked: () => {
    if (typeof window === "undefined") return true;
    return window.sessionStorage.getItem(UNLOCK_KEY) === "1";
  },
  setUnlocked: (v: boolean) => {
    if (typeof window === "undefined") return;
    if (v) window.sessionStorage.setItem(UNLOCK_KEY, "1");
    else window.sessionStorage.removeItem(UNLOCK_KEY);
  },
};


