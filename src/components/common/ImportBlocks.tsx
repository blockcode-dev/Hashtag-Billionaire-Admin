/** @format */

import type { ReactNode } from "react";
import type { CheckCircle2 } from "lucide-react";
import { cn } from "cn";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// The pieces the CSV import pages (products, pricing templates) are built from, so they look and
// read the same.

export interface ImportIssue {
  // The spreadsheet row (the header is row 1); null for the file as a whole.
  row: number | null;
  column: string | null;
  message: string;
}

const TONES = {
  bad: "border-destructive-border bg-destructive-soft text-destructive-soft-foreground",
  warn: "border-warning-border bg-warning-soft text-warning-soft-foreground",
  good: "border-success-border bg-success-soft text-success-soft-foreground",
} as const;

export type ImportTone = keyof typeof TONES;

export function Callout({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: ImportTone;
  icon: typeof CheckCircle2;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={cn("flex gap-3 rounded-lg border px-4 py-3", TONES[tone])}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="space-y-1 text-sm">
        <p className="font-medium">{title}</p>
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: number; tone?: ImportTone }) {
  return (
    <div className={cn("min-w-28 rounded-lg border px-3 py-2", tone ? TONES[tone] : "bg-muted/30")}>
      <div className="text-xl font-semibold tabular-nums">{value.toLocaleString()}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}

export function Rule({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="rounded-lg border bg-muted/20 px-4 py-3">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </li>
  );
}

export function IssueTable({ issues, label = "What to fix" }: { issues: ImportIssue[]; label?: string }) {
  return (
    <div className="max-h-96 overflow-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Row</TableHead>
            <TableHead className="w-44">Column</TableHead>
            <TableHead>{label}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((issue, i) => (
            <TableRow key={i}>
              <TableCell className="tabular-nums">{issue.row ?? "File"}</TableCell>
              <TableCell>{issue.column ?? "—"}</TableCell>
              <TableCell className="whitespace-normal">{issue.message}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
