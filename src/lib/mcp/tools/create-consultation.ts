import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_consultation",
  title: "Create consultation",
  description: "Book a consultation request for the signed-in client.",
  inputSchema: {
    title: z.string().trim().min(1).max(200).describe("Short topic or title for the consultation."),
    notes: z.string().trim().max(2000).optional().describe("Additional details or questions."),
    scheduled_at: z.string().datetime().optional().describe("Preferred ISO 8601 date/time (e.g. 2026-08-10T14:00:00Z)."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ title, notes, scheduled_at }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const userId = ctx.getUserId()!;
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("consultations")
      .insert({
        user_id: userId,
        title,
        notes: notes ?? null,
        scheduled_at: scheduled_at ?? null,
        status: "scheduled",
      })
      .select("id, title, notes, scheduled_at, status, created_at")
      .single();

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return { content: [{ type: "text", text: `Consultation booked: ${JSON.stringify(data, null, 2)}` }] };
  },
});
