import { llmGenerate, validateLLMServerConfig } from "@tandem/shared/server";
import type { CrawledPage, ImportSignals, WebsiteImportDraft, WebsiteImportResult } from "./types";
import { isLikelyFaqPage, normalizeFaqCandidate } from "./faq-heuristics";
import { createId, normalizeHexColor, pickReadableTextColor } from "./utils";

type RawFaq = {
  question?: unknown;
  answer?: unknown;
  source_url?: unknown;
};

type RawPolicy = {
  title?: unknown;
  summary?: unknown;
  source_url?: unknown;
};

type RawDraft = {
  business_name?: unknown;
  short_description?: unknown;
  phone?: unknown;
  phone_source_url?: unknown;
  email?: unknown;
  email_source_url?: unknown;
  address?: unknown;
  address_source_url?: unknown;
  hours?: unknown;
  hours_source_url?: unknown;
  social_links?: unknown;
  faqs?: unknown;
  policies?: unknown;
  brand?: unknown;
};

function asNullableUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function extractFallbackFaqs(pages: CrawledPage[]) {
  const out: WebsiteImportDraft["faqs"] = [];
  const seenQuestions = new Set<string>();
  const questionPattern = /([^?.!\n]{8,140}\?)/g;

  for (const page of pages) {
    const faqPageHint = isLikelyFaqPage(page.url, page.title);
    const questions: Array<{ text: string; start: number; end: number }> = [];

    let match: RegExpExecArray | null;
    while ((match = questionPattern.exec(page.textExcerpt)) !== null && questions.length < 30) {
      const question = (match[1] ?? "").trim();
      questions.push({
        text: question,
        start: match.index,
        end: match.index + question.length,
      });
    }

    for (let index = 0; index < questions.length && out.length < 20; index += 1) {
      const question = questions[index];
      const nextQuestion = questions[index + 1];
      const answerStart = question.end;
      const answerEnd = nextQuestion ? nextQuestion.start : Math.min(page.textExcerpt.length, answerStart + 420);
      const answer = page.textExcerpt.slice(answerStart, answerEnd).trim();

      const candidate = normalizeFaqCandidate(
        {
          question: question.text,
          answer: answer.slice(0, 420),
          sourceUrl: asNullableUrl(page.url),
        },
        {
          faqPageHint,
          minScore: faqPageHint ? 3 : 5,
        },
      );

      if (!candidate) {
        continue;
      }

      const key = candidate.question.toLowerCase();
      if (seenQuestions.has(key)) {
        continue;
      }
      seenQuestions.add(key);

      out.push({
        id: createId("faq"),
        question: candidate.question,
        answer: candidate.answer,
        sourceUrl: candidate.sourceUrl,
        include: true,
      });
    }

    if (out.length >= 20) {
      break;
    }
  }

  return out;
}

function extractFallbackPolicies(pages: CrawledPage[]) {
  const policyHints = [
    { key: "privacy", title: "Privacy Policy" },
    { key: "terms", title: "Terms and Conditions" },
    { key: "return", title: "Returns Policy" },
    { key: "refund", title: "Refund Policy" },
    { key: "shipping", title: "Shipping Policy" },
    { key: "reservation", title: "Reservation Policy" },
    { key: "booking", title: "Booking Policy" },
    { key: "cancellation", title: "Cancellation Policy" },
  ];

  const out: WebsiteImportDraft["policies"] = [];

  for (const page of pages) {
    const haystack = `${page.url} ${page.title} ${page.textExcerpt}`.toLowerCase();
    const hint = policyHints.find((entry) => haystack.includes(entry.key));
    if (!hint) {
      continue;
    }

    if (out.some((entry) => entry.title === hint.title)) {
      continue;
    }

    out.push({
      id: createId("policy"),
      title: hint.title,
      summary: page.textExcerpt.slice(0, 360),
      sourceUrl: asNullableUrl(page.url),
      include: true,
    });

    if (out.length >= 20) {
      break;
    }
  }

  return out;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asUrl(value: unknown): string | null {
  const parsed = asString(value);
  if (!parsed) {
    return null;
  }
  try {
    const next = new URL(parsed);
    if (next.protocol !== "http:" && next.protocol !== "https:") {
      return null;
    }
    return next.toString();
  } catch {
    return null;
  }
}

function sanitizeSourceUrl(value: unknown, allowedSources: Set<string>): string | null {
  const parsed = asUrl(value);
  if (!parsed) {
    return null;
  }
  return allowedSources.has(parsed) ? parsed : null;
}

function sentenceCount(value: string): number {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length >= 4).length;
}

