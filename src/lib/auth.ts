import { supabase } from "./supabase";

type TenantDetails = {
  name?: string | null;
  status?: UserProfile["tenant_status"];
  subscription_ends_at?: string | null;
};

export interface UserProfile {
  id: string;
  email: string;
  role: "super_admin" | "owner" | "staff";
  tenant_id: string | null;
  tenant_status?: "active" | "suspended" | "inactive" | "pending";
  tenant_name?: string;
  subscription_ends_at?: string | null;
  active?: boolean;
}

export const auth = {
  // Get active session
  getSession: async () => {
    if (!supabase) return null;
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) {
      console.error("Error getting session:", error);
      return null;
    }
    return session;
  },

  // Get current user profile and tenant details
  getUserProfile: async (): Promise<UserProfile | null> => {
    if (!supabase) return null;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(
          `
          id,
          email,
          role,
          tenant_id,
          active,
            tenants (
              name,
              status,
              subscription_ends_at
            )
        `,
        )
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        return null;
      }

      const tenantsData = profile.tenants as unknown as TenantDetails | null;

      return {
        id: profile.id,
        email: profile.email,
        role: profile.role as UserProfile["role"],
        tenant_id: profile.tenant_id,
        tenant_status: tenantsData?.status || "active",
        tenant_name: tenantsData?.name || "My Shop",
        subscription_ends_at: tenantsData?.subscription_ends_at ?? null,
        active: profile.active !== false,
      };
    } catch (err) {
      console.error("Failed to load user profile:", err);
      return null;
    }
  },

  // Login
  login: async (
    email: string,
    pinOrPassword: string,
    captchaToken?: string,
  ) => {
    if (!supabase) {
      throw new Error(
        "Supabase configuration မရှိသေးပါ။ .env တွင် production credentials ထည့်ပေးပါ။",
      );
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pinOrPassword,
      options: captchaToken ? { captchaToken } : undefined,
    });

    if (error) throw error;
    return data;
  },

  // Logout
  logout: async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Error signing out:", error);
    // Clear lock status
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("pos.unlocked");
    }
  },
};
