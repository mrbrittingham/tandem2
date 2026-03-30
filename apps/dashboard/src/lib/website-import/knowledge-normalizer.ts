/**
 * Knowledge Normalizer
 *
 * This module collapses raw imported FAQ candidates into canonical structured
 * knowledge blocks instead of creating individual Q&A rows.
 *
 * The core problem: the website import pipeline generates 50–150 ImportFaq items
 * per restaurant because every content section of every page can produce Q&A pairs.
 * Many of these are:
 *   - Semantically identical ("How do I reserve a table?" / "Can I book online?")
 *   - Already captured in structured blocks (events, menuSections, reservations)
 *   - Time-sensitive facts that should NOT live in a permanent FAQ list
 *   - Policy-adjacent content better stored in ImportPolicy
 *
 * This normalizer:
 * 1. Routes FAQ candidates into canonical categories (hours, reservations, menu, etc.)
 * 2. One canonical category = ONE structured knowledge record, not many rows
 * 3. Drops FAQ candidates whose topic is already covered by structured blocks
 * 4. Deduplicates by semantic fingerprint before any surviving items are kept
 * 5. Hard-caps the final FAQ list at MAX_SURVIVING_FAQS
 *
 * Topics that map to structured blocks (and therefore should NOT produce FAQs):
 *   - Reservations → ImportReservationInfo (already structured)
 *   - Menu items / sections → ImportMenuSection (already structured)
 *   - Events → ImportEvent (already structured)
 *   - Hours → ContactMethod / businessProfile.hours
 *   - Contact (phone/email/address) → businessProfile signals
 *
 * Topics that CAN survive as FAQs (genuinely FAQ-appropriate content):
 *   - Unique policies (dress code, group size limits, corkage, etc.)
 *   - Parking / accessibility specifics not elsewhere captured
 *   - Gift cards / catering availability
 *   - Dietary accommodation specifics
 *   - Pet policy
 *   - Anything genuinely one-off without a better structured home
 *
 * Usage:
 *   import { normalizeImportFaqs } from "./knowledge-normalizer";
 *   const result = normalizeImportFaqs(draft.faqs, draft.restaurantKnowledge);
 */

import type {
  ImportFaq,
  ImportReservationInfo,
  ImportMenuSection,
  ImportEvent,
} from "./types";

// ── Configuration ────────────────────────────────────────────────────────

/**
 * Maximum number of FAQ items to allow after normalization.
 * FAQs beyond this are dropped regardless of score.
 * (Was previously unbounded — 100+ items common for a typical restaurant site)
 */
const MAX_SURVIVING_FAQS = 15;

/**
 * Minimum score for a FAQ candidate to survive normalization.
 * Lower-scored items are collapsed into structured blocks or dropped.
 */
const MIN_FAQ_SCORE = 4;

// ── Category detection regexes ───────────────────────────────────────────

/**
 * Topics that are already handled by structured blocks.
 * FAQs matching these patterns should be dropped — the information lives
 * in a structured record (reservations, menuSections, events, etc.) already.
 */
