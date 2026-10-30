import { describe, expect, it } from "vitest";
import { analyzeReadability, countSyllables, describeEase, readabilityStats, scoresFromStats, splitSentences } from "../src/readability";

describe("countSyllables", () => {
  it("counts ordinary English words", () => {
    const expected: Record<string, number> = {
      the: 1, cat: 1, water: 2, table: 2, little: 2, jumped: 1, wanted: 2, needed: 2, beautiful: 3, computer: 3, readability: 5, understand: 3, information: 4,
      make: 1, home: 1, happy: 2, strength: 1, through: 1, idea: 3, created: 3, people: 2, science: 2, queue: 1, rhythm: 2,
    };
    for (const [word, n] of Object.entries(expected)) expect(countSyllables(word), word).toBe(n);
  });

  it("ignores case and punctuation, and gives numbers one syllable", () => {
    expect(countSyllables("Beautiful!")).toBe(3);
    expect(countSyllables("don't")).toBe(1);
    expect(countSyllables("2026")).toBe(1);
    expect(countSyllables("")).toBe(0);
    expect(countSyllables("...")).toBe(0);
  });
});

describe("splitSentences", () => {
  it("splits on . ! ? and keeps the punctuation", () => {
    expect(splitSentences("One. Two! Three? Four.")).toEqual(["One.", "Two!", "Three?", "Four."]);
  });

  it("is not fooled by abbreviations, decimals, initials or ellipses", () => {
    expect(splitSentences("Dr. Smith paid $3.50 for it. He left.")).toEqual(["Dr. Smith paid $3.50 for it.", "He left."]);
    expect(splitSentences("We went to the U.S. last year. It was fun.")).toHaveLength(2);
    expect(splitSentences("Wait... what? Yes.")).toEqual(["Wait... what?", "Yes."]);
    expect(splitSentences("It cost 3.5 million. Wow.")).toHaveLength(2);
  });

  it("keeps closing quotes with their sentence and handles a missing final full stop", () => {
    expect(splitSentences('She said "stop." Then she left')).toEqual(['She said "stop."', "Then she left"]);
  });

  it("returns nothing for blank text and ignores lines with no letters", () => {
    expect(splitSentences("  \n ")).toEqual([]);
    expect(splitSentences("... !!!")).toEqual([]);
  });
});

describe("scoresFromStats: the published formulas", () => {
  // 100 words, 5 sentences, 150 syllables, 500 letters, 10 polysyllables, 8 complex words.
  const stats = { characters: 600, letters: 500, words: 100, sentences: 5, syllables: 150, polysyllables: 10, complexWords: 8 };
  const scores = scoresFromStats(stats);

  it("Flesch Reading Ease = 206.835 - 1.015 W/S - 84.6 Syl/W", () => {
    expect(scores.fleschReadingEase).toBeCloseTo(206.835 - 1.015 * 20 - 84.6 * 1.5, 1);
  });
  it("Flesch-Kincaid grade = 0.39 W/S + 11.8 Syl/W - 15.59", () => {
    expect(scores.fleschKincaidGrade).toBeCloseTo(0.39 * 20 + 11.8 * 1.5 - 15.59, 1);
  });
  it("Gunning Fog = 0.4 (W/S + 100 complex/W)", () => {
    expect(scores.gunningFog).toBeCloseTo(0.4 * (20 + 8), 1);
  });
  it("SMOG = 1.043 sqrt(poly x 30/S) + 3.1291", () => {
    expect(scores.smog).toBeCloseTo(1.043 * Math.sqrt(10 * 6) + 3.1291, 1);
  });
  it("Coleman-Liau = 0.0588 L - 0.296 S - 15.8", () => {
    expect(scores.colemanLiau).toBeCloseTo(0.0588 * 500 - 0.296 * 5 - 15.8, 1);
  });
  it("ARI = 4.71 chars/word + 0.5 W/S - 21.43", () => {
    expect(scores.automatedReadability).toBeCloseTo(4.71 * 5 + 0.5 * 20 - 21.43, 1);
  });
  it("averages the five grade levels", () => {
    const mean = (scores.fleschKincaidGrade + scores.gunningFog + scores.smog + scores.colemanLiau + scores.automatedReadability) / 5;
    expect(scores.averageGrade).toBeCloseTo(mean, 1);
  });
  it("returns zeros for no words", () => {
    expect(scoresFromStats({ characters: 0, letters: 0, words: 0, sentences: 0, syllables: 0, polysyllables: 0, complexWords: 0 }).averageGrade).toBe(0);
  });
});

