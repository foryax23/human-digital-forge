import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_subscription",
  title: "Get subscription",
  description: "Return the signed-in client's active Vortex Hub subscription tier and status.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("subscribers")
      .select("id, email, tier, status, current_period_end, created_at, updated_at")
      .eq("user_id", ctx.getUserId())
      .maybeSingle();

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    if (!data) {
      return { content: [{ type: "text", text: "No subscription found" }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});
