import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  url: z.string().min(3),
  client_name: z.string().optional().default(""),
});

export interface ClientLookupResult {
  logo_url: string;
  industry: string;
  hq: string;
  size: string;
  about: string;
  challenge: string;
  why_us: string;
  source_url: string;
}

function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

function absolutize(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function extractMeta(html: string, baseUrl: string) {
  const pick = (re: RegExp) => {
    const m = html.match(re);
    return m ? m[1].trim() : "";
  };
  const ogImage =
    pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    pick(/<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  const twitterImage = pick(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  const iconHref =
    pick(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i) ||
    pick(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i);
  const description =
    pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const title = pick(/<title[^>]*>([^<]+)<\/title>/i);
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);
  const logo = ogImage || twitterImage || iconHref;
  return {
    title,
    description,
    logo_url: logo ? absolutize(logo, baseUrl) : "",
    text,
  };
}

export const lookupClient = createServerFn({ method: "POST" })
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<ClientLookupResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured");
    const url = normalizeUrl(data.url);

    let html = "";
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; GOSAVI-ProposalBot/1.0)",
          accept: "text/html,*/*",
        },
      });
      html = await res.text();
    } catch (e) {
      throw new Error(`Could not reach ${url}`);
    }

    const meta = extractMeta(html, url);

    const system = `You are a B2B research assistant for GOSAVI Meeting Solutions, an AV / meeting-room integrator.
Given a company's website content, return a concise JSON profile suitable for a sales proposal.
Be factual; if a field is not in the source, leave it as an empty string. Do NOT invent numbers.`;

    const userPrompt = `Company name (if given): ${data.client_name || "(infer from site)"}
Website: ${url}
Site title: ${meta.title}
Meta description: ${meta.description}

Site text excerpt:
${meta.text}

Return JSON ONLY with keys: industry, hq, size, about, challenge, why_us.
- industry: 2-4 words
- hq: City, Region/Country if findable
- size: e.g. "200+ employees" or "" if unknown
- about: 1-2 polished sentences for a proposal cover
- challenge: 1-2 sentences framing the AV / meeting-room / collaboration challenge this company likely faces (be plausible, not generic)
- why_us: 1-2 sentences on why GOSAVI is well-suited (AV design, install, managed support)`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`AI lookup failed: ${aiRes.status} ${txt.slice(0, 200)}`);
    }
    const json = await aiRes.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, string> = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }

    return {
      logo_url: meta.logo_url,
      industry: parsed.industry ?? "",
      hq: parsed.hq ?? "",
      size: parsed.size ?? "",
      about: parsed.about ?? meta.description ?? "",
      challenge: parsed.challenge ?? "",
      why_us: parsed.why_us ?? "",
      source_url: url,
    };
  });