describe("readabilityStats", () => {
  it("counts words, sentences, letters and syllables in a short text", () => {
    const s = readabilityStats("The cat sat on the mat. It was happy.");
    expect(s).toMatchObject({ words: 9, sentences: 2, letters: 27, syllables: 10 });
    expect(s.polysyllables).toBe(0);
  });

  it("counts contractions and hyphenated words as single words", () => {
    expect(readabilityStats("Don't stop; it's a well-known fact.").words).toBe(6);
  });

  it("counts polysyllables and complex words, but not names in mid-sentence", () => {
    const s = readabilityStats("The government announced a comprehensive investigation. Then Washington responded.");
    expect(s.polysyllables).toBeGreaterThanOrEqual(4);
    const names = readabilityStats("We met Alexandria Constantinople today.");
    expect(names.complexWords).toBe(0);
    expect(names.polysyllables).toBeGreaterThan(0);
  });
});

describe("analyzeReadability", () => {
  const simple = "The dog ran. The cat sat. We like to play. It is fun. The sun is hot. I see a bird. We go home. It is late. Ask me why. Do not run.".repeat(3);
  const dense =
    "Notwithstanding the aforementioned considerations, the organization's comprehensive administrative reorganization necessitates extraordinarily meticulous interdepartmental coordination. " +
    "Consequently, institutional stakeholders recommended fundamentally reconsidering infrastructure responsibilities.";

  it("rates simple text easy and dense text hard", () => {
    const easy = analyzeReadability(simple);
    const hard = analyzeReadability(dense);
    expect(easy.scores.fleschReadingEase).toBeGreaterThan(90);
    expect(easy.scores.fleschKincaidGrade).toBeLessThan(3);
    expect(hard.scores.fleschReadingEase).toBeLessThan(10);
    expect(hard.scores.fleschKincaidGrade).toBeGreaterThan(15);
    expect(hard.level.label).toMatch(/difficult/i);
    expect(easy.level.label).toBe("Very easy");
  });

  it("reports averages, and reading and speaking time", () => {
    const r = analyzeReadability(simple);
    expect(r.wordsPerSentence).toBeLessThan(5);
    expect(r.readingMinutes).toBeCloseTo(r.stats.words / 238, 1);
    expect(r.speakingMinutes).toBeGreaterThan(r.readingMinutes);
  });

  it("lists the hardest sentences first, and only long or hard ones", () => {
    const r = analyzeReadability(`${simple} ${dense}`);
    expect(r.hardSentences.length).toBeGreaterThan(0);
    expect(r.hardSentences.length).toBe(2);
    expect(r.hardSentences.every((h) => /Notwithstanding|Consequently/.test(h.text))).toBe(true);
    expect(r.hardSentences[0]!.ease).toBeLessThanOrEqual(r.hardSentences[1]!.ease);
    expect(r.hardSentences.every((s) => s.words >= 20 || s.ease < 30)).toBe(true);
    expect(analyzeReadability("The dog ran. The cat sat.").hardSentences).toEqual([]);
  });

  it("says when there is too little text or SMOG is unreliable", () => {
    expect(analyzeReadability("Short text.").notes[0]).toMatch(/fewer than 100 words/);
    const hundredWordsFewSentences = `${"word ".repeat(120)}end.`;
    expect(analyzeReadability(hundredWordsFewSentences).notes.join(" ")).toMatch(/SMOG/);
  });

  it("warns about text that is not English", () => {
    const r = analyzeReadability("这是一个很长的句子，用来测试可读性分数。".repeat(20));
    expect(r.notes.join(" ")).toMatch(/does not look like English|fewer than 100/);
  });

  it("handles empty text and very large text", () => {
    expect(analyzeReadability("").stats.words).toBe(0);
    expect(analyzeReadability("   ").scores.averageGrade).toBe(0);
    const big = "The quick brown fox jumps over the lazy dog. ".repeat(40_000);
    const t0 = Date.now();
    expect(analyzeReadability(big).stats.sentences).toBe(40_000);
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  it("describes every score band", () => {
    for (const n of [95, 85, 75, 65, 55, 40, 10, -20]) expect(describeEase(n).label.length).toBeGreaterThan(3);
  });
});
