import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_invoices",
  title: "List invoices",
  description: "List invoices issued to the signed-in client.",
  inputSchema: {
    status: z.string().optional().describe("Filter by invoice status (e.g. paid, open, draft)."),
    limit: z.number().int().min(1).max(100).optional().describe("Maximum invoices to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit = 50 }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const userId = ctx.getUserId()!;
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("invoices")
      .select("id, invoice_number, description, amount_cents, currency, status, issued_at, due_at, paid_at, created_at")
      .eq("user_id", userId)
      .order("issued_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }] };
  },
});
