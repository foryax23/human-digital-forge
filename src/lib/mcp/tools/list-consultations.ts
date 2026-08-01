import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_consultations",
  title: "List consultations",
  description: "List consultations booked by the signed-in client.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Maximum consultations to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit = 50 }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const userId = ctx.getUserId()!;
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("consultations")
      .select("id, title, notes, scheduled_at, status, created_at")
      .eq("user_id", userId)
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }] };
  },
});
