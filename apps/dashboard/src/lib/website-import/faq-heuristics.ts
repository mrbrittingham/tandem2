const FAQ_PAGE_HINT_REGEX = /(faq|faqs|frequently\s+asked|help\/?center|support|common\s+questions)/i;
const QUESTION_PREFIX_REGEX = /^(what|when|where|who|why|how|can|do|does|is|are|will|did|should|could|would)\b/i;
const FORM_LABEL_REGEX = /^(name|first\s*name|last\s*name|email|phone|subject|message|comments?|contact\s*us|what\s+can\s+we\s+help\s+with|submit|search)$/i;
const SOCIAL_NOISE_REGEX = /(share\s+on|see\s+more|comments?|likes?|retweet|pinterest|copy\s+link|share\b|facebook|instagram|x\.com|twitter)/i;
const URL_NOISE_REGEX = /(https?:\/\/|\/[a-z0-9\-_]{3,}\/[^\s]{8,}|(?:\?|&)(?:utm_[a-z0-9_]+|fbclid|gclid|mc_[a-z0-9_]+)=|utm_[a-z0-9_]+=|fbclid=|gclid=)/i;
const NAVIGATION_NOISE_REGEXES = [
  /skip\s+to\s+content/i,
  /main\s+menu/i,
  /open\s+menu/i,
  /contact\s+us/i,
  /what\s+can\s+we\s+help\s+with/i,
  /cookie\s+(policy|settings|consent)/i,
  /privacy\s+preferences/i,
  /accept\s+all\s+cookies/i,
  /aria[-\s]?label/i,
  /sign\s+in|log\s+in/i,
  /subscribe\s+to\s+(our\s+)?newsletter/i,
];

export type FaqCandidate = {
  question: string;
  answer: string;
  sourceUrl: string | null;
};

export type NormalizeFaqCandidateOptions = {
  minScore?: number;
  faqPageHint?: boolean;
};

export type NormalizedFaqCandidate = FaqCandidate & {
  score: number;
};

function compactWhitespace(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[\-•\s]+/, "")
    .trim();
}

function normalizeQuestion(value: string): string {
  const normalized = compactWhitespace(value).replace(/^q\s*[:\-]\s*/i, "");
  const tokens = normalized.split(/\s+/).filter((entry) => entry.length > 0);
  const questionStartIndex = tokens.findIndex((token) =>
    QUESTION_PREFIX_REGEX.test(token.replace(/[^a-z]/gi, "")),
  );

  if (questionStartIndex > 0) {
    const prefix = tokens.slice(0, questionStartIndex).join(" ").toLowerCase();
    if (/name|email|phone|message|subject|submit|contact|help|with|menu|search|facebook|instagram|twitter|x|pinterest|share|like|comment|copy\s+link|reserve|utm_/.test(prefix)) {
      return tokens.slice(questionStartIndex).join(" ");
    }
  }

  return normalized.replace(/\s*#[A-Za-z0-9_]+/g, "").trim();
}

function normalizeAnswer(value: string): string {
  return compactWhitespace(value)
    .replace(/^a\s*[:\-]\s*/i, "")
    .replace(/^[\s:;,.!?-]+/, "");
}

function looksLikeQuestion(question: string): boolean {
  return question.endsWith("?") || QUESTION_PREFIX_REGEX.test(question);
}

function hasHashTag(value: string): boolean {
  return /(^|\s)#[A-Za-z0-9_]{2,}/.test(value);
}

function looksLikeFormLabel(value: string): boolean {
  const normalized = value.toLowerCase().replace(/[?.!:]/g, "").trim();
  return FORM_LABEL_REGEX.test(normalized);
}

function looksLikeFormLabelCluster(value: string): boolean {
  const tokens = value
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((entry) => entry.length > 0);

  if (tokens.length < 4) {
    return false;
  }

  const labelHits = tokens.filter((token) => FORM_LABEL_REGEX.test(token)).length;
  return labelHits / tokens.length >= 0.5;
}

function containsNavigationNoise(value: string): boolean {
  return NAVIGATION_NOISE_REGEXES.some((pattern) => pattern.test(value));
}

function sentenceCount(value: string): number {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 8).length;
}

export function isLikelyFaqPage(sourceUrl: string | null, title?: string | null): boolean {
  const haystack = `${sourceUrl ?? ""} ${title ?? ""}`;
  return FAQ_PAGE_HINT_REGEX.test(haystack);
}

export function scoreFaqCandidate(candidate: FaqCandidate, faqPageHint = false): number {
  const question = normalizeQuestion(candidate.question);
  const answer = normalizeAnswer(candidate.answer);
  const lowerQuestion = question.toLowerCase();
  const lowerAnswer = answer.toLowerCase();

  let score = 0;

  if (looksLikeQuestion(question)) {
    score += 2;
  }

  if (question.length >= 8 && question.length <= 120) {
    score += 1;
  } else {
    score -= 2;
  }

  if (answer.length >= 20 && answer.length <= 400) {
    score += 2;
  } else if (answer.length < 20 || answer.length > 600) {
    score -= 3;
  }

  if (sentenceCount(answer) >= 1) {
    score += 1;
  }

  if (faqPageHint) {
    score += 2;
  }

  if (containsNavigationNoise(lowerQuestion) || containsNavigationNoise(lowerAnswer)) {
    score -= 5;
  }

  if (SOCIAL_NOISE_REGEX.test(question) || SOCIAL_NOISE_REGEX.test(answer)) {
    score -= 6;
  }

  if (URL_NOISE_REGEX.test(question) || URL_NOISE_REGEX.test(answer)) {
    score -= 5;
  }

  if (hasHashTag(question) || hasHashTag(answer)) {
    score -= 5;
  }

  if (looksLikeFormLabel(question) || looksLikeFormLabel(answer)) {
    score -= 5;
  }

  if (looksLikeFormLabelCluster(answer)) {
    score -= 6;
  }

  if (lowerQuestion === lowerAnswer || answer.includes("?") && answer.split("?").length > 2) {
    score -= 3;
  }

  return score;
}

export function normalizeFaqCandidate(
  candidate: FaqCandidate,
  options: NormalizeFaqCandidateOptions = {},
): NormalizedFaqCandidate | null {
  const question = normalizeQuestion(candidate.question);
  const answer = normalizeAnswer(candidate.answer);
  const sourceUrl = candidate.sourceUrl;

  if (!question || !answer || !sourceUrl) {
    return null;
  }

  if (!looksLikeQuestion(question)) {
    return null;
  }

  if (SOCIAL_NOISE_REGEX.test(question) || URL_NOISE_REGEX.test(question) || hasHashTag(question)) {
    return null;
  }

  if (looksLikeFormLabelCluster(answer)) {
    return null;
  }

  const score = scoreFaqCandidate({ question, answer, sourceUrl }, options.faqPageHint ?? false);
  const threshold = options.minScore ?? 4;

  if (score < threshold) {
    return null;
  }

  return {
    question,
    answer,
    sourceUrl,
    score,
  };
}