const STRUCTURED_TOPIC_PATTERNS: Array<{ category: string; patterns: RegExp[] }> = [
  {
    category: "reservations",
    patterns: [
      /\breserv(?:e|ation|ations|ed)?\b/i,
      /\bbook(?:ing|ed|s)?\s+(?:a\s+)?table\b/i,
      /\bmake\s+a\s+(?:reservation|booking)\b/i,
      /\bwalk\s*-?\s*in\b/i,
      /\bopentable\b|\bresy\b|\btock\b|\bsevenrooms\b/i,
    ],
  },
  {
    category: "hours",
    patterns: [
      /\bwhat\s+(?:are\s+)?(?:your\s+)?hours\b/i,
      /\bwhen\s+(?:are\s+you\s+)?open\b/i,
      /\bhours\s+of\s+operation\b/i,
      /\bopening\s+hours?\b/i,
      /\bwhat\s+time\s+(?:do\s+you\s+open|does\s+(?:it|the\s+restaurant)\s+open)\b/i,
      /\bare\s+you\s+open\b/i,
      /\bclosing\s+time\b/i,
    ],
  },
  {
    category: "contact",
    patterns: [
      /\bphone\s+number\b|\bcall\s+(?:you|us)\b/i,
      /\bemail\s+(?:address|contact)\b/i,
      /\bhow\s+(?:do\s+i\s+)?contact\b/i,
      /\bwhere\s+are\s+you\s+located\b/i,
      /\bwhat(?:'s|\s+is)\s+(?:your\s+)?address\b/i,
      /\bhow\s+do\s+i\s+(?:find|get\s+to)\s+you\b/i,
    ],
  },
  {
    category: "menu",
    patterns: [
      /\bwhat(?:'s|\s+is)\s+on\s+(?:your\s+)?menu\b/i,
      /\bdo\s+you\s+(?:have|serve|offer)\s+(?:a\s+)?(?:vegetarian|vegan|gluten[‐\-\s]free)\s+(?:menu|options?|dishes?)\b/i,
      /\bwhat\s+(?:food|dishes|items?)\s+do\s+you\s+(?:have|serve|offer)\b/i,
      /\bwhat\s+kind\s+of\s+(?:food|cuisine)\b/i,
    ],
  },
  {
    category: "events",
    patterns: [
      /\bwhat\s+events?\s+(?:are|do\s+you\s+have)\b/i,
      /\bdo\s+you\s+have\s+(?:live\s+)?(?:music|entertainment|events?)\b/i,
      /\bwhat'?s?\s+(?:on|happening)\s+(?:this\s+)?(?:weekend|week|month)\b/i,
      /\bwhen\s+is\s+(?:the\s+)?(?:next\s+)?(?:live\s+)?music\b/i,
    ],
  },
];

/**
 * Topics that represent GENUINE FAQ-appropriate content — unique policies,
 * special programs, or one-off facts without a structured home.
 * These patterns PROMOTE a candidate (increase its chance of surviving).
 */
const GENUINE_FAQ_PATTERNS: RegExp[] = [
  /\bparking\b|\baccess(?:ible|ibility)\b/i,
  /\bdress\s+code\b|\battire\b/i,
  /\bpet(?:s)?\s+(?:allowed|friendly|welcome|policy)\b/i,
  /\bgift\s+card\b/i,
  /\bcorkage\b|\bbring\s+(?:your|my)\s+own\s+(?:wine|bottle|beer)\b|\bbyob\b/i,
  /\bcatering\b/i,
  /\bprivate\s+(?:dining|event|party)\b/i,
  /\blarge\s+group\b|\bgroup\s+(?:dining|booking|reservation)\b/i,
  /\bnoise\s+level\b|\bkid(?:s)?[‐\-\s]friendly\b|\bfamily[‐\-\s]friendly\b/i,
  /\bwi[‐\-\s]?fi\b/i,
  /\btakeout|take.?out|takeaway|to.?go\b/i,
  /\bdelivery\b/i,
  /\ballerg(?:y|ies)\b|\bdietary\s+restriction\b/i,
  /\bvalet\b|\bparking\s+(?:lot|garage)\b/i,
  /\bcancellation\s+policy\b/i,
  /\bdeposit\b/i,
];

// ── Semantic fingerprinting for deduplication ────────────────────────────

/**
 * Normalize a question string for semantic comparison.
 * Strips question words, punctuation, and common filler to get a root topic.
 */
function semanticFingerprint(text: string): string {
  return text
    .toLowerCase()
    .replace(/[?!.,;:'"()\[\]{}]/g, "")
    .replace(/\b(what|when|where|who|why|how|can|do|does|is|are|will|did|should|could|would|the|a|an|your|my|our|their|you|we|i|me|us|it|that|this|these|those|there|here)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/**
 * Returns true if two questions are semantically similar enough to be considered
 * the same question (deduplication target).
 */
function areSemanticallyDuplicate(a: string, b: string): boolean {
  const fpA = semanticFingerprint(a);
  const fpB = semanticFingerprint(b);
  if (fpA === fpB) return true;

  // Jaccard-like word overlap — if 70%+ of words match, treat as duplicate
  const wordsA = new Set(fpA.split(" ").filter((w) => w.length > 2));
  const wordsB = new Set(fpB.split(" ").filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return false;

  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }

  const union = wordsA.size + wordsB.size - overlap;
  const jaccardScore = union > 0 ? overlap / union : 0;
  return jaccardScore >= 0.7;
}

// ── Structured block coverage check ─────────────────────────────────────

type StructuredBlocks = {
  reservations?: ImportReservationInfo | null;
  menuSections?: ImportMenuSection[];
  events?: ImportEvent[];
};

/**
 * Determines if a FAQ candidate's topic is already covered by a structured block.
 * If so, the FAQ should be dropped — the information is better represented
 * in the structured data than as a Q&A pair.
 */
export function isTopicCoveredByStructuredBlock(
  question: string,
  answer: string,
  blocks: StructuredBlocks,
): { covered: boolean; category: string | null } {
  const haystack = `${question} ${answer}`.toLowerCase();

  for (const { category, patterns } of STRUCTURED_TOPIC_PATTERNS) {
    const matches = patterns.some((p) => p.test(haystack));
    if (!matches) continue;

    // Check whether the relevant structured block actually has data
    if (category === "reservations" && blocks.reservations) {
      const res = blocks.reservations;
      if (res.status !== "not-offered") {
        return { covered: true, category };
      }
    }

    if (category === "menu" && blocks.menuSections && blocks.menuSections.length > 0) {
      return { covered: true, category };
    }

    if (category === "events" && blocks.events && blocks.events.length > 0) {
      return { covered: true, category };
    }

    // Hours and contact: always covered (they come from businessProfile signals).
    // We never need FAQ rows for these — the structured prompt handles them.
    if (category === "hours" || category === "contact") {
      return { covered: true, category };
    }
  }

  return { covered: false, category: null };
}

/**
 * Returns a score bonus for genuinely FAQ-appropriate content.
 * Items scoring high here are more likely to survive normalization.
 */
function genuineFaqBonus(question: string, answer: string): number {
  const haystack = `${question} ${answer}`.toLowerCase();
  let bonus = 0;
  for (const pattern of GENUINE_FAQ_PATTERNS) {
    if (pattern.test(haystack)) {
      bonus += 3;
    }
  }
  return bonus;
}

// ── Main normalization entry point ────────────────────────────────────────

export type NormalizationResult = {
  /** FAQs that survived normalization — should be stored as actual FAQ items */
  survivingFaqs: ImportFaq[];
  /**
   * FAQs that were dropped because their topic is covered by structured blocks.
   * Useful for debugging / operator review in Phase 2.
   */
  droppedAsStructured: Array<{ faq: ImportFaq; blockedByCategory: string }>;
  /**
   * FAQs that were dropped as duplicates of an already-included item.
   */
  droppedAsDuplicate: Array<{ faq: ImportFaq; duplicateOf: string }>;
  /**
   * FAQs that were dropped for low quality (score below threshold).
   */
  droppedAsLowQuality: ImportFaq[];
  /** Summary stats for logging */
  stats: {
    input: number;
    survived: number;
    droppedStructured: number;
    droppedDuplicate: number;
    droppedLowQuality: number;
    droppedOverCap: number;
  };
};

/**
 * Normalize a list of ImportFaq candidates against existing structured blocks.
 *
 * Steps:
 * 1. Drop FAQs whose topic is covered by structured blocks (reservations, menu, events, hours, contact)
 * 2. Drop FAQs with a base score below MIN_FAQ_SCORE
 * 3. Deduplicate semantically similar questions (keep the highest-scoring one)
 * 4. Apply genuine-FAQ bonus to remaining items
 * 5. Sort by score descending, cap at MAX_SURVIVING_FAQS
 *
 * @param faqs Raw ImportFaq[] from extraction
 * @param structuredBlocks The structured restaurant knowledge already extracted
 * @param options Optional overrides for cap and score threshold
 */
export function normalizeImportFaqs(
  faqs: ImportFaq[],
  structuredBlocks: StructuredBlocks = {},
  options: { maxFaqs?: number; minScore?: number } = {},
): NormalizationResult {
  const maxFaqs = options.maxFaqs ?? MAX_SURVIVING_FAQS;
  const minScore = options.minScore ?? MIN_FAQ_SCORE;

  const droppedAsStructured: NormalizationResult["droppedAsStructured"] = [];
  const droppedAsDuplicate: NormalizationResult["droppedAsDuplicate"] = [];
  const droppedAsLowQuality: ImportFaq[] = [];

  // Step 1: Filter out FAQs already included by operator (`include: false`)
  const candidates = faqs.filter((f) => f.include !== false);

  // Step 2: Drop topics covered by structured blocks
  const afterStructuredFilter: ImportFaq[] = [];
  for (const faq of candidates) {
    const { covered, category } = isTopicCoveredByStructuredBlock(
      faq.question,
      faq.answer,
      structuredBlocks,
    );
    if (covered && category) {
      droppedAsStructured.push({ faq, blockedByCategory: category });
    } else {
      afterStructuredFilter.push(faq);
    }
  }

  // Step 3: Score each surviving candidate
  type ScoredFaq = { faq: ImportFaq; score: number };
  const scored: ScoredFaq[] = afterStructuredFilter.map((faq) => {
    const base = faq.confidence ?? 5;
    const bonus = genuineFaqBonus(faq.question, faq.answer);
    const lowConf = faq.lowConfidence ? -2 : 0;
    return { faq, score: base + bonus + lowConf };
  });

  // Step 4: Drop below minimum score
  const afterScoreFilter: ScoredFaq[] = [];
  for (const item of scored) {
    if (item.score < minScore) {
      droppedAsLowQuality.push(item.faq);
    } else {
      afterScoreFilter.push(item);
    }
  }

  // Step 5: Deduplicate semantically similar questions
  // Keep the highest-scoring version for any duplicate cluster
  const deduped: ScoredFaq[] = [];
  for (const item of afterScoreFilter) {
    const existingDuplicate = deduped.find((existing) =>
      areSemanticallyDuplicate(item.faq.question, existing.faq.question),
    );
    if (existingDuplicate) {
      if (item.score > existingDuplicate.score) {
        // Replace with higher-scored version
        droppedAsDuplicate.push({ faq: existingDuplicate.faq, duplicateOf: item.faq.question });
        const idx = deduped.indexOf(existingDuplicate);
        deduped[idx] = item;
      } else {
        droppedAsDuplicate.push({ faq: item.faq, duplicateOf: existingDuplicate.faq.question });
      }
    } else {
      deduped.push(item);
    }
  }

  // Step 6: Sort by score descending, cap at maxFaqs
  deduped.sort((a, b) => b.score - a.score);
  const capped = deduped.slice(0, maxFaqs);
  const droppedOverCap = deduped.slice(maxFaqs).length;

  const survivingFaqs = capped.map((item) => item.faq);

  const result: NormalizationResult = {
    survivingFaqs,
    droppedAsStructured,
    droppedAsDuplicate,
    droppedAsLowQuality,
    stats: {
      input: faqs.length,
      survived: survivingFaqs.length,
      droppedStructured: droppedAsStructured.length,
      droppedDuplicate: droppedAsDuplicate.length,
      droppedLowQuality: droppedAsLowQuality.length,
      droppedOverCap,
    },
  };

  console.log(
    `[knowledge-normalizer] FAQ normalization: ` +
    `in=${result.stats.input} ` +
    `survived=${result.stats.survived} ` +
    `dropped_structured=${result.stats.droppedStructured} ` +
    `dropped_duplicate=${result.stats.droppedDuplicate} ` +
    `dropped_low_quality=${result.stats.droppedLowQuality} ` +
    `dropped_over_cap=${result.stats.droppedOverCap}`,
  );

  return result;
}

/**
 * Compute lifecycle timestamps for a newly imported event.
 * Populates first_seen_at, last_seen_at, and expires_at.
 */
export function addEventLifecycle<T extends {
  date: string | null;
  recurring: boolean;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  expires_at?: string | null;
}>(event: T, nowIso: string): T {
  const GRACE_MS = 48 * 60 * 60 * 1000;

  let expiresAt: string | null = null;

  if (!event.recurring && event.date) {
    const parsed = Date.parse(event.date);
    if (!isNaN(parsed)) {
      expiresAt = new Date(parsed + GRACE_MS).toISOString();
    }
  }
  // Recurring events: no hard expiry — operators should review periodically

  return {
    ...event,
    first_seen_at: event.first_seen_at ?? nowIso,
    last_seen_at: nowIso,
    expires_at: event.expires_at ?? expiresAt,
  };
}

/**
 * Compute lifecycle timestamps for a newly imported menu item.
 */
export function addMenuItemLifecycle<T extends {
  first_seen_at?: string | null;
  last_seen_at?: string | null;
}>(item: T, nowIso: string): T {
  return {
    ...item,
    first_seen_at: item.first_seen_at ?? nowIso,
    last_seen_at: nowIso,
  };
}

/**
 * Update last_seen_at on items that are present in the latest scan.
 * Items NOT in the latest scan retain their old last_seen_at, which
 * allows the staleness detector to flag them over time.
 */
export function refreshMenuItemsSeen<T extends { id: string; last_seen_at?: string | null }>(
  existing: T[],
  seenIds: Set<string>,
  nowIso: string,
): T[] {
  return existing.map((item) => {
    if (seenIds.has(item.id)) {
      return { ...item, last_seen_at: nowIso };
    }
    return item;
  });
}
