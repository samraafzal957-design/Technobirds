// AI-writing pattern knowledge base.
// Derived from "Wikipedia:Signs of AI writing" (WikiProject AI Cleanup) —
// the field guide of LLM stylistic tells — plus common detector heuristics.

/** High-signal LLM vocabulary words (weighted). */
export const AI_WORDS: Record<string, number> = {
  delve: 3, delves: 3, delved: 3, delving: 3,
  tapestry: 3, testament: 3, pivotal: 3, intricate: 2, intricacies: 3,
  landscape: 2, realm: 2, fostering: 2, fostered: 2, garner: 3, garnered: 3,
  interplay: 3, meticulous: 3, meticulously: 3, underscores: 3, underscored: 3,
  showcasing: 2, showcases: 2, boasts: 3, bolstered: 3, enduring: 2,
  vibrant: 2, holistic: 2, multifaceted: 3, seamless: 2, seamlessly: 2,
  everevolving: 3, navigating: 1, leverage: 2, leveraging: 2,
  paramount: 2, unparalleled: 3, groundbreaking: 2, cuttingedge: 2,
  transformative: 2, revolutionize: 2, revolutionizing: 2, harnessing: 2,
  epitomize: 3, epitomizes: 3, beacon: 2, symphony: 2, orchestrate: 2,
  orchestrating: 2, plethora: 3, myriad: 3, bustling: 2, thriving: 1,
  robust: 1, crucial: 1, comprehensive: 1, significant: 0.5, notably: 0.5,
};

/** Canned LLM phrases / constructions (strong signals, weighted). */
export const AI_PHRASES: Record<string, number> = {
  // Importance puffery ("Words to watch" — significance & legacy)
  "plays a crucial role": 4, "plays a vital role": 4, "plays a pivotal role": 4,
  "plays a significant role": 3, "plays a key role": 3, "plays an important role": 3,
  "crucial role in": 3, "pivotal role in": 4, "vital role in": 3,
  "a testament to": 4, "stands as a testament": 5, "serves as a testament": 5,
  "is a reminder of": 2, "underscores its importance": 4, "underscores the importance": 4,
  "highlights the importance": 3, "highlights its importance": 3, "emphasizes the importance": 3,
  "reflects broader": 3, "reflecting its": 3, "symbolizing its": 4, "symbolizes its": 4,
  "contributing to the": 2, "contributes to the": 2, "setting the stage for": 4,
  "marks a shift": 3, "marks a significant": 3, "represents a shift": 3, "represents a significant": 3,
  "key turning point": 4, "turning point in": 2, "focal point": 2,
  "indelible mark": 4, "deeply rooted": 2, "rich history": 1, "steeped in": 2,
  "enduring legacy": 4, "lasting legacy": 3, "lasting impact": 2, "profound impact": 2,
  "significant impact on": 1, "broader trends": 2, "cultural significance": 2,
  "evolving landscape": 4, "ever-evolving landscape": 5, "ever-evolving world": 5,
  "in today's fast-paced": 4, "in today's world": 3, "in the digital age": 3,
  "in an era of": 3, "in the realm of": 3, "in the world of": 2,
  "when it comes to": 1, "it is important to note": 3, "it is worth noting": 3,
  "worth noting that": 3, "it should be noted": 2, "serves as a reminder": 4,
  // Copulative avoidance ("is/are" replaced by serves-as etc.)
  "serves as": 2, "stands as": 3, "functions as": 2, "operates as": 2,
  "acts as": 1, "holds the distinction": 4, "refers to": 1,
  "boasts": 2, "features a": 1, "offers a": 1, "maintains a": 0.5,
  // Vague association
  "in connection with": 2, "connected with": 2, "in association with": 3,
  "associated with": 1, "closely tied to": 2, "deeply intertwined": 3,
  // Weasel attributions
  "experts argue": 3, "experts believe": 3, "observers have cited": 4,
  "industry reports": 3, "some critics argue": 4, "critics contend": 3,
  "many scholars": 2, "several sources": 2, "various studies": 2, "studies have shown": 1,
  "it is widely regarded": 3, "is widely considered": 1, "has been praised for": 2,
  // Notability/coverage canned emphasis
  "independent coverage": 4, "local media outlets": 3, "regional media outlets": 3,
  "national media outlets": 3, "trade publications": 3, "active social media presence": 5,
  "social media presence": 3, "written by a leading expert": 4,
  "featured in numerous": 3, "profiled in": 3, "cited in numerous": 3,
  // Participial superficial-analysis tails
  "highlighting the": 2, "underscoring the": 3, "emphasizing the": 2,
  "ensuring that": 2, "ensuring the": 2, "reflecting the": 2, "symbolizing the": 3,
  "cultivating": 2, "encompassing": 2, "align with": 2, "aligns with": 2,
  "resonate with": 2, "resonates with": 2, "valuable insights": 3,
  // Negative parallelisms
  "not only": 2, "but also": 1, "not just": 2, "more than just": 3,
  "rather than merely": 3, "isn't just": 3, "is not just": 3, "aren't just": 3,
  "no longer just": 3, "not merely": 2,
  // Rule-of-three glue
  ", and ": 0.4,
  // Hedging disclaimers about source availability
  "while specific details are limited": 5, "specific details are scarce": 4,
  "not widely available": 3, "not widely documented": 4, "limited information is available": 4,
  "based on available information": 4, "based on the available": 3,
  "in the provided sources": 4, "should be treated as": 3, "should not be confused with": 3,
  "does not by itself establish": 5, "maintains a low profile": 5,
  "keeps a low profile": 4, "keeps personal details private": 5,
  // Chatbot communication leaks
  "i hope this helps": 5, "of course!": 5, "certainly!": 5,
  "you're absolutely right": 5, "would you like": 3, "is there anything else": 5,
  "let me know if": 3, "here is a breakdown": 4, "more detailed breakdown": 4,
  "as an ai": 5, "i cannot provide": 2, "before publishing": 2,
  // Formulaic academic-register constructions (typical of LLM-drafted theses; low weight)
  "this dissertation examines": 2, "this study examines": 1.5, "this paper examines": 1.5,
  "the results show that": 1.5, "the results indicate that": 1.5, "this may be because": 1.5,
  "it can be seen that": 2, "it can be shown that": 2, "indicating that": 0.8,
  "suggesting that": 0.8, "indicating that the": 1, "significantly positively": 1.2,
  "significantly negatively": 1.2, "plays a mediating role": 2.5, "mediating role between": 2,
  "in terms of the": 0.6, "based on these arguments": 2.5, "the following hypotheses are developed": 2.5,
  "in general, after controlling": 2, "therefore, financing constraints play": 2.5,
  "hypothesis 1 holds": 1.5, "hypothesis 2 holds": 1.5, "verifies hypothesis": 1.5,

  // Formulaic closers
  "in conclusion": 2, "in summary": 1.5, "in essence": 2, "ultimately,": 1,
  "looking ahead": 3, "moving forward": 2, "the future of": 1,
  "challenges and": 1, "future outlook": 4, "future prospects": 4,
  "faces several challenges": 4, "despite these challenges": 4, "despite its challenges": 4,
  "awards and recognition": 4, "legacy and impact": 4, "impact and legacy": 4,
  "conclusion and": 2, "summary and": 1,
};

