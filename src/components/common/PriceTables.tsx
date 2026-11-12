/** @format */

import { useId } from "react";
import { cn } from "cn";

import type { PriceTable } from "@/lib/quantityPricing";

interface PriceTablesProps {
  tables: PriceTable[];
  // Heading level for each table's title, below the section around it.
  headingLevel?: 3 | 4;
  className?: string;
}

// Read-only quantity pricing, the same on the product and variant pages.
export function PriceTables({ tables, headingLevel = 3, className }: PriceTablesProps) {
  if (!tables.length) return null;
  return (
    <div className={cn("grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3", className)}>
      {tables.map((table) => (
        <PriceTableCard key={table.title} table={table} headingLevel={headingLevel} />
      ))}
    </div>
  );
}

function PriceTableCard({ table, headingLevel }: { table: PriceTable; headingLevel: 3 | 4 }) {
  const id = useId();
  const Heading = headingLevel === 4 ? "h4" : "h3";

  return (
    <section aria-labelledby={id} className="min-w-0">
      <Heading
        id={id}
        className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
      >
        {table.title}
      </Heading>
      <div className="overflow-hidden rounded-lg border bg-background">
        <table aria-labelledby={id} className="w-full border-collapse text-[13px]">
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="px-3 py-2 text-left">
                Quantity
              </th>
              {table.columns.map((column) => (
                <th key={column} scope="col" className="px-3 py-2 text-right">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={`${row.quantity}-${i}`} className="border-t">
                <th
                  scope="row"
                  className="px-3 py-2 text-left text-[13px] font-medium normal-case tracking-normal text-foreground"
                >
                  {row.quantity}
                </th>
                {row.cells.map((cell, c) => (
                  <td key={c} className="px-3 py-2 text-right text-foreground">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.note && <p className="mt-2 text-xs text-muted-foreground">{table.note}</p>}
    </section>
  );
}
