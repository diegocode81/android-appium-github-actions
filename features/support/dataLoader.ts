import * as fs from "fs";
import * as path from "path";

type Row = Record<string, string>;

export type UserRow = {
  userKey: string;
  username: string;
  password: string;
};

export type ClienteRow = {
  caseId: string;
  userKey: string;
  dni: string;
};

export type CaseData = {
  caseId: string;
  userKey: string;
  username: string;
  password: string;
  dni: string;
};

function parseCsv(filePath: string): Row[] {
  const raw = fs.readFileSync(filePath, "utf-8");

  // Soporta CRLF/LF y elimina líneas vacías
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row: Row = {};
    headers.forEach((h, i) => (row[h] = values[i] ?? ""));
    return row;
  });
}

function dataPath(...parts: string[]) {
  // Ajusta a tu estructura real: features/resources/data/urpipro/...
  return path.join(process.cwd(), "features", "resources", "data", "urpipro", ...parts);
}

export function getCaseData(caseId: string): CaseData {
  const usersFile = dataPath("users.csv");
  const clientesFile = dataPath("clientes.csv");

  if (!fs.existsSync(usersFile)) {
    throw new Error(`No existe users.csv en: ${usersFile}`);
  }
  if (!fs.existsSync(clientesFile)) {
    throw new Error(`No existe clientes.csv en: ${clientesFile}`);
  }

  const users = parseCsv(usersFile) as unknown as UserRow[];
  const clientes = parseCsv(clientesFile) as unknown as ClienteRow[];

  const cliente = clientes.find((c) => c.caseId === caseId);
  if (!cliente) {
    throw new Error(`No encontré caseId="${caseId}" en clientes.csv`);
  }

  const user = users.find((u) => u.userKey === cliente.userKey);
  if (!user) {
    throw new Error(
      `No encontré userKey="${cliente.userKey}" en users.csv (referenciado por caseId="${caseId}")`
    );
  }

  // Soporta tu header actual: userKey,username,password
  const username = (user as any).username ?? (user as any).usuario ?? "";
  const password = (user as any).password ?? "";

  if (!username || !password) {
    throw new Error(
      `Credenciales incompletas para userKey="${cliente.userKey}". Revisa columnas en users.csv`
    );
  }

  if (!cliente.dni) {
    throw new Error(`DNI vacío para caseId="${caseId}" en clientes.csv`);
  }

  return {
    caseId: cliente.caseId,
    userKey: cliente.userKey,
    username,
    password,
    dni: cliente.dni,
  };
}
