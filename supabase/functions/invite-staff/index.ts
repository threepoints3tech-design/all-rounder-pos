import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST")
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey)
      throw new Error("Supabase function secrets are not configured");

    const authorization = request.headers.get("Authorization");
    if (!authorization)
      return new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders,
      });

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } =
      await callerClient.auth.getUser();
    if (userError || !userData.user)
      return new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders,
      });

    const { invite_id: inviteId } = await request.json();
    if (typeof inviteId !== "string")
      return new Response("invite_id is required", {
        status: 400,
        headers: corsHeaders,
      });

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: owner, error: ownerError } = await adminClient
      .from("profiles")
      .select("id, tenant_id, role, active")
      .eq("id", userData.user.id)
      .single();
    if (
      ownerError ||
      !owner ||
      owner.role !== "owner" ||
      !owner.active ||
      !owner.tenant_id
    ) {
      return new Response("Only an active shop owner can invite staff", {
        status: 403,
        headers: corsHeaders,
      });
    }

    const { data: invite, error: inviteError } = await adminClient
      .from("staff_invites")
      .select("id, email, tenant_id, status, expires_at, created_by")
      .eq("id", inviteId)
      .eq("tenant_id", owner.tenant_id)
      .eq("created_by", owner.id)
      .single();
    if (
      inviteError ||
      !invite ||
      invite.status !== "pending" ||
      new Date(invite.expires_at).getTime() <= Date.now()
    ) {
      return new Response("Invitation is unavailable or expired", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { error: inviteUserError } =
      await adminClient.auth.admin.inviteUserByEmail(invite.email, {
        data: { tenant_id: owner.tenant_id },
        redirectTo: Deno.env.get("SITE_URL"),
      });
    if (inviteUserError) throw inviteUserError;

    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to send invitation",
      },
      { status: 400, headers: corsHeaders },
    );
  }
});
