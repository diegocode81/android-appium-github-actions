import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

export type UserRow = {
  userKey: string;
  username: string;
  password: string;
};

const USERS_CSV_PATH = path.resolve(
  process.cwd(),
  'features/resources/data/urpipro/users.csv'
);

let cache: Record<string, UserRow> | null = null;

function loadUsers(): Record<string, UserRow> {
  if (cache) return cache;

  const csv = fs.readFileSync(USERS_CSV_PATH, 'utf8');
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as UserRow[];

  cache = {};
  for (const row of rows) {
    cache[row.userKey] = row;
  }

  return cache;
}

export function getUserByKey(userKey: string): UserRow {
  const users = loadUsers();
  const user = users[userKey];

  if (!user) {
    throw new Error(
      `[users.data] No existe userKey="${userKey}" en users.csv`
    );
  }

  return user;
}
