const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const JSZip = require("jszip");

const ROOT = path.resolve(__dirname, "../..");
const DEFAULT_TEMPLATE = path.resolve(
  ROOT,
  "templates/CASO-XXXXX Documento de Evidencias V1.01.docx",
);
const ALLURE_DIR = path.resolve(ROOT, "allure-results");
const OUTPUT_DIR = path.resolve(ROOT, "reporte-mibanco");
const APK_PATH = path.resolve(ROOT, "apps/android/urpipro.apk");

const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const IMAGE_REL =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(ms = Date.now()) {
  const d = new Date(ms);
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: process.env.TZ || "America/Guayaquil",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function safeName(value) {
  return String(value || "reporte")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function findAapt2() {
  const sdkRoots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(process.env.HOME || "", "Library/Android/sdk"),
  ].filter(Boolean);

  const candidates = [];
  for (const sdkRoot of sdkRoots) {
    const buildTools = path.join(sdkRoot, "build-tools");
    if (!fs.existsSync(buildTools)) continue;

    for (const version of fs.readdirSync(buildTools)) {
      const aapt2 = path.join(buildTools, version, "aapt2");
      if (fs.existsSync(aapt2)) candidates.push(aapt2);
    }
  }

  return candidates.sort().at(-1) || null;
}

function readApkVersion() {
  const fromEnv = process.env.APK_VERSION || process.env.REPORT_APK_VERSION;
  if (fromEnv) return fromEnv.replace(/^v/i, "");

  if (!fs.existsSync(APK_PATH)) return "N/D";

  const aapt2 = findAapt2();
  if (!aapt2) return "N/D";

  try {
    const output = execFileSync(aapt2, ["dump", "badging", APK_PATH], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output.match(/versionName='([^']+)'/)?.[1] || "N/D";
  } catch {
    return "N/D";
  }
}

function updateHeaderTitle(xml, apkVersion) {
  const title = `Evidencia de pruebas - Ambiente de calidad - apk v${apkVersion}`;
  return xml.replace(
    /(<w:t[^>]*>)[^<]*Evidencia de pruebas[^<]*Ambiente[^<]*(<\/w:t>)/g,
    `$1${xmlEscape(title)}$2`,
  );
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function findLabel(result, name) {
  return result.labels?.find((label) => label.name === name)?.value || "";
}

function extractUserKey(result) {
  const when = result.steps?.find((step) =>
    /^When inicio sesion con el usuario /.test(step.name || ""),
  );
  const match = when?.name?.match(/"([^"]+)"/);
  return match?.[1] || "";
}

function flattenAttachments(result) {
  const attachments = [];
  for (const step of result.steps || []) {
    for (const attachment of step.attachments || []) {
      if (attachment.type === "image/png") {
        attachments.push({
          stepName: step.name,
          status: step.status,
          source: attachment.source,
        });
      }
    }
  }
  return attachments;
}

function loadResults() {
  if (!fs.existsSync(ALLURE_DIR)) return [];

  return fs
    .readdirSync(ALLURE_DIR)
    .filter((name) => name.endsWith("-result.json"))
    .map((name) => {
      const result = readJson(path.join(ALLURE_DIR, name));
      return {
        uuid: result.uuid,
        name: result.name || "Escenario",
        feature: findLabel(result, "feature") || findLabel(result, "suite"),
        status: result.status || "unknown",
        start: result.start || 0,
        stop: result.stop || 0,
        userKey: extractUserKey(result),
        steps: result.steps || [],
        attachments: flattenAttachments(result),
      };
    })
    .sort((a, b) => a.start - b.start);
}

function cleanOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const entry of fs.readdirSync(OUTPUT_DIR)) {
    if (!entry.toLowerCase().endsWith(".docx")) continue;
    fs.rmSync(path.join(OUTPUT_DIR, entry), { force: true });
  }
}

function pngSize(buffer) {
  if (
    buffer.length >= 24 &&
    buffer.toString("ascii", 1, 4) === "PNG" &&
    buffer.toString("ascii", 12, 16) === "IHDR"
  ) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }
  return { width: 1080, height: 2340 };
}

