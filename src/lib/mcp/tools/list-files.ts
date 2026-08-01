import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_files",
  title: "List files",
  description: "List project files uploaded for the signed-in client.",
  inputSchema: {
    project_id: z.string().uuid().optional().describe("Filter files for a specific project."),
    limit: z.number().int().min(1).max(100).optional().describe("Maximum files to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id, limit = 50 }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const userId = ctx.getUserId()!;
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("project_files")
      .select("id, project_id, name, description, size_bytes, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (project_id) {
      query = query.eq("project_id", project_id);
    }

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }] };
  },
});
