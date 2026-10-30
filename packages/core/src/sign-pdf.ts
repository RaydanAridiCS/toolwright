/** Logic for the "Sign PDF" tool. Keep this file free of React, the DOM and the network. */

export interface SignPdfOptions {
  uppercase?: boolean;
}

export function signPdf(input: string, options: SignPdfOptions = {}): string {
  // TODO: replace with the real implementation.
  return options.uppercase ? input.toUpperCase() : input;
}