function paragraph(text, opts = {}) {
  const bold = opts.bold ? "<w:b/><w:bCs/>" : "";
  const size = opts.size || "20";
  const color = opts.color || "000000";
  const spacing = opts.after == null ? "120" : String(opts.after);
  const align = opts.align ? `<w:jc w:val="${opts.align}"/>` : "";

  return `<w:p><w:pPr><w:spacing w:after="${spacing}"/>${align}<w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic" w:eastAsia="Century Gothic" w:cs="Century Gothic"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:color w:val="${color}"/>${bold}</w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic" w:eastAsia="Century Gothic" w:cs="Century Gothic"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:color w:val="${color}"/>${bold}</w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
}

function pageBreak() {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

function tableRow(cells, fill = "") {
  const cellXml = cells
    .map((cell) => {
      const shade = fill
        ? `<w:shd w:color="auto" w:fill="${fill}" w:val="clear"/>`
        : "";
      return `<w:tc><w:tcPr><w:tcW w:w="2580" w:type="dxa"/>${shade}</w:tcPr>${paragraph(
        cell,
        { after: 0, size: "18" },
      )}</w:tc>`;
    })
    .join("");
  return `<w:tr>${cellXml}</w:tr>`;
}

function table(rows) {
  return `<w:tbl><w:tblPr><w:tblStyle w:val="Tablaconcuadrcula"/><w:tblW w:w="10320" w:type="dxa"/><w:tblLook w:val="04A0"/></w:tblPr><w:tblGrid><w:gridCol w:w="2580"/><w:gridCol w:w="2580"/><w:gridCol w:w="2580"/><w:gridCol w:w="2580"/></w:tblGrid>${rows.join(
    "",
  )}</w:tbl>`;
}

function imageParagraph(rId, docPrId, cx, cy) {
  return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="160"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${docPrId}" name="Evidencia ${docPrId}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="Evidencia ${docPrId}.png"/><pic:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></pic:cNvPicPr></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr bwMode="auto"><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

function nextRid(relsXml) {
  const ids = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]));
  return Math.max(0, ...ids) + 1;
}

function replaceCoreField(xml, label, value) {
  const escaped = xmlEscape(value);
  const pattern = new RegExp(
    `(<w:t[^>]*>${label}:\\s*</w:t></w:r></w:p></w:tc><w:tc[\\s\\S]*?<w:t[^>]*>)([\\s\\S]*?)(</w:t>)`,
  );
  return xml.replace(pattern, `$1${escaped}$3`);
}

function replaceCaseName(xml, value) {
  const escaped = xmlEscape(value);
  return xml.replace(
    /(<w:t[^>]*>Caso de Prueba:\s*<\/w:t><\/w:r><\/w:p><\/w:tc><w:tc[\s\S]*?<w:t[^>]*>)([\s\S]*?)(<\/w:t>)/,
    `$1${escaped}$3`,
  );
}

function replaceStatus(xml, value, passed) {
  const escaped = xmlEscape(value);
  const fill = passed ? "68FF00" : "FF5959";
  return xml
    .replace(
      /(<w:t[^>]*>Estado:\s*<\/w:t><\/w:r><\/w:p><\/w:tc><w:tc><w:tcPr>[\s\S]*?<w:shd[^>]*fill=")([^"]+)("[\s\S]*?<w:t[^>]*>)([\s\S]*?)(<\/w:t>)/,
      `$1${fill}$3${escaped}$5`,
    )
    .replace(
      /(<w:t[^>]*>Estado:\s*<\/w:t><\/w:r><\/w:p><\/w:tc><w:tc[\s\S]*?<w:t[^>]*>)(PASSED|FAILED|passed|failed)(<\/w:t>)/,
      `$1${escaped}$3`,
    );
}

function buildDocumentXml(templateDocumentXml, results, imageRefs) {
  const documentOpen = templateDocumentXml.match(/^<\?xml[\s\S]*?<w:document[^>]*>/)?.[0];
  const sectPr = templateDocumentXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0] || "";
  const started = results.map((r) => r.start).filter(Boolean);
  const finished = results.map((r) => r.stop).filter(Boolean);
  const passed = results.filter((r) => r.status === "passed").length;
  const failed = results.filter((r) => r.status !== "passed").length;
  const status = failed === 0 ? "PASSED" : "FAILED";
  const featureNames = [...new Set(results.map((r) => r.feature).filter(Boolean))];
  const title = featureNames.length ? featureNames.join(", ") : "Ejecucion automatizada";

  let body = "";
  body += table([
    tableRow(["QA Agile:", "Equipo de TW", "Fecha Ejecucion:", formatDate(started[0])], "D3D3D3"),
    tableRow(["Caso de Prueba:", title, "Estado:", status], failed === 0 ? "E5FFE5" : "FFE5E5"),
    tableRow([
      "Precondiciones:",
      "APK URPI Pro instalada, emulador Android disponible y usuarios de prueba cargados en CSV.",
      "Entorno de prueba:",
      process.env.REPORT_ENVIRONMENT || "Android emulator / Appium / WebdriverIO",
    ]),
    tableRow([
      "Resultado Esperado:",
      "Los escenarios ejecutados deben finalizar segun las validaciones definidas en Gherkin.",
      "Resultado obtenido:",
      `${passed} passed / ${failed} failed / ${results.length} escenarios`,
    ]),
  ]);

  body += paragraph("Test Plan: Ejecucion automatizada URPI Pro", {
    bold: true,
    size: "22",
  });
  body += paragraph(`Fecha inicio: ${formatDate(started[0])}`, { size: "18" });
  body += paragraph(`Fecha fin: ${formatDate(finished[finished.length - 1])}`, {
    size: "18",
  });
  body += paragraph(`Total escenarios: ${results.length}`, { size: "18" });

  body += paragraph("Escenarios probados", { bold: true, size: "22" });
  body += table([
    tableRow(["#", "Feature", "Escenario / Data", "Estado"], "D3D3D3"),
    ...results.map((result, index) =>
      tableRow([
        String(index + 1),
        result.feature || "-",
        result.userKey ? `${result.name} (${result.userKey})` : result.name,
        result.status.toUpperCase(),
      ]),
    ),
  ]);

  for (const [resultIndex, result] of results.entries()) {
    body += pageBreak();
    body += paragraph(
      `${resultIndex + 1}. ${result.userKey ? `${result.userKey} - ` : ""}${result.name}`,
      { bold: true, size: "22" },
    );
    body += paragraph(`Estado: ${result.status.toUpperCase()}`, {
      bold: true,
      size: "18",
      color: result.status === "passed" ? "008000" : "C00000",
    });
    body += paragraph(`Fecha: ${formatDate(result.start)}`, { size: "18" });

    for (const step of result.steps) {
      body += paragraph(`${step.keyword || ""}${step.name}`, {
        bold: true,
        size: "18",
      });
      const stepImages = imageRefs.filter(
        (ref) => ref.resultUuid === result.uuid && ref.stepName === step.name,
      );
      for (const image of stepImages) {
        body += imageParagraph(image.rId, image.docPrId, image.cx, image.cy);
      }
    }
  }

  return `${documentOpen}<w:body>${body}${sectPr}</w:body></w:document>`;
}

async function generate() {
  const templatePath = path.resolve(process.env.WORD_TEMPLATE || DEFAULT_TEMPLATE);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`No existe la plantilla Word: ${templatePath}`);
  }

  const results = loadResults();
  if (!results.length) {
    console.warn("[word-report] No hay resultados Allure para generar reporte.");
    return null;
  }

  cleanOutputDir();

  const zip = await JSZip.loadAsync(fs.readFileSync(templatePath));
  const apkVersion = readApkVersion();
  for (const name of ["word/header1.xml", "word/header2.xml", "word/header3.xml"]) {
    const file = zip.file(name);
    if (!file) continue;
    zip.file(name, updateHeaderTitle(await file.async("string"), apkVersion));
  }

  const documentXml = await zip.file("word/document.xml").async("string");
  let relsXml = await zip.file("word/_rels/document.xml.rels").async("string");
  let rid = nextRid(relsXml);
  let docPrId = 100;
  const imageRefs = [];

  for (const result of results) {
    for (const attachment of result.attachments) {
      const src = path.join(ALLURE_DIR, attachment.source);
      if (!fs.existsSync(src)) continue;

      const buffer = fs.readFileSync(src);
      const { width, height } = pngSize(buffer);
      const target = `media/evidence-${result.uuid}-${imageRefs.length + 1}.png`;
      const rId = `rId${rid++}`;
      const maxWidth = 1700000;
      const maxHeight = 4100000;
      let cx = maxWidth;
      let cy = Math.round((height / width) * cx);
      if (cy > maxHeight) {
        cy = maxHeight;
        cx = Math.round((width / height) * cy);
      }

      zip.file(`word/${target}`, buffer);
      imageRefs.push({
        resultUuid: result.uuid,
        stepName: attachment.stepName,
        rId,
        docPrId: docPrId++,
        cx,
        cy,
      });
      relsXml = relsXml.replace(
        "</Relationships>",
        `<Relationship Id="${rId}" Type="${IMAGE_REL}" Target="${target}"/></Relationships>`,
      );
    }
  }

  const finalDocumentXml = buildDocumentXml(documentXml, results, imageRefs);
  zip.file("word/document.xml", finalDocumentXml);
  zip.file("word/_rels/document.xml.rels", relsXml);

  const firstFeature = safeName(results[0].feature || "urpipro");
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "");
  const outputPath = path.join(
    OUTPUT_DIR,
    `CASO-XXXXX-Evidencias-${firstFeature}-${timestamp}.docx`,
  );

  const output = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  fs.writeFileSync(outputPath, output);
  console.log(`[word-report] Generado: ${outputPath}`);
  return outputPath;
}

generate().catch((error) => {
  console.error(`[word-report] Error: ${error?.stack || error}`);
  process.exitCode = 1;
});
