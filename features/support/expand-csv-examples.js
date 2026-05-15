/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Directorios (puedes sobreescribir con env vars)
const FEATURES_SRC = process.env.FEATURES_SRC || 'features';
const FEATURES_OUT = process.env.FEATURES_OUT || 'features/support/.features_gen';

main().catch((e) => {
  console.error('[expand-csv-examples] Error:', e?.message || e);
  process.exit(1);
});

async function main() {
  // 1) Re-crear carpeta destino
  if (fs.existsSync(FEATURES_OUT)) {
    fs.rmSync(FEATURES_OUT, { recursive: true, force: true });
  }
  fs.mkdirSync(FEATURES_OUT, { recursive: true });

  // 2) Listar todos los .feature
  const featureFiles = listFeatureFiles(FEATURES_SRC);
  if (!featureFiles.length) {
    console.warn(`[expand-csv-examples] No se encontraron .feature en "${FEATURES_SRC}"`);
  }

  // 3) Expandir cada archivo y escribirlo en FEATURES_OUT manteniendo estructura
  for (const inFile of featureFiles) {
    const rel = path.relative(FEATURES_SRC, inFile);
    const outFile = path.join(FEATURES_OUT, rel);
    const outDir = path.dirname(outFile);
    fs.mkdirSync(outDir, { recursive: true });

    const original = fs.readFileSync(inFile, 'utf8');
    const expanded = expandFeatureText(original, inFile);
    fs.writeFileSync(outFile, expanded, 'utf8');
    console.log(`[expand-csv-examples] OK -> ${outFile}`);
  }

  console.log(`[expand-csv-examples] Hecho. Archivos generados en "${FEATURES_OUT}"`);
}

function listFeatureFiles(dir) {
  const out = [];
  walk(dir, (p) => {
    if (p.toLowerCase().endsWith('.feature')) out.push(p);
  });
  return out;
}

function walk(dir, onFile) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, onFile);
    else if (e.isFile()) onFile(p);
  }
}

/**
 * Expande todos los "Scenario Outline" cuyos Examples apunten a un CSV.
 * Formatos soportados:
 *  A) Tabla una sola columna:
 *     Examples:
 *       | csv |
 *       | resources/data/users.csv |
 *
 *  B) Inline:
 *     Examples: CSV "resources/data/users.csv"
 *
 * Los placeholders (<col>) deben existir como encabezados en el CSV.
 */
function expandFeatureText(text, filePath) {
  const regex = /(^|\n)([ \t]*)Scenario Outline:[\s\S]*?(?=(\n[ \t]*Scenario(?: Outline)?:|\n[ \t]*Rule:|\n[ \t]*Feature:|$))/g;
  let lastIndex = 0;
  let result = '';
  let match;

  while ((match = regex.exec(text)) !== null) {
    const blockStart = match.index + match[1].length;
    const indent = match[2] || '';
    const block = match[0].slice(match[1].length);

    // Copiar lo que va antes
    result += text.slice(lastIndex, blockStart);

    // Expandir este bloque si aplica
    const expandedBlock = expandOutlineBlock(block, indent, filePath);
    result += expandedBlock;

    lastIndex = blockStart + block.length;
  }

  // Cola
  result += text.slice(lastIndex);
  return result;
}

