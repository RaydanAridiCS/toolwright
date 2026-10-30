/** Logic for the "Mermaid Diagram Editor" tool. Keep this file free of React, the DOM and the network. */

export interface MermaidEditorOptions {
  uppercase?: boolean;
}

export function mermaidEditor(input: string, options: MermaidEditorOptions = {}): string {
  // TODO: replace with the real implementation.
  return options.uppercase ? input.toUpperCase() : input;
}