function normalizeSummary(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) {
    return null;
  }

  const count = sentenceCount(compact);
  if (count >= 2 && count <= 4) {
    return compact;
  }

  const sentences = compact
    .split(/(?<=[.!?])\s+/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .slice(0, 4);

  if (sentences.length < 2) {
    return null;
  }

  return sentences.join(" ");
}

function parseLlmJson(content: string): RawDraft | null {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? trimmed;
  try {
    const parsed = JSON.parse(candidate);
    return typeof parsed === "object" && parsed !== null ? (parsed as RawDraft) : null;
  } catch {
    return null;
  }
}

function buildDeterministicDraft(sourceUrl: string, pages: CrawledPage[], signals: ImportSignals): WebsiteImportDraft {
  const homepage = pages[0];
  const firstPhone = signals.phones[0];
  const firstEmail = signals.emails[0];
  const firstAddress = signals.addresses[0];
  const firstHours = signals.hours[0];
  const primaryColor = signals.colorCandidates[0];
  const accentColor = signals.colorCandidates[1] ?? primaryColor;
  const backgroundColor = normalizeHexColor("#FFFFFF");
  const logo = signals.logoCandidates[0] ?? signals.faviconCandidates[0];
  const font = signals.fontCandidates.find((entry) => !/serif|sans-serif|monospace/i.test(entry.value)) ?? signals.fontCandidates[0];

  return {
    sourceUrl,
    businessProfile: {
      name: {
        value: homepage?.title ?? null,
        sourceUrl: homepage?.url ?? null,
      },
      shortDescription: {
        value: homepage?.textExcerpt?.slice(0, 220) ?? null,
        sourceUrl: homepage?.url ?? null,
      },
      phone: {
        value: firstPhone?.value ?? null,
        sourceUrl: firstPhone?.sourceUrl ?? null,
      },
      email: {
        value: firstEmail?.value ?? null,
        sourceUrl: firstEmail?.sourceUrl ?? null,
      },
      address: {
        value: firstAddress?.value ?? null,
        sourceUrl: firstAddress?.sourceUrl ?? null,
      },
      hours: {
        value: firstHours?.value ?? null,
        sourceUrl: firstHours?.sourceUrl ?? null,
      },
      socialLinks: signals.socialLinks,
    },
    faqs: [],
    policies: [],
    brand: {
      primaryColor: {
        value: primaryColor?.value ?? null,
        sourceUrl: primaryColor?.sourceUrl ?? null,
        confidence: primaryColor ? 0.65 : 0,
      },
      accentColor: {
        value: accentColor?.value ?? null,
        sourceUrl: accentColor?.sourceUrl ?? null,
        confidence: accentColor ? 0.55 : 0,
      },
      backgroundColor: {
        value: backgroundColor,
        sourceUrl: homepage?.url ?? null,
        confidence: 0.3,
      },
      textColor: {
        value: pickReadableTextColor(backgroundColor),
        sourceUrl: homepage?.url ?? null,
        confidence: 0.3,
      },
      fontFamily: {
        value: font?.value ?? null,
        sourceUrl: font?.sourceUrl ?? null,
        confidence: font ? 0.5 : 0,
      },
      logoUrl: {
        value: logo?.url ?? null,
        sourceUrl: logo?.sourceUrl ?? null,
        confidence: logo ? 0.7 : 0,
      },
    },
    evidence: {
      pages: pages.map((page) => ({ url: page.url, title: page.title })),
    },
  };
}

