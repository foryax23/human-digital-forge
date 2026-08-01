import { auth, defineMcp } from "@lovable.dev/mcp-js";

import getProfileTool from "./tools/get-profile";
import listProjectsTool from "./tools/list-projects";
import createProjectTool from "./tools/create-project";
import listMessagesTool from "./tools/list-messages";
import sendMessageTool from "./tools/send-message";
import listFilesTool from "./tools/list-files";
import listConsultationsTool from "./tools/list-consultations";
import createConsultationTool from "./tools/create-consultation";
import listInvoicesTool from "./tools/list-invoices";
import getSubscriptionTool from "./tools/get-subscription";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "vortex-hub",
  title: "Vortex Hub",
  version: "0.1.0",
  instructions:
    "Tools for Vortex Hub clients. Use these to read profile, projects, messages, files, consultations, invoices and subscription, or to create new project requests, send messages and book consultations. All tools act as the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getProfileTool,
    listProjectsTool,
    createProjectTool,
    listMessagesTool,
    sendMessageTool,
    listFilesTool,
    listConsultationsTool,
    createConsultationTool,
    listInvoicesTool,
    getSubscriptionTool,
  ],
});