/** Regex patterns (structural / markup / artifact signals). */
export const AI_REGEXPS: { re: RegExp; weight: number; label: string }[] = [
  { re: /\bnot only\b[^.!?]{3,120}\bbut also\b/i, weight: 5, label: "negative-parallelism" },
  { re: /\bnot just\b[^.!?]{2,80}\b(it'?s|it is|but|rather)\b/i, weight: 4, label: "not-just-but" },
  { re: /\bisn'?t just\b[^.!?]{0,80}\b(it'?s|it is|but)\b/i, weight: 4, label: "not-just-but" },
  { re: /\bno\b[^,.!?]{1,40},\s*\bno\b[^,.!?]{1,40},\s*\bjust\b/i, weight: 4, label: "no-no-just" },
  { re: /\brather than\b/i, weight: 1.2, label: "rather-than" },
  // Rule of three: "X, Y, and Z" triads
  { re: /\b[\w'-]+,\s+[\w'-]+,\s+and\s+[\w'-]+/i, weight: 2, label: "rule-of-three" },
  { re: /\b[\w'-]+,\s+[\w'-]+,\s+or\s+[\w'-]+/i, weight: 1.5, label: "rule-of-three" },
  // Markdown / chatbot markup artifacts
  { re: /\*\*[^*\n]{1,80}\*\*/, weight: 5, label: "markdown-bold" },
  { re: /(^|\n)#{1,6}\s+\S/, weight: 4, label: "markdown-heading" },
  { re: /```/, weight: 5, label: "code-fence" },
  { re: /(^|\n)-{3,}(\n|$)/, weight: 3, label: "markdown-divider" },
  { re: /\[[^\]]{0,30}\]\((https?:\/\/|\/)[^)]*\)/, weight: 4, label: "markdown-link" },
  { re: /contentReference\[oaicite[:\d]*\]/i, weight: 6, label: "chatgpt-artifact" },
  { re: / utm_source=(chatgpt\.com|openai)/i, weight: 6, label: "chatgpt-utm" },
  { re: / utm_source=copilot\.com/i, weight: 6, label: "copilot-utm" },
  { re: /referrer=grok\.com/i, weight: 6, label: "grok-utm" },
  // Placeholder / template text
  { re: /\[(year|date|name|company|insert[^\]]*|add[^\]]*|placeholder[^\]]*|your[^\]]*)\]/i, weight: 4, label: "placeholder" },
  { re: /insert_[a-z_]{3,}/i, weight: 4, label: "placeholder-var" },
  { re: /\b20\d{2}-[xX]{2}-[xX]{2}\b/, weight: 4, label: "placeholder-date" },
  { re: /\bexample\.(com|org)\//i, weight: 3, label: "placeholder-url" },
  { re: /\(add [^)]{3,40} here\)/i, weight: 4, label: "fill-in-blank" },
  // Hedge-y academic AI connective stack (weak alone, strong in density)
  { re: /\b(furthermore|moreover|additionally)\b,/i, weight: 1.8, label: "connective" },
  { re: /\b(however|therefore|thus|hence|consequently|nevertheless)\b,/i, weight: 0.9, label: "connective" },
  { re: /\bin addition\b/i, weight: 0.8, label: "connective" },
  { re: /\b(overall|ultimately)\b/i, weight: 0.8, label: "closer" },
];

export const CONTRACTIONS = /\b(don't|doesn't|didn't|can't|couldn't|won't|wouldn't|isn't|aren't|wasn't|weren't|hasn't|haven't|it's|i'm|we're|they're|you're|that's|there's|let's)\b/gi;

/** Words whose presence in a URL/line marks a reference-like entry. */
export const REFERENCE_MARKERS = /https?:\/\/|doi:|isbn|\bet al\.|retrieved from|accessed \d|vol\.|pp\.\s?\d/i;
