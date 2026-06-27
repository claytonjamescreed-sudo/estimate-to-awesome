import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  submitter_name: z.string().trim().min(1, "Name is required").max(100),
  submitter_email: z.string().trim().email("Valid email required").max(255),
  type: z.enum(["bug", "feature", "other"]),
  title: z.string().trim().min(3, "Add a short title").max(140),
  description: z.string().trim().min(10, "Tell us a bit more").max(4000),
  page_url: z.string().trim().max(500).optional().or(z.literal("")),
});

type RequestType = "bug" | "feature" | "other";

interface Props {
  onSubmitted?: () => void;
  compact?: boolean;
}

export function FeedbackForm({ onSubmitted, compact }: Props) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    submitter_name: (user?.user_metadata?.full_name as string) || "",
    submitter_email: user?.email || "",
    type: "bug" as RequestType,
    title: "",
    description: "",
    page_url: typeof window !== "undefined" ? window.location.href : "",
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("client_requests").insert({
      ...parsed.data,
      page_url: parsed.data.page_url || null,
      submitter_user_id: user?.id ?? null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Couldn't submit — please try again.");
      return;
    }
    toast.success("Thanks! Your request has been logged.");
    setForm((f) => ({ ...f, title: "", description: "" }));
    onSubmitted?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!compact && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="fb-name">Your name</Label>
            <Input
              id="fb-name"
              value={form.submitter_name}
              onChange={(e) => update("submitter_name", e.target.value)}
              required
              maxLength={100}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fb-email">Email</Label>
            <Input
              id="fb-email"
              type="email"
              value={form.submitter_email}
              onChange={(e) => update("submitter_email", e.target.value)}
              required
              maxLength={255}
            />
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-[160px_1fr] gap-4">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={form.type} onValueChange={(v) => update("type", v as RequestType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bug">Bug</SelectItem>
              <SelectItem value="feature">Feature request</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fb-title">Summary</Label>
          <Input
            id="fb-title"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="One-line summary"
            required
            maxLength={140}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="fb-desc">Details</Label>
        <Textarea
          id="fb-desc"
          rows={5}
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="What happened, what you expected, steps to reproduce…"
          required
          maxLength={4000}
        />
      </div>

      <Button type="submit" disabled={submitting} className="bg-accent text-accent-foreground hover:bg-accent/90">
        {submitting ? "Sending…" : "Submit request"}
      </Button>
    </form>
  );
}
