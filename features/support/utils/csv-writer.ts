import * as fs from "fs";
import * as path from "path";

type CsvValue = string | number | boolean | null | undefined;

function escapeCsv(v: CsvValue): string {
  const s = (v ?? "").toString();
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function ensureDir(filePath: string) {
  const abs = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  const dir = path.dirname(abs);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return abs;
}

/**
 * ✅ Writer genérico:
 * - title: nombre lógico (para logs)
 * - filePath: dónde guardar (ej: reports/no_encontrados.csv)
 * - headers: columnas del csv
 * - data: objeto con valores por columna
 */
export function appendToCsv(params: {
  title: string;
  filePath: string;
  headers: string[];
  data: Record<string, CsvValue>;
}) {
  const { title, filePath, headers, data } = params;

  const abs = ensureDir(filePath);
  const mustWriteHeader = !fs.existsSync(abs) || fs.statSync(abs).size === 0;

  if (mustWriteHeader) {
    fs.appendFileSync(abs, headers.join(",") + "\n", { encoding: "utf-8" });
  }

  const line = headers.map((h) => escapeCsv(data[h])).join(",") + "\n";
  fs.appendFileSync(abs, line, { encoding: "utf-8" });

  // log opcional (para ver en consola)
  console.log(`[csv:${title}] appended -> ${abs}`);
}
