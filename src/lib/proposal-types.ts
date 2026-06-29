export type ProposalStatus = "draft" | "sent" | "won" | "lost" | "archived";

export interface LineItem {
  id: string;
  qty: number;
  make: string;
  model: string;
  description: string;
  unit_price: number;
}

export interface LineSection {
  id: string;
  name: string;
  items: LineItem[];
}

export interface FeaturedProduct {
  id: string;
  name: string;
  tagline: string;
  image_url: string;
  highlights: string[]; // bullet list of key specs / benefits
  link: string;
}

export interface ClientSpotlight {
  enabled: boolean;
  logo_url: string;
  industry: string;
  hq: string;
  size: string;
  about: string;
  challenge: string;
  why_us: string;
}

export interface ProposalContent {
  cover: {
    enabled: boolean;
    headline: string;
    subheadline: string;
    client_name: string;
    project_name: string;
    prepared_for: string;
    prepared_by: string;
    date: string; // ISO
    reference: string;
  };
  exec_summary: { enabled: boolean; body: string };
  scope: { enabled: boolean; bullets: string[] };
  line_items: { enabled: boolean; sections: LineSection[]; tax_rate: number };
  investment: { enabled: boolean; note: string };
  terms: { enabled: boolean; preset: "standard" | "custom"; body: string };
  appendix: { enabled: boolean; title: string; body: string };
}

export interface ProposalRow {
  id: string;
  owner_id: string;
  client_id: string | null;
  title: string;
  project_code: string | null;
  status: ProposalStatus;
  total_amount: number;
  currency: string;
  content: ProposalContent;
  sent_at: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientRow {
  id: string;
  owner_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
