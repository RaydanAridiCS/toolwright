/**
 * Readability scores for English text: Flesch Reading Ease, Flesch-Kincaid grade, Gunning Fog, SMOG,
 * Coleman-Liau and the Automated Readability Index. The formulas are the published ones. Counting syllables is
 * the weak spot: it is a rule-of-thumb for English words, right for most but not all of them.
 * Keep this file free of React, the DOM and the network.
 */

export interface ReadabilityStats {
  characters: number;
  /** Letters and digits only. */
  letters: number;
  words: number;
  sentences: number;
  syllables: number;
  /** Words with three or more syllables. */
  polysyllables: number;
  /** Words with three or more syllables, not counting names or common endings (used by Gunning Fog). */
  complexWords: number;
}

export interface ReadabilityScores {
  /** 0 to 100 and beyond: higher is easier. */
  fleschReadingEase: number;
  /** US school grade. */
  fleschKincaidGrade: number;
  gunningFog: number;
  smog: number;
  colemanLiau: number;
  automatedReadability: number;
  /** The mean of the five grade-level scores. */
  averageGrade: number;
}

export interface HardSentence {
  text: string;
  words: number;
  /** Flesch Reading Ease of this sentence alone. */
  ease: number;
}

export interface ReadabilityResult {
  stats: ReadabilityStats;
  scores: ReadabilityScores;
  /** What the Flesch score means in words. */
  level: { label: string; audience: string };
  wordsPerSentence: number;
  syllablesPerWord: number;
  /** Minutes at 238 words per minute (silent reading) and 150 (reading aloud). */
  readingMinutes: number;
  speakingMinutes: number;
  /** Sentences that are long or hard, hardest first (at most 5). */
  hardSentences: HardSentence[];
  notes: string[];
}

const ABBREVIATIONS = new Set(["mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "etc", "e.g", "i.e", "inc", "ltd", "co", "no", "fig", "approx", "dept", "est", "u.s", "a.m", "p.m"]);
const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*(?:-[\p{L}\p{N}]+)*/gu;

/** Common words the rules get wrong, with the right count. */
const IRREGULAR: Record<string, number> = {
  idea: 3, area: 3, create: 2, created: 3, creating: 3, creation: 3, being: 2, science: 2, quiet: 2, video: 3, radio: 3, poem: 2, lion: 2, giant: 2, diet: 2,
  client: 2, pioneer: 3, society: 4, variety: 4, experience: 4, different: 3, every: 2, business: 2, people: 2, usually: 3, real: 1, really: 2, heaven: 2, evening: 2,
  rhythm: 2, queue: 1, league: 1, tongue: 1, unique: 2, fire: 1, hour: 1, our: 1, eyes: 1, once: 1, one: 1, evolve: 2, doing: 2, going: 2, seeing: 2, trying: 2, saying: 2, playing: 2, using: 2, whole: 1,
};

/** Syllables in one English word, by the usual rules. Never less than 1 for a real word. */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return /\d/.test(word) ? 1 : 0;
  if (w in IRREGULAR) return IRREGULAR[w] as number;
  if (w.length <= 3) return 1;
  // Drop a silent ending, then count groups of vowels.
  const stem = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  let count = stem.match(/[aeiouy]{1,3}/g)?.length ?? 0;
  const lead = (x: string) => x.match(/[aeiouy]{1,3}/g)?.length ?? 0;
  // A trailing "le" after a consonant is its own syllable (table, little), and "ted" or "ded" keeps its vowel (wanted).
  if (/[^aeiouy]le$/.test(w)) count = Math.max(count, lead(w.slice(0, -2)) + 1);
  if (/[td]ed$/.test(w)) count = Math.max(count, lead(w.slice(0, -2)) + 1);
  return Math.max(1, count);
}

/** Split text into sentences, without being fooled by Mr., 3.5, e.g. or ellipses. */
export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return sentences;
  let start = 0;
  const end = /[.!?]+["'”’)\]]*(?=\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = end.exec(clean))) {
    const before = clean.slice(start, m.index);
    const last = (/([\p{L}.]+)$/u.exec(before)?.[1] ?? "").toLowerCase().replace(/\.$/, "");
    const next = clean.slice(m.index + m[0].length).trimStart();
    const abbreviation = m[0][0] === "." && (ABBREVIATIONS.has(last) || /^[a-z]$/.test(last));
    const lowerNext = /^[a-z]/.test(next) && m[0][0] === ".";
    if (abbreviation || lowerNext) continue;
    const sentence = clean.slice(start, m.index + m[0].length).trim();
    if (sentence) sentences.push(sentence);
    start = m.index + m[0].length;
  }
  const rest = clean.slice(start).trim();
  if (rest) sentences.push(rest);
  return sentences.filter((s) => /[\p{L}\p{N}]/u.test(s));
}

const wordsOf = (text: string) => text.match(WORD) ?? [];

/** Words that Gunning Fog counts as complex: three or more syllables, not names, not just -es/-ed/-ing. */
function isComplex(word: string, sentenceStart: boolean): boolean {
  if (/^[A-Z]/.test(word) && !sentenceStart) return false;
  const base = word.toLowerCase().replace(/(?:es|ed|ing)$/, "");
  return countSyllables(base.length >= 3 ? base : word) >= 3;
}

