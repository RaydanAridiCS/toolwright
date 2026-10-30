/** Logic for the "Readability Score Checker" tool. Keep this file free of React, the DOM and the network. */

export interface ReadabilityScoreOptions {
  uppercase?: boolean;
}

export function readabilityScore(input: string, options: ReadabilityScoreOptions = {}): string {
  // TODO: replace with the real implementation.
  return options.uppercase ? input.toUpperCase() : input;
}
