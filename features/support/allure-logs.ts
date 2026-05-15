import allure from "@wdio/allure-reporter";

function safeStringify(value: unknown) {
  try {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// Hook global: todo console.log/info/warn/error -> Allure attachment
const original = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

function attach(level: string, args: unknown[]) {
  const msg = args.map(safeStringify).join(" ");
  // Adjunta como TXT para que Allure lo muestre claro
  allure.addAttachment(`log:${level}`, msg, "text/plain");
}

console.log = (...args: unknown[]) => {
  attach("log", args);
  original.log(...args);
};

console.info = (...args: unknown[]) => {
  attach("info", args);
  original.info(...args);
};

console.warn = (...args: unknown[]) => {
  attach("warn", args);
  original.warn(...args);
};

console.error = (...args: unknown[]) => {
  attach("error", args);
  original.error(...args);
};
