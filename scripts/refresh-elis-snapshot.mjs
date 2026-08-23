import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { nonCapitalRegions } from "../lib/regions.ts";
import {
  buildElisOrdinanceDetailUrl,
  getElisJurisdictionTargets,
  isOrdinanceReviewTitleCandidate,
  listSupportedMunicipalities,
  localOrdinanceReviewCategories,
} from "../lib/regions/local-ordinances.ts";

const OUTPUT_PATH = fileURLToPath(
  new URL("../lib/regions/elis-reviewed-snapshot.generated.json", import.meta.url),
);
const CONCURRENCY = 6;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;

function decodeHtml(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    middot: "·",
    nbsp: " ",
    quot: '"',
  };
  return value
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function plainText(value) {
  return decodeHtml(value.replace(/<[^>]*>/g, " "))
    .replace(/[\t\r\n ]+/g, " ")
    .trim();
}

function normalized(value) {
  return value
    .normalize("NFKC")
    .replace(/[\s·ㆍ・,.'’‘"“”()（）\-_/]/g, "")
    .toLowerCase();
}

const relevantTitlePatterns = [
  ...new Set(
    localOrdinanceReviewCategories.flatMap((category) =>
      category.ordinanceNamePatterns.map(normalized),
    ),
  ),
];

function isRelevantTitle(title) {
  const candidate = normalized(title);
  if (!isOrdinanceReviewTitleCandidate(title)) return false;
  return relevantTitlePatterns.some((pattern) => candidate.includes(pattern));
}

function displayDate(row) {
  const separated = row.match(/\b(20\d{2})[./-](\d{2})[./-](\d{2})\b/);
  if (separated) return `${separated[1]}-${separated[2]}-${separated[3]}`;
  const compact = row.match(/\b(20\d{2})(\d{2})(\d{2})\b/);
  return compact ? `${compact[1]}-${compact[2]}-${compact[3]}` : null;
}

function popupIdentifiers(fragment) {
  const call = fragment.match(/lawPopup\s*\(([^)]*)\)/i)?.[1];
  if (!call) return null;
  const values = [...call.matchAll(/['"]([^'"]*)['"]/g)].map((match) => match[1]);
  for (let index = values.length - 2; index >= 0; index -= 1) {
    if (/^\d{14}$/.test(values[index]) && /^\d{3}$/.test(values[index + 1] ?? "")) {
      return { alrNo: values[index], histNo: values[index + 1] };
    }
  }
  return null;
}

function parseRelevantRecords(html, context) {
  const records = [];
  for (const rowMatch of html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)) {
    const row = rowMatch[0];
    const anchors = row.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? [];
    for (const anchor of anchors) {
      const ids = popupIdentifiers(anchor);
      const name = plainText(anchor);
      if (!ids || !name || !isRelevantTitle(name)) continue;
      records.push({
        provinceName: context.provinceName,
        jurisdictionName: context.target.name,
        level: context.target.level,
        name,
        amendmentDate: displayDate(plainText(row)),
        url: buildElisOrdinanceDetailUrl(name, ids.alrNo, ids.histNo),
      });
      break;
    }
  }
  return records;
}

function buildTargets() {
  const byUrl = new Map();
  for (const provinceName of nonCapitalRegions) {
    for (const target of getElisJurisdictionTargets(provinceName)) {
      byUrl.set(target.listUrl, { provinceName, target });
    }
    for (const municipalityName of listSupportedMunicipalities(provinceName)) {
      for (const target of getElisJurisdictionTargets(provinceName, municipalityName)) {
        if (target.level !== "MUNICIPALITY") continue;
        byUrl.set(target.listUrl, { provinceName, target });
      }
    }
  }
  return [...byUrl.values()];
}

async function fetchTextWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "text/html;charset=UTF-8",
          "User-Agent": "factory-permit-dashboard/1.0 (official ELIS snapshot refresh)",
        },
        redirect: "follow",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

async function mapWithConcurrency(items, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => run()));
  return results;
}

const targets = buildTargets();
const failures = [];
const batches = await mapWithConcurrency(targets, async (context, index) => {
  try {
    const html = await fetchTextWithRetry(context.target.listUrl);
    const records = parseRelevantRecords(html, context);
    process.stdout.write(`\rELIS ${index + 1}/${targets.length} · ${context.target.name} · ${records.length}건   `);
    return records;
  } catch (error) {
    failures.push({
      provinceName: context.provinceName,
      jurisdictionName: context.target.name,
      level: context.target.level,
      message: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
});

const currentRecordByTitle = new Map();
for (const record of batches.flat()) {
  const key = [
    record.provinceName,
    record.level,
    record.jurisdictionName,
    normalized(record.name),
  ].join("|");
  const existing = currentRecordByTitle.get(key);
  if (
    !existing ||
    (record.amendmentDate ?? "") > (existing.amendmentDate ?? "")
  ) {
    currentRecordByTitle.set(key, record);
  }
}

const records = [...currentRecordByTitle.values()].sort((left, right) =>
    [left.provinceName, left.level, left.jurisdictionName, left.name].join("|").localeCompare(
      [right.provinceName, right.level, right.jurisdictionName, right.name].join("|"),
      "ko",
    ),
  );

const payload = {
  checkedAt: new Date().toISOString(),
  source: "행정안전부 자치법규정보시스템(ELIS) 관할별 현행 자치법규 목록",
  jurisdictionCount: targets.length,
  coveredJurisdictionCount: new Set(
    records.map((record) => `${record.provinceName}|${record.level}|${record.jurisdictionName}`),
  ).size,
  records,
};

await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
process.stdout.write("\n");
console.log(
  `Saved ${records.length} exact ELIS links for ${payload.coveredJurisdictionCount}/${targets.length} jurisdictions.`,
);
if (failures.length) {
  console.error(JSON.stringify({ failures }, null, 2));
  process.exitCode = 1;
}
