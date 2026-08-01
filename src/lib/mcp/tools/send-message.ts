import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "send_message",
  title: "Send message",
  description: "Send a message to the Vortex Hub team from the signed-in client.",
  inputSchema: {
    body: z.string().trim().min(1).max(4000).describe("Message content."),
    project_id: z.string().uuid().optional().describe("Optional project this message relates to."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ body, project_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const userId = ctx.getUserId()!;
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("messages")
      .insert({
        user_id: userId,
        project_id: project_id ?? null,
        sender: "client",
        body,
        read: false,
      })
      .select("id, project_id, body, created_at")
      .single();

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return { content: [{ type: "text", text: `Message sent: ${JSON.stringify(data, null, 2)}` }] };
  },
});
