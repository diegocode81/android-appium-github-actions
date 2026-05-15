import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";

export type CreditosRow = {
  caseId: string;
  userKey: string;
  dni: string;
  monto:string;
};

const CSV_PATH = path.resolve(
  process.cwd(),
  "features/resources/data/urpipro/simularCredito.csv"
);

let cache: CreditosRow[] | null = null;

function loadCreditos(): CreditosRow[] {
  if (cache) return cache;
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`[clientes.data] No existe el CSV: ${CSV_PATH}`);
  }

  const csvText = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CreditosRow[];

  cache = rows.map((r) => ({
    caseId: String(r.caseId || "").trim(),
    userKey: String(r.userKey || "").trim(),
    dni: String(r.dni || "").trim(),
    monto: String(r.monto || "").trim(),
  }));
  return cache!;
}

export function getCreditosByUserKey(userKey: string): CreditosRow[] {
  const all = loadCreditos();
  const filtered = all.filter((r) => r.userKey === userKey);

  if (!filtered.length) {
    throw new Error(
      `[creditos.data] No hay DNIs en clientes.csv para userKey="${userKey}"`
    );
  }
  return filtered;
}