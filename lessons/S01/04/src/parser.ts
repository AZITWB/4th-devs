import { getTextDoc } from "./docs.js";
import type { DocsBundle, ExtraWagonRule, ParsedDocs } from "./types.js";

const extractCodeFence = (markdown: string) => {
  const match = markdown.match(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/);

  if (!match) {
    throw new Error("Nie znaleziono bloku kodu z wzorem deklaracji.");
  }

  return match[1].trimEnd();
};

const parseAbbreviations = (markdown: string) => {
  const abbreviations = new Map<string, string>();

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line.startsWith("|") || line.includes("---") || line.includes("Skrót")) {
      continue;
    }

    const parts = line.split("|").map((part) => part.trim()).filter(Boolean);

    if (parts.length >= 2) {
      abbreviations.set(parts[0], parts[1]);
    }
  }

  return abbreviations;
};

const parseExtraWagonRule = (markdown: string): ExtraWagonRule => {
  const standardCapacityMatch = markdown.match(/maksymalny udźwig (\d+) kg/i);
  const wagonCapacityMatch = markdown.match(/każdy o udźwigu (\d+) kg/i);
  const feeMatch = markdown.match(/w cenie (\d+) PP/i);

  if (!standardCapacityMatch || !wagonCapacityMatch || !feeMatch) {
    throw new Error("Nie udało się sparsować zasad dodatkowych wagonów.");
  }

  return {
    standardCapacityKg: Number.parseInt(standardCapacityMatch[1], 10),
    wagonCapacityKg: Number.parseInt(wagonCapacityMatch[1], 10),
    additionalWagonFeePp: Number.parseInt(feeMatch[1], 10),
    categoryExemptions: ["A", "B"]
  };
};

export const parseDocsBundle = (bundle: DocsBundle): ParsedDocs => {
  const declarationTemplate = extractCodeFence(getTextDoc(bundle, "zalacznik-E.md"));
  const abbreviations = parseAbbreviations(getTextDoc(bundle, "zalacznik-G.md"));
  const extraWagonRule = parseExtraWagonRule(getTextDoc(bundle, "dodatkowe-wagony.md"));
  const networkMap = getTextDoc(bundle, "zalacznik-F.md");

  return {
    declarationTemplate,
    abbreviations,
    extraWagonRule,
    networkMap
  };
};