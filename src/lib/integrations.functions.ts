import { createServerFn } from "@tanstack/react-start";

/**
 * Reports which workspace-level connectors have credentials wired up.
 * Safe to call from anywhere — only returns booleans, never secret values.
 */
export const getWorkspaceIntegrationStatus = createServerFn({ method: "GET" }).handler(async () => {
  return {
    zoho_books: Boolean(process.env.ZOHO_BOOKS_API_KEY),
    zoho_crm: Boolean(process.env.ZOHO_CRM_API_KEY),
  };
});
