import Link from "next/link";
import { getTool } from "@toolwright/tools";
import type { GuideBlock } from "../content/guides";

const link = "font-semibold underline decoration-2 underline-offset-4 hover:bg-marker hover:text-marker-foreground";

/** Renders the typed blocks of a guide. Tool blocks become a descriptive link to the tool. */
export function GuideBlocks({ blocks }: { blocks: readonly GuideBlock[] }) {
  return (
    <div className="mt-5 flex flex-col gap-5">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "p":
            return (
              <p key={i} className="max-w-[66ch] text-lg leading-relaxed">
                {block.text}
              </p>
            );
          case "ul":
            return (
              <ul key={i} className="max-w-[66ch] list-disc space-y-2 pl-6 text-lg leading-relaxed">
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="max-w-[66ch] list-decimal space-y-2 pl-6 text-lg leading-relaxed">
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            );
          case "table":
            return (
              <div key={i} className="overflow-x-auto border-y border-foreground">
                <table className="w-full min-w-[32rem] border-collapse text-left text-base">
                  <caption className="label-plate py-2 text-left">{block.caption}</caption>
                  <thead>
                    <tr className="border-b border-foreground">
                      {block.head.map((h, c) => (
                        <th key={c} scope="col" className="px-3 py-2 font-display font-bold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r} className="border-b border-border last:border-b-0">
                        {row.map((cell, c) => (
                          <td key={c} className={c === 0 ? "px-3 py-2 font-semibold" : "px-3 py-2"}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "tool": {
            const tool = getTool(block.slug);
            if (!tool) return null;
            return (
              <p key={i} className="max-w-[66ch] border-l-4 border-primary bg-card py-3 pl-4 pr-3 text-lg">
                {block.text}{" "}
                <Link href={`/tools/${tool.slug}`} className={link}>
                  Open {tool.name}
                </Link>
                .
              </p>
            );
          }
        }
      })}
    </div>
  );
}