function pickSource(value: string | null, fallbackSource: string | null, sourceFromLlm?: unknown): string | null {
  if (!value) {
    return null;
  }
  return asUrl(sourceFromLlm) ?? fallbackSource;
}

function parseLlmDraft(input: {
  sourceUrl: string;
  pages: CrawledPage[];
  signals: ImportSignals;
  llmDraft: RawDraft | null;
}): WebsiteImportDraft {
  const deterministic = buildDeterministicDraft(input.sourceUrl, input.pages, input.signals);
  const allowedSources = new Set(input.pages.map((page) => asUrl(page.url)).filter((url): url is string => Boolean(url)));
  if (!input.llmDraft) {
    return deterministic;
  }

  const llm = input.llmDraft;
  const brandObj = typeof llm.brand === "object" && llm.brand !== null ? (llm.brand as Record<string, unknown>) : {};

  const socialLinksFromLlm = Array.isArray(llm.social_links)
    ? llm.social_links
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const object = entry as Record<string, unknown>;
        const url = asUrl(object.url);
        if (!url) {
          return null;
        }
        const sourceUrl = asUrl(object.source_url) ?? input.sourceUrl;
        const platformCandidate = typeof object.platform === "string" ? object.platform.toLowerCase() : "other";
        const platform: "facebook" | "instagram" | "tiktok" | "youtube" | "linkedin" | "x" | "other" =
          platformCandidate === "facebook" ||
          platformCandidate === "instagram" ||
          platformCandidate === "tiktok" ||
          platformCandidate === "youtube" ||
          platformCandidate === "linkedin" ||
          platformCandidate === "x"
            ? platformCandidate
            : "other";
        return {
          platform,
          url,
          sourceUrl,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    : deterministic.businessProfile.socialLinks;

  const faqs = Array.isArray(llm.faqs)
    ? llm.faqs
      .map((entry): RawFaq | null => (entry && typeof entry === "object" ? (entry as RawFaq) : null))
      .filter((entry): entry is RawFaq => Boolean(entry))
      .map((entry) => {
        const question = asString(entry.question);
        const answer = asString(entry.answer);
        const sourceUrl = sanitizeSourceUrl(entry.source_url, allowedSources);
        if (!question || !answer || !sourceUrl) {
          return null;
        }

        const candidate = normalizeFaqCandidate(
          {
            question,
            answer,
            sourceUrl,
          },
          {
            faqPageHint: isLikelyFaqPage(sourceUrl),
            minScore: 4,
          },
        );

        if (!candidate) {
          return null;
        }

        return {
          id: createId("faq"),
          question: candidate.question,
          answer: candidate.answer,
          sourceUrl: candidate.sourceUrl,
          include: true,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .filter((entry, index, list) =>
        list.findIndex((candidate) => candidate.question.toLowerCase() === entry.question.toLowerCase()) === index,
      )
      .slice(0, 20)
    : [];

  const policies = Array.isArray(llm.policies)
    ? llm.policies
      .map((entry): RawPolicy | null => (entry && typeof entry === "object" ? (entry as RawPolicy) : null))
      .filter((entry): entry is RawPolicy => Boolean(entry))
      .map((entry) => {
        const title = asString(entry.title);
        const summary = asString(entry.summary);
        const sourceUrl = sanitizeSourceUrl(entry.source_url, allowedSources);
        if (!title || !summary || !sourceUrl) {
          return null;
        }
        return {
          id: createId("policy"),
          title,
          summary,
          sourceUrl,
          include: true,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .slice(0, 20)
    : [];

  const primaryColor = normalizeHexColor(asString(brandObj.primary_color));
  const accentColor = normalizeHexColor(asString(brandObj.accent_color));
  const backgroundColor = normalizeHexColor(asString(brandObj.background_color)) ?? deterministic.brand.backgroundColor.value;
  const textColor = normalizeHexColor(asString(brandObj.text_color)) ?? pickReadableTextColor(backgroundColor);

  const name = asString(llm.business_name);
  const shortDescription = normalizeSummary(asString(llm.short_description));
  const phone = asString(llm.phone);
  const email = asString(llm.email);
  const address = asString(llm.address);
  const hours = asString(llm.hours);
  const phoneSource = sanitizeSourceUrl(llm.phone_source_url, allowedSources);
  const emailSource = sanitizeSourceUrl(llm.email_source_url, allowedSources);
  const addressSource = sanitizeSourceUrl(llm.address_source_url, allowedSources);
  const hoursSource = sanitizeSourceUrl(llm.hours_source_url, allowedSources);
  const phoneFromLlm = phoneSource ? phone : null;
  const emailFromLlm = emailSource ? email : null;
  const addressFromLlm = addressSource ? address : null;
  const hoursFromLlm = hoursSource ? hours : null;

  return {
    sourceUrl: input.sourceUrl,
    businessProfile: {
      name: {
        value: name ?? deterministic.businessProfile.name.value,
        sourceUrl: pickSource(name, deterministic.businessProfile.name.sourceUrl),
      },
      shortDescription: {
        value: shortDescription ?? normalizeSummary(deterministic.businessProfile.shortDescription.value) ?? deterministic.businessProfile.shortDescription.value,
        sourceUrl: pickSource(shortDescription, deterministic.businessProfile.shortDescription.sourceUrl),
      },
      phone: {
        value: phoneFromLlm ?? deterministic.businessProfile.phone.value,
        sourceUrl: pickSource(phoneFromLlm, deterministic.businessProfile.phone.sourceUrl, phoneSource),
      },
      email: {
        value: emailFromLlm ?? deterministic.businessProfile.email.value,
        sourceUrl: pickSource(emailFromLlm, deterministic.businessProfile.email.sourceUrl, emailSource),
      },
      address: {
        value: addressFromLlm ?? deterministic.businessProfile.address.value,
        sourceUrl: pickSource(addressFromLlm, deterministic.businessProfile.address.sourceUrl, addressSource),
      },
      hours: {
        value: hoursFromLlm ?? deterministic.businessProfile.hours.value,
        sourceUrl: pickSource(hoursFromLlm, deterministic.businessProfile.hours.sourceUrl, hoursSource),
      },
      socialLinks: socialLinksFromLlm,
    },
    faqs,
    policies,
    brand: {
      primaryColor: {
        value: primaryColor ?? deterministic.brand.primaryColor.value,
        sourceUrl: pickSource(primaryColor, deterministic.brand.primaryColor.sourceUrl),
        confidence: typeof brandObj.primary_confidence === "number" ? brandObj.primary_confidence : deterministic.brand.primaryColor.confidence,
      },
      accentColor: {
        value: accentColor ?? deterministic.brand.accentColor.value,
        sourceUrl: pickSource(accentColor, deterministic.brand.accentColor.sourceUrl),
        confidence: typeof brandObj.accent_confidence === "number" ? brandObj.accent_confidence : deterministic.brand.accentColor.confidence,
      },
      backgroundColor: {
        value: backgroundColor,
        sourceUrl: pickSource(backgroundColor, deterministic.brand.backgroundColor.sourceUrl),
        confidence: typeof brandObj.background_confidence === "number" ? brandObj.background_confidence : deterministic.brand.backgroundColor.confidence,
      },
      textColor: {
        value: textColor,
        sourceUrl: pickSource(textColor, deterministic.brand.textColor.sourceUrl),
        confidence: typeof brandObj.text_confidence === "number" ? brandObj.text_confidence : deterministic.brand.textColor.confidence,
      },
      fontFamily: {
        value: asString(brandObj.font_family) ?? deterministic.brand.fontFamily.value,
        sourceUrl: pickSource(asString(brandObj.font_family), deterministic.brand.fontFamily.sourceUrl),
        confidence: typeof brandObj.font_confidence === "number" ? brandObj.font_confidence : deterministic.brand.fontFamily.confidence,
      },
      logoUrl: {
        value: asUrl(brandObj.logo_url) ?? deterministic.brand.logoUrl.value,
        sourceUrl: pickSource(asUrl(brandObj.logo_url), deterministic.brand.logoUrl.sourceUrl),
        confidence: typeof brandObj.logo_confidence === "number" ? brandObj.logo_confidence : deterministic.brand.logoUrl.confidence,
      },
    },
    evidence: {
      pages: input.pages.map((page) => ({ url: page.url, title: page.title })),
    },
  };
}

async function extractWithLlm(args: { sourceUrl: string; pages: CrawledPage[]; signals: ImportSignals }): Promise<RawDraft | null> {
  const llmConfig = validateLLMServerConfig();
  if (!llmConfig.ok) {
    return null;
  }

  const compactPages = args.pages.map((page) => ({
    url: page.url,
    title: page.title,
    text: page.textExcerpt.slice(0, 8000),
  }));

  const instruction = [
    "Extract structured business onboarding data from website crawl pages.",
    "Return ONLY valid JSON. No markdown fences.",
    "Hard rule: if a field is not supported by explicit evidence from provided pages/signals, set it to null or empty array.",
    "For phone/email/address/hours, include source URLs using phone_source_url/email_source_url/address_source_url/hours_source_url and only use URLs from provided pages.",
    "short_description must be 2-4 sentences, concrete, and based only on provided evidence.",
    "Every FAQ and policy entry must include a source_url from provided pages; otherwise omit the entry.",
    "Prefer concise summaries and avoid speculation.",
    "Schema:",
    "{",
    '  "business_name": string|null,',
    '  "short_description": string|null,',
    '  "phone": string|null,',
    '  "phone_source_url": string|null,',
    '  "email": string|null,',
    '  "email_source_url": string|null,',
    '  "address": string|null,',
    '  "address_source_url": string|null,',
    '  "hours": string|null,',
    '  "hours_source_url": string|null,',
    '  "social_links": [{"platform": string, "url": string, "source_url": string}],',
    '  "faqs": [{"question": string, "answer": string, "source_url": string}],',
    '  "policies": [{"title": string, "summary": string, "source_url": string}],',
    '  "brand": {',
    '    "primary_color": string|null,',
    '    "accent_color": string|null,',
    '    "background_color": string|null,',
    '    "text_color": string|null,',
    '    "font_family": string|null,',
    '    "logo_url": string|null,',
    '    "primary_confidence": number,',
    '    "accent_confidence": number,',
    '    "background_confidence": number,',
    '    "text_confidence": number,',
    '    "font_confidence": number,',
    '    "logo_confidence": number',
    "  }",
    "}",
  ].join("\n");

  const response = await llmGenerate({
    system: instruction,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          sourceUrl: args.sourceUrl,
          deterministicSignals: args.signals,
          pages: compactPages,
        }),
      },
    ],
    temperature: 0,
    maxTokens: 2600,
  });

  return parseLlmJson(response.text ?? "");
}

export async function buildWebsiteImportResult(input: {
  sourceUrl: string;
  pages: CrawledPage[];
  signals: ImportSignals;
}): Promise<WebsiteImportResult> {
  const llmDraft = await extractWithLlm(input).catch(() => null);
  const draft = parseLlmDraft({
    sourceUrl: input.sourceUrl,
    pages: input.pages,
    signals: input.signals,
    llmDraft,
  });

  if (draft.faqs.length === 0) {
    draft.faqs = extractFallbackFaqs(input.pages);
  }

  if (draft.policies.length === 0) {
    draft.policies = extractFallbackPolicies(input.pages);
  }

  return {
    pages: input.pages,
    signals: input.signals,
    draft,
  };
}