function expandOutlineBlock(block, baseIndent, filePath) {
  // 1) Placeholders de la plantilla (<username>, <password>, etc.)
  const placeholderOrder = [];
  const seen = new Set();
  const phRegex = /<([^>]+)>/g;
  let m;
  while ((m = phRegex.exec(block)) !== null) {
    const key = m[1].trim();
    if (!seen.has(key)) {
      seen.add(key);
      placeholderOrder.push(key);
    }
  }
  if (!placeholderOrder.length) return block;

  // 2) Procesar líneas del bloque y reemplazar sólo los Examples que tengan CSV
  const lines = block.split(/\r?\n/);
  let i = 0;
  const outLines = [];

  while (i < lines.length) {
    const line = lines[i];
    outLines.push(line);

    if (/^\s*Examples:/.test(line)) {
      // Inline "Examples: CSV "ruta""
      const inlineCsv = getInlineCsvPath(line);
      // o tabla bajo Examples (| csv | \n | ruta |)
      const tableInfo = !inlineCsv ? getCsvTableInfo(lines, i + 1) : null;

      if (inlineCsv || tableInfo) {
        // Determinar rango original del Examples (para saltarlo al reescribir)
        let j = i + 1;
        while (
          j < lines.length &&
          (
            /^\s*\|/.test(lines[j]) ||       // filas de tabla
            /^\s*(#.*)?$/.test(lines[j]) ||  // comentarios o vacío
            /^\s{2,}\S/.test(lines[j])       // líneas indented del bloque
          )
        ) {
          j++;
        }

        const csvPath = inlineCsv || tableInfo.path;
        const csvAbs = resolveCsvPath(csvPath, filePath);
        if (!csvAbs) {
          throw new Error(
            `[expand-csv-examples] No existe el CSV "${csvPath}" (buscado relativo a: ` +
            `${path.dirname(filePath)}, ${FEATURES_SRC} y la raíz del repo)`
          );
        }

        const csvText = fs.readFileSync(csvAbs, 'utf8');
        const rows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
        if (!rows.length) {
          throw new Error(`[expand-csv-examples] CSV "${csvPath}" está vacío (referencia en ${filePath})`);
        }

        // Validar encabezados necesarios
        const headers = Object.keys(rows[0] || {});
        const missing = placeholderOrder.filter((h) => !headers.includes(h));
        if (missing.length) {
          throw new Error(
            `[expand-csv-examples] Faltan columnas en "${csvPath}": ${missing.join(', ')}. ` +
            `Placeholders requeridos: ${placeholderOrder.join(', ')}. Archivo: ${filePath}`
          );
        }

        // Construir nuevo bloque de Examples expandido
        const indent = getIndentOfLine(line);
        const tableIndent = indent + '  ';
        const headerRow = `| ${placeholderOrder.join(' | ')} |`;
        const dataRows = rows.map((r) => `| ${placeholderOrder.map((h) => sanitizeCell(r[h])).join(' | ')} |`);

        const newBlock = [
          `${indent}Examples:`,
          `${tableIndent}${headerRow}`,
          ...dataRows.map((r) => `${tableIndent}${r}`)
        ];

        // Reemplazar: quitamos la línea de "Examples:" que ya pusimos y metemos el bloque nuevo
        outLines.pop();
        for (const l of newBlock) outLines.push(l);

        i = j;
        continue;
      }
    }

    i++;
  }

  return outLines.join('\n');
}

/** Intenta resolver una ruta de CSV de forma robusta. */
function resolveCsvPath(csvPath, featureFilePath) {
  const candidates = [
    // 1) relativo a la carpeta del .feature
    path.resolve(path.dirname(featureFilePath), csvPath),
    // 2) relativo a la carpeta "features" (raíz de features)
    path.resolve(FEATURES_SRC, csvPath),
    // 3) relativo a la raíz del repo (cwd)
    path.resolve(process.cwd(), csvPath)
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function getInlineCsvPath(examplesLine) {
  // Soporta:  Examples: CSV "ruta"   o   Examples: CSV 'ruta'
  const m = examplesLine.match(/Examples:\s*CSV\s+["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function getCsvTableInfo(lines, idx) {
  // Busca tabla inmediatamente después de "Examples:"
  // Encabezado de UNA celda: "csv" o "from_csv", y siguiente fila la ruta.
  if (idx >= lines.length) return null;

  let i = idx;
  while (i < lines.length && /^\s*(#.*)?$/.test(lines[i])) i++;
  if (i >= lines.length || !/^\s*\|/.test(lines[i])) return null;

  const headerCells = splitPipeRow(lines[i]);
  if (headerCells.length !== 1) return null;
  const header = headerCells[0].toLowerCase();
  if (header !== 'csv' && header !== 'from_csv') return null;

  let j = i + 1;
  while (j < lines.length && /^\s*(#.*)?$/.test(lines[j])) j++;
  if (j >= lines.length || !/^\s*\|/.test(lines[j])) return null;

  const pathCells = splitPipeRow(lines[j]);
  if (pathCells.length !== 1) return null;

  return { path: pathCells[0], start: i, end: j };
}

function splitPipeRow(line) {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return inner.split('|').map((c) => c.trim());
}

function getIndentOfLine(line) {
  const m = line.match(/^(\s*)/);
  return m ? m[1] : '';
}

function sanitizeCell(v) {
  if (v == null) return '';
  return String(v).replace(/\r?\n/g, ' ').trim();
}
