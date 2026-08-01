import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_project",
  title: "Create project",
  description: "Submit a new project request for the signed-in client.",
  inputSchema: {
    title: z.string().trim().min(1).max(200).describe("Short project title."),
    description: z.string().trim().min(1).max(4000).describe("Brief describing what the client needs."),
    service_type: z.enum(["digital-product", "website", "ai-automation", "consultancy", "not-sure"]).optional().describe("Service category."),
    budget: z.string().max(120).optional().describe("Approximate budget range."),
    timeline: z.string().max(120).optional().describe("Preferred timeline."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ title, description, service_type, budget, timeline }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: ctx.getUserId(),
        title,
        description,
        service_type: service_type ?? null,
        budget: budget ?? null,
        timeline: timeline ?? null,
        status: "Request submitted",
        current_step: 0,
        next_action: "We will review your brief shortly",
      })
      .select("id, title, service_type, status, created_at")
      .single();

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return { content: [{ type: "text", text: `Project created: ${JSON.stringify(data, null, 2)}` }] };
  },
});
