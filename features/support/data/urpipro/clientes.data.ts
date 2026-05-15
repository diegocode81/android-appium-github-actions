import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";

export type ClienteRow = {
  caseId: string;
  userKey: string;
  dni: string;
};

const CSV_PATH = path.resolve(
  process.cwd(),
  "features/resources/data/urpipro/clientes.csv"
);

let cache: ClienteRow[] | null = null;

function loadClientes(): ClienteRow[] {
  if (cache) return cache;

  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`[clientes.data] No existe el CSV: ${CSV_PATH}`);
  }

  const csvText = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as ClienteRow[];

  cache = rows.map((r) => ({
    caseId: String(r.caseId || "").trim(),
    userKey: String(r.userKey || "").trim(),
    dni: String(r.dni || "").trim(),
  }));

  return cache!;
}

export function getClientesByUserKey(userKey: string): ClienteRow[] {
  const all = loadClientes();
  const filtered = all.filter((r) => r.userKey === userKey);

  if (!filtered.length) {
    throw new Error(
      `[clientes.data] No hay DNIs en clientes.csv para userKey="${userKey}"`
    );
  }
  return filtered;
}
