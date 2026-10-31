/** Visible FAQ as native disclosure elements. The same questions and answers feed the FAQPage JSON-LD on the page. */
export function FaqList({ items }: { items: readonly { question: string; answer: string }[] }) {
  return (
    <div className="border-t border-foreground">
      {items.map((f) => (
        <details key={f.question} className="group border-b border-border py-4">
          <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6 text-lg font-semibold hover:bg-marker hover:text-marker-foreground [&::-webkit-details-marker]:hidden">
            {f.question}
            <span aria-hidden className="font-mono text-xl font-medium">
              <span className="group-open:hidden">+</span>
              <span className="hidden group-open:inline">–</span>
            </span>
          </summary>
          <p className="mt-3 max-w-[62ch] text-muted-foreground">{f.answer}</p>
        </details>
      ))}
    </div>
  );
}
