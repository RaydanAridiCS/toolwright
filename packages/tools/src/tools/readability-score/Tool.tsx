"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Panel, ResultSlab, Stat, StatGrid, Textarea } from "@toolwright/ui";
import { analyzeReadability } from "@toolwright/core/readability";
import { formatInt } from "../../shared/format";

const SAMPLE = `Good writing is easy to read. Short sentences help. So do plain words. When you use a long, winding sentence full of unnecessary qualifications, subordinate clauses and sophisticated terminology, the reader must work considerably harder to extract your meaning, and many will simply stop trying. Try to say one thing at a time. Cut every word that does no work. Then read it aloud and see whether you would say it that way.

A score is only a guide. It counts words and syllables; it cannot tell whether your ideas are clear. Use it to find the sentences that deserve a second look.`;

const GRADES = [
  { key: "fleschKincaidGrade", label: "Flesch-Kincaid grade" },
  { key: "gunningFog", label: "Gunning Fog" },
  { key: "smog", label: "SMOG" },
  { key: "colemanLiau", label: "Coleman-Liau" },
  { key: "automatedReadability", label: "Automated Readability" },
] as const;

const minutes = (m: number) => (m < 1 ? `${Math.max(1, Math.round(m * 60))} sec` : `${m.toFixed(1)} min`);

export default function Tool() {
  // Plain state, not the URL: this is often an unpublished draft.
  const [text, setText] = useState("");
  const result = useMemo(() => (text.trim() ? analyzeReadability(text) : null), [text]);

  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Your text"
        actions={
          <Button size="sm" variant="ghost" onClick={() => setText(SAMPLE)}>
            Sample
          </Button>
        }
      >
        <Textarea aria-label="Your text" rows={12} className="min-h-56" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste English text here. 100 words or more gives the best result." />
      </Panel>

      {result ? (
        <>
          <ResultSlab
            label="Flesch Reading Ease"
            value={String(result.scores.fleschReadingEase)}
            note={`${result.level.label}. ${result.level.audience}. Higher is easier.`}
            valueTestId="flesch-score"
          />
          {result.notes.map((note) => (
            <Alert key={note} tone="warning">
              {note}
            </Alert>
          ))}

          <Panel title="Grade level (US school years)">
            <StatGrid>
              <Stat label="Average" value={result.scores.averageGrade} />
              {GRADES.map((g) => (
                <Stat key={g.key} label={g.label} value={result.scores[g.key]} />
              ))}
            </StatGrid>
          </Panel>

          <Panel title="The counts behind it">
            <StatGrid>
              <Stat label="Words" value={formatInt(result.stats.words)} />
              <Stat label="Sentences" value={formatInt(result.stats.sentences)} />
              <Stat label="Words per sentence" value={result.wordsPerSentence} />
              <Stat label="Syllables per word" value={result.syllablesPerWord} />
              <Stat label="Long words (3+ syllables)" value={formatInt(result.stats.polysyllables)} />
              <Stat label="Reading time" value={minutes(result.readingMinutes)} />
              <Stat label="Reading aloud" value={minutes(result.speakingMinutes)} />
            </StatGrid>
          </Panel>

          {result.hardSentences.length > 0 ? (
            <Panel title="Sentences worth a second look">
              <ol aria-label="Hard sentences" className="border-t border-border">
                {result.hardSentences.map((s, i) => (
                  <li key={i} className="border-b border-border py-3 text-sm">
                    <p>{s.text}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {s.words} words · ease {s.ease}
                    </p>
                  </li>
                ))}
              </ol>
            </Panel>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
