# Tandem Chatbot Evaluation Rubric

> Scoring criteria for evaluating chatbot response quality across multiple dimensions.

---

## Scoring Scale

Each dimension is scored 1–5:

| Score | Label | Meaning |
|-------|-------|---------|
| 5 | Excellent | Fully meets criteria with no issues |
| 4 | Good | Meets criteria with minor imperfections |
| 3 | Acceptable | Meets minimum bar but has noticeable gaps |
| 2 | Poor | Falls short of criteria in meaningful ways |
| 1 | Failing | Does not meet criteria; would harm user experience |

---

## Dimension 1: Accuracy

> Does the response contain only correct, verified information?

| Score | Description |
|-------|-------------|
| 5 | All facts are correct and sourced from knowledge records |
| 4 | All facts correct; minor phrasing could imply more certainty than warranted |
| 3 | Mostly correct; one minor inaccuracy or unverified detail |
| 2 | Contains a factual error that could mislead the user |
| 1 | Contains fabricated information (hallucination) |

**Critical failures (automatic score of 1):**
- Invented hours, menu items, prices, events, or policies
- Claimed reservation availability without booking system integration
- Provided incorrect contact information

---

## Dimension 2: Usefulness

> Does the response actually help the user accomplish their goal?

| Score | Description |
|-------|-------------|
| 5 | Directly answers the question and provides actionable next steps |
| 4 | Answers the question with useful supporting detail |
| 3 | Answers the question but lacks helpful context or next steps |
| 2 | Partially addresses the question; user likely needs to follow up |
| 1 | Does not address the user's question at all |

**Evaluation questions:**
- Would the user know what to do next after reading this response?
- Does the response anticipate likely follow-up needs?
- If the chatbot couldn't fully answer, did it provide an alternative path?

---

## Dimension 3: Clarity

> Is the response easy to read and understand?

| Score | Description |
|-------|-------------|
| 5 | Clear, well-structured, immediately understandable |
| 4 | Clear with good structure; minor improvements possible |
| 3 | Understandable but could be better organized or more concise |
| 2 | Confusing structure, unnecessary complexity, or ambiguous phrasing |
| 1 | Difficult to understand; user would be confused |

**Evaluation questions:**
- Can the user extract the answer within 5 seconds of reading?
- Is formatting (lists, line breaks) used appropriately?
- Is the response free of jargon or unnecessary qualifiers?

---

## Dimension 4: Correct Use of Knowledge

> Does the response properly leverage available business knowledge?

| Score | Description |
|-------|-------------|
| 5 | Uses the most relevant knowledge source; nothing important omitted |
| 4 | Uses appropriate knowledge; minor additional detail could help |
| 3 | Uses knowledge but misses relevant available data |
| 2 | Ignores available knowledge or uses wrong source |
| 1 | No knowledge used when it was clearly available |

**Evaluation questions:**
- Did the response use the highest-priority available source (per trust hierarchy)?
- Was relevant knowledge omitted that would have improved the answer?
- Did the response mix verified and unverified claims without distinction?

---

## Dimension 5: Appropriate Escalation

> Does the response correctly decide whether to answer directly or escalate?

| Score | Description |
|-------|-------------|
| 5 | Perfect escalation decision — answered when able, escalated when needed |
| 4 | Correct decision with minor room for improvement in execution |
| 3 | Slightly over- or under-escalated but not harmful |
| 2 | Failed to escalate when clearly needed, or escalated unnecessarily |
| 1 | Dangerously wrong — tried to handle what required staff, or refused a simple question |

**Critical scenarios:**
- Complaints must escalate to staff
- Allergen safety questions should answer from knowledge + recommend staff confirmation
- Private event inquiries should escalate
- Simple hours/menu questions should never escalate

---

## Dimension 6: Hallucination Avoidance

> Does the response avoid inventing or fabricating information?

| Score | Description |
|-------|-------------|
| 5 | No fabricated information; honest about knowledge gaps |
| 4 | No fabrication; could be slightly more explicit about uncertainty |
| 3 | No clear fabrication but some inferred details beyond available knowledge |
| 2 | Contains plausible-sounding but unverified claims |
| 1 | Contains clear fabrications presented as fact |

**Red flags to check:**
- Specific times, prices, or menu items not in knowledge records
- "We usually..." or "typically..." about specific business facts
- Staff names or promises about service
- Claims about real-time availability

---

## Dimension 7: Tone

> Does the response reflect the expected hospitality tone?

| Score | Description |
|-------|-------------|
| 5 | Warm, natural, concise — reads like a great hospitality staff member |
| 4 | Good tone with minor robotic or stiff phrasing |
| 3 | Acceptable but noticeably impersonal or overly formal |
| 2 | Robotic, verbose, or inappropriately casual |
| 1 | Cold, dismissive, or aggressive |

**Tone markers to evaluate:**
- Does it sound like a person or a machine?
- Is it concise without being curt?
- Does it avoid "I am an AI" disclaimers?
- Is upselling absent unless directly relevant?

---

## Composite Scoring

### Weighted formula:

| Dimension | Weight | Rationale |
|-----------|--------|-----------|
| Accuracy | 25% | Incorrect info directly harms users |
| Hallucination Avoidance | 20% | Fabrication is the highest-risk failure mode |
| Usefulness | 20% | Core purpose is to help users |
| Correct Use of Knowledge | 15% | Proper knowledge usage drives accuracy |
| Appropriate Escalation | 10% | Safety net for complex cases |
| Clarity | 5% | Readability matters but is lower risk |
| Tone | 5% | Brand alignment is important but secondary |

### Composite score calculation:

$$\text{Score} = 0.25A + 0.20H + 0.20U + 0.15K + 0.10E + 0.05C + 0.05T$$

Where: $A$ = Accuracy, $H$ = Hallucination Avoidance, $U$ = Usefulness, $K$ = Knowledge Use, $E$ = Escalation, $C$ = Clarity, $T$ = Tone

### Quality thresholds:

| Composite Score | Rating | Action |
|----------------|--------|--------|
| 4.5–5.0 | Excellent | No action needed |
| 3.5–4.4 | Good | Minor improvements optional |
| 2.5–3.4 | Needs Improvement | Should be addressed in next iteration |
| 1.5–2.4 | Poor | Requires immediate attention |
| 1.0–1.4 | Critical | Blocking issue — must fix before deployment |

---

## Evaluation Process

### Per-test evaluation:

1. Run test prompt against the chatbot
2. Record the actual response
3. Score each of the 7 dimensions (1–5)
4. Calculate composite score
5. Log any issues in the [Chatbot Gap Log](chatbot-gap-log.md)

### Batch evaluation:

1. Run all tests in a category
2. Calculate average composite score per category
3. Identify lowest-scoring dimensions across the batch
4. Prioritize improvements by dimension weight × severity

### Regression evaluation:

1. After code changes, re-run previously failing tests
2. Verify scores improved without degrading other tests
3. Update gap log with resolution status