/** The counts behind every score. */
export function readabilityStats(text: string): ReadabilityStats {
  const sentences = splitSentences(text);
  let words = 0;
  let letters = 0;
  let syllables = 0;
  let polysyllables = 0;
  let complexWords = 0;
  for (const sentence of sentences) {
    wordsOf(sentence).forEach((word, i) => {
      words++;
      letters += word.replace(/[^\p{L}\p{N}]/gu, "").length;
      const syl = countSyllables(word);
      syllables += syl;
      if (syl >= 3 && !/\d/.test(word)) polysyllables++;
      if (!/\d/.test(word) && isComplex(word, i === 0)) complexWords++;
    });
  }
  return { characters: text.replace(/\s/g, "").length, letters, words, sentences: sentences.length, syllables, polysyllables, complexWords };
}

const round = (n: number, digits = 1) => Math.round(n * 10 ** digits) / 10 ** digits;

/** The six formulas, from counts. Exported so they can be checked against the published definitions. */
export function scoresFromStats(s: ReadabilityStats): ReadabilityScores {
  const { words, sentences, syllables, letters, polysyllables, complexWords } = s;
  if (words === 0 || sentences === 0) return { fleschReadingEase: 0, fleschKincaidGrade: 0, gunningFog: 0, smog: 0, colemanLiau: 0, automatedReadability: 0, averageGrade: 0 };
  const wps = words / sentences;
  const spw = syllables / words;
  const fleschReadingEase = 206.835 - 1.015 * wps - 84.6 * spw;
  const fleschKincaidGrade = 0.39 * wps + 11.8 * spw - 15.59;
  const gunningFog = 0.4 * (wps + 100 * (complexWords / words));
  const smog = 1.043 * Math.sqrt(polysyllables * (30 / sentences)) + 3.1291;
  const colemanLiau = 0.0588 * ((letters / words) * 100) - 0.296 * ((sentences / words) * 100) - 15.8;
  const automatedReadability = 4.71 * (letters / words) + 0.5 * wps - 21.43;
  const grades = [fleschKincaidGrade, gunningFog, smog, colemanLiau, automatedReadability];
  return {
    fleschReadingEase: round(fleschReadingEase),
    fleschKincaidGrade: round(fleschKincaidGrade),
    gunningFog: round(gunningFog),
    smog: round(smog),
    colemanLiau: round(colemanLiau),
    automatedReadability: round(automatedReadability),
    averageGrade: round(grades.reduce((a, b) => a + b, 0) / grades.length),
  };
}

/** What a Flesch Reading Ease score means. */
export function describeEase(score: number): { label: string; audience: string } {
  if (score >= 90) return { label: "Very easy", audience: "Easily understood by an 11-year-old" };
  if (score >= 80) return { label: "Easy", audience: "Conversational English" };
  if (score >= 70) return { label: "Fairly easy", audience: "Easy for a 13 to 15-year-old" };
  if (score >= 60) return { label: "Plain English", audience: "Most 13 to 15-year-olds can follow it" };
  if (score >= 50) return { label: "Fairly difficult", audience: "Some high-school reading level" };
  if (score >= 30) return { label: "Difficult", audience: "College reading level" };
  if (score >= 0) return { label: "Very difficult", audience: "Best understood by university graduates" };
  return { label: "Extremely difficult", audience: "Dense even for graduates; consider splitting it up" };
}

/** Analyse English text. */
export function analyzeReadability(text: string): ReadabilityResult {
  const stats = readabilityStats(text);
  const scores = scoresFromStats(stats);
  const notes: string[] = [];
  if (stats.words < 100) notes.push("Scores are unreliable for fewer than 100 words. Paste more text.");
  if (stats.sentences < 30 && stats.words >= 100) notes.push("SMOG is designed for samples of 30 sentences or more, so treat it as a rough guide here.");
  const latin = text.match(/\p{Script=Latin}/gu)?.length ?? 0;
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  if (letters > 0 && latin < letters / 2) {
    notes.push("The text does not look like English. These formulas were made for English, so the scores will not mean much.");
  }

  const hardSentences: HardSentence[] = splitSentences(text)
    .map((sentence) => {
      const st = readabilityStats(sentence);
      const ease = st.words ? 206.835 - 1.015 * st.words - 84.6 * (st.syllables / st.words) : 100;
      return { text: sentence, words: st.words, ease: round(ease) };
    })
    .filter((s) => s.words >= 20 || s.ease < 30)
    .sort((a, b) => a.ease - b.ease)
    .slice(0, 5);

  return {
    stats,
    scores,
    level: describeEase(scores.fleschReadingEase),
    wordsPerSentence: stats.sentences ? round(stats.words / stats.sentences) : 0,
    syllablesPerWord: stats.words ? round(stats.syllables / stats.words, 2) : 0,
    readingMinutes: round(stats.words / 238),
    speakingMinutes: round(stats.words / 150),
    hardSentences,
    notes,
  };
}
