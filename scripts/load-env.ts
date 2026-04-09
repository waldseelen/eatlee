import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const ENV_FILES = [".env", ".env.local"] as const;

function normalizeValue(value: string) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseEnvFile(content: string) {
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = normalizeValue(line.slice(separatorIndex + 1));

    if (!key || process.env[key]) {
      continue;
    }

    process.env[key] = value;
  }
}

export function loadLocalEnv() {
  for (const fileName of ENV_FILES) {
    const filePath = path.join(ROOT, fileName);

    if (!existsSync(filePath)) {
      continue;
    }

    parseEnvFile(readFileSync(filePath, "utf8"));
  }
}
