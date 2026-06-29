import { createServerFn } from "@tanstack/react-start";

/**
 * Reports which workspace-level connectors have credentials wired up.
 * Returns booleans only — never secret values. Safe to call from anywhere.
 *
 * Storage providers (Google Drive, OneDrive, SharePoint) are configured as
 * shared workspace connectors so reps can pull from a single company folder
 * without each user linking a personal account.
 */
export const getWorkspaceIntegrationStatus = createServerFn({ method: "GET" }).handler(async () => {
  return {
    zoho_books: Boolean(process.env.ZOHO_BOOKS_API_KEY),
    zoho_crm: Boolean(process.env.ZOHO_CRM_API_KEY),
    google_drive: Boolean(process.env.GOOGLE_DRIVE_API_KEY),
    microsoft_onedrive: Boolean(process.env.MICROSOFT_ONEDRIVE_API_KEY),
    microsoft_sharepoint: Boolean(process.env.MICROSOFT_SHAREPOINT_API_KEY),
  };
});
