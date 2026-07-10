import { supabase } from "./supabase";

export interface UserProfile {
  id: string;
  email: string;
  role: "super_admin" | "owner" | "staff";
  tenant_id: string | null;
  tenant_status?: "active" | "suspended" | "inactive";
  tenant_name?: string;
}

export const auth = {
  // Get active session
  getSession: async () => {
    if (!supabase) return null;
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error("Error getting session:", error);
      return null;
    }
    return session;
  },

  // Get current user profile and tenant details
  getUserProfile: async (): Promise<UserProfile | null> => {
    if (!supabase) {
      // Offline / Local storage fallback mode dummy profile
      return {
        id: "offline-user",
        email: "offline@pos.local",
        role: "owner",
        tenant_id: null,
        tenant_status: "active",
        tenant_name: "Local Shop",
      };
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(`
          id,
          email,
          role,
          tenant_id,
          tenants (
            name,
            status
          )
        `)
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        return {
          id: user.id,
          email: user.email || "",
          role: "owner",
          tenant_id: null,
          tenant_status: "active",
        };
      }

      const tenantsData = profile.tenants as any;

      return {
        id: profile.id,
        email: profile.email,
        role: profile.role as any,
        tenant_id: profile.tenant_id,
        tenant_status: tenantsData?.status || "active",
        tenant_name: tenantsData?.name || "My Shop",
      };
    } catch (err) {
      console.error("Failed to load user profile:", err);
      return null;
    }
  },

  // Login
  login: async (email: string, pinOrPassword: string) => {
    if (!supabase) {
      // Local bypass
      if (pinOrPassword === "1234") return { user: { id: "offline" } };
      throw new Error("Invalid password");
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pinOrPassword,
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
