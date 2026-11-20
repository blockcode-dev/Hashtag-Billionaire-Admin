/** @format */

// Helpers for the CSV import pages (products, pricing templates).

// The extensions the backend's CSV upload accepts.
export const CSV_EXTENSIONS = [".csv", ".txt", ".tsv"];

export const extensionOf = (name: string) =>
  name.includes(".") ? name.slice(name.lastIndexOf(".")).toLowerCase() : "";

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export const fileSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// Saves text as a file. The byte order mark makes Excel open it as UTF-8.
export const downloadCsv = (name: string, csv: string) => {
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
