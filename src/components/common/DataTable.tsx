import type { CSSProperties, Key, ReactNode } from "react";
import { cn } from "cn";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "./Checkbox";
import { EmptyState } from "./EmptyState";
import { Pagination, type PaginationProps } from "./Pagination";
import { Spinner } from "./Spinner";

export interface DataTableColumn<T> {
  title?: ReactNode;
  key?: string;
  // Field shown when there is no render function; also passed to render as `value`.
  dataIndex?: keyof T & string;
  render?: (value: any, record: T, index: number) => ReactNode;
  width?: number | string;
  align?: "left" | "center" | "right";
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  dataSource: T[];
  rowKey: (keyof T & string) | ((record: T) => Key);
  loading?: boolean;
  // Omit or pass false for no pagination.
  pagination?: PaginationProps | false;
  rowSelection?: {
    selectedRowKeys: Key[];
    onChange: (keys: Key[]) => void;
  };
  emptyText?: ReactNode;
  rowClassName?: string | ((record: T, index: number) => string);
  onRowClick?: (record: T) => void;
  // Minimum table width; narrower screens scroll the table sideways.
  scrollX?: number;
  tableLayout?: "auto" | "fixed";
  className?: string;
  style?: CSSProperties;
}

export function DataTable<T>({
  columns,
  dataSource,
  rowKey,
  loading,
  pagination,
  rowSelection,
  emptyText,
  rowClassName,
  onRowClick,
  scrollX,
  tableLayout = "auto",
  className,
  style,
}: DataTableProps<T>) {
  const keyOf = (record: T): Key =>
    typeof rowKey === "function" ? rowKey(record) : (record[rowKey] as unknown as Key);

  const pageKeys = dataSource.map(keyOf);
  const selected = new Set(rowSelection?.selectedRowKeys ?? []);
  const allSelected = pageKeys.length > 0 && pageKeys.every((k) => selected.has(k));
  const someSelected = !allSelected && pageKeys.some((k) => selected.has(k));

  const toggleAll = () => {
    if (!rowSelection) return;
    const others = rowSelection.selectedRowKeys.filter((k) => !pageKeys.includes(k));
    rowSelection.onChange(allSelected ? others : [...others, ...pageKeys]);
  };
  const toggleRow = (key: Key) => {
    if (!rowSelection) return;
    const keys = rowSelection.selectedRowKeys;
    rowSelection.onChange(keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]);
  };

  const colCount = columns.length + (rowSelection ? 1 : 0);

  return (
    <div className={cn("flex flex-col gap-3", className)} style={style}>
      <div className="relative overflow-hidden rounded-xl border bg-background">
        <Table style={{ tableLayout, minWidth: scrollX }}>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              {rowSelection && (
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Select all rows on this page"
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                  />
                </TableHead>
              )}
              {columns.map((col, i) => (
                <TableHead
                  key={col.key ?? col.dataIndex ?? i}
                  style={{ width: col.width, textAlign: col.align }}
                >
                  {col.title}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {dataSource.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colCount}>
                  {loading ? <div className="h-32" /> : (emptyText ?? <EmptyState />)}
                </TableCell>
              </TableRow>
            ) : (
              dataSource.map((record, index) => {
                const key = keyOf(record);
                return (
                  <TableRow
                    key={key}
                    data-state={selected.has(key) ? "selected" : undefined}
                    className={cn(
                      typeof rowClassName === "function" ? rowClassName(record, index) : rowClassName,
                      onRowClick && "cursor-pointer",
                    )}
                    onClick={onRowClick ? () => onRowClick(record) : undefined}
                  >
                    {rowSelection && (
                      <TableCell>
                        <Checkbox
                          aria-label="Select row"
                          checked={selected.has(key)}
                          onChange={() => toggleRow(key)}
                        />
                      </TableCell>
                    )}
                    {columns.map((col, i) => {
                      const value = col.dataIndex ? record[col.dataIndex] : undefined;
                      return (
                        <TableCell
                          key={col.key ?? col.dataIndex ?? i}
                          style={{ width: col.width, textAlign: col.align }}
                          className={cn("whitespace-normal", col.className)}
                        >
                          {col.render ? col.render(value, record, index) : (value as ReactNode)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Spinner size="large" />
          </div>
        )}
      </div>

      {pagination && pagination.total > 0 && <Pagination {...pagination} />}
    </div>
  );
}
