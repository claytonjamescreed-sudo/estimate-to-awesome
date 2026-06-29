import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  make: z.string().default(""),
  model: z.string().default(""),
  description: z.string().default(""),
});

export interface EnrichedProduct {
  name: string;
  tagline: string;
  image_url: string;
  link: string;
  highlights: string[];
}

function absolutize(href: string, base: string): string {
  try { return new URL(href, base).toString(); } catch { return href; }
}

function pick(html: string, re: RegExp): string {
  const m = html.match(re);
  return m ? m[1].trim() : "";
}

function extractPageMeta(html: string, baseUrl: string) {
  const ogImage =
    pick(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    pick(html, /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  const description =
    pick(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    pick(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const title = pick(html, /<title[^>]*>([^<]+)<\/title>/i);
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);
  return {
    title,
    description,
    image_url: ogImage ? absolutize(ogImage, baseUrl) : "",
    text,
  };
}

async function safeFetch(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; GOSAVI-ProposalBot/1.0)",
        accept: "text/html,*/*",
      },
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

async function aiJson(apiKey: string, system: string, user: string): Promise<Record<string, unknown>> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`AI failed: ${res.status} ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(content); } catch { return {}; }
}

export const enrichProduct = createServerFn({ method: "POST" })
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<EnrichedProduct> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured");

    const make = data.make.trim();
    const model = data.model.trim();
    const fullName = [make, model].filter(Boolean).join(" ") || data.description.slice(0, 80);

    // Step 1 — ask AI for the most likely manufacturer product page URL
    const step1 = await aiJson(
      apiKey,
      `You are a product research assistant. You only return the canonical manufacturer product page URL for a given make + model.
Respond as JSON: { "url": "https://manufacturer.com/...", "manufacturer_domain": "manufacturer.com" }.
If you are not confident, return { "url": "", "manufacturer_domain": "" }. Do NOT guess random URLs.`,
      `Make: ${make}
Model: ${model}
Description: ${data.description}

Return the official manufacturer product page (not Amazon, not a reseller). For Logitech use logitech.com, Crestron crestron.com, Q-SYS qsys.com, Shure shure.com, Poly poly.com, Cisco cisco.com, Biamp biamp.com, AVer aver.com, Yealink yealink.com, etc.`,
    );

    const candidateUrl = typeof step1.url === "string" ? step1.url : "";

    // Step 2 — fetch the page (best-effort) to ground image + tagline
    let page = { title: "", description: "", image_url: "", text: "" };
    let finalLink = candidateUrl;
    if (candidateUrl) {
      const html = await safeFetch(candidateUrl);
      if (html) page = extractPageMeta(html, candidateUrl);
    }

    // Step 3 — synthesize the proposal card from page text + AI
    const step3 = await aiJson(
      apiKey,
      `You write concise B2B AV product cards for sales proposals. Be factual; never invent specs. If the source is thin, write a short, neutral tagline based only on the make/model.
Respond as JSON with: name, tagline, highlights (array of 3-5 short bullet strings), link.`,
      `Product: ${fullName}
Make: ${make}
Model: ${model}
Estimate description: ${data.description}

Manufacturer page URL: ${finalLink || "(unknown)"}
Page title: ${page.title}
Page meta: ${page.description}
Page text excerpt:
${page.text}

Return JSON:
- name: clean product name (e.g. "Logitech Rally Bar")
- tagline: 1 sentence, <=120 chars, no marketing fluff
- highlights: 3-5 short bullets, each <=80 chars, factual key features
- link: the manufacturer page URL if known, else ""`,
    );

    return {
      name: typeof step3.name === "string" && step3.name ? step3.name : fullName,
      tagline: typeof step3.tagline === "string" ? step3.tagline : "",
      image_url: page.image_url,
      link: (typeof step3.link === "string" && step3.link) || finalLink,
      highlights: Array.isArray(step3.highlights)
        ? (step3.highlights as unknown[]).map(String).filter(Boolean).slice(0, 5)
        : [],
    };
  });
