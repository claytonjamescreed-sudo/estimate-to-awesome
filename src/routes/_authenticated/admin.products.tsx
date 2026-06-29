import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/products")({
  beforeLoad: () => {
    throw redirect({ to: "/integrations", replace: true });
  },
});