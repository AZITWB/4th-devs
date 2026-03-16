import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { fetchRemoteDoc } from "./hub.js";
import type { AppConfig, CachedDoc, DocKind, DocsBundle } from "./types.js";

const REQUIRED_DOCS = [
  "index.md",
  "zalacznik-E.md",
  "zalacznik-F.md",
  "zalacznik-G.md",
  "dodatkowe-wagony.md",
  "trasy-wylaczone.png"
];

const INCLUDE_REGEX = /\[include file="([^"]+)"\]/g;

const resolveKind = (name: string): DocKind => name.endsWith(".png") ? "binary" : "text";

const readCachedDoc = async (cachePath: string, kind: DocKind) => {
  const content = await readFile(cachePath);
  return kind === "binary" ? content : content.toString("utf8");
};

const writeCachedDoc = async (cachePath: string, content: string | Buffer) => {
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, content);
};

const loadDoc = async (
  config: AppConfig,
  name: string,
  refresh: boolean,
  discoveredFrom?: string
): Promise<CachedDoc> => {
  const kind = resolveKind(name);
  const cachePath = path.join(config.cacheDir, name);
  const content = refresh
    ? await fetchRemoteDoc(config, name, kind)
    : await readCachedDoc(cachePath, kind).catch(async () => fetchRemoteDoc(config, name, kind));

  await writeCachedDoc(cachePath, content);

  return {
    name,
    url: new URL(name, config.docsBaseUrl).toString(),
    kind,
    content,
    discoveredFrom,
    cachedAt: new Date().toISOString()
  };
};

const extractIncludes = (content: string) => {
  const includes = new Set<string>();

  for (const match of content.matchAll(INCLUDE_REGEX)) {
    includes.add(match[1]);
  }

  return includes;
};

export const fetchDocsBundle = async (
  config: AppConfig,
  refresh = false
): Promise<DocsBundle> => {
  const docs = new Map<string, CachedDoc>();
  const entry = await loadDoc(config, "index.md", refresh);

  docs.set(entry.name, entry);

  const discoveredDocs = typeof entry.content === "string"
    ? extractIncludes(entry.content)
    : new Set<string>();

  for (const name of REQUIRED_DOCS) {
    discoveredDocs.add(name);
  }

  for (const name of discoveredDocs) {
    if (docs.has(name)) {
      continue;
    }

    const doc = await loadDoc(config, name, refresh, "index.md");
    docs.set(name, doc);
  }

  return { entry, docs };
};

export const getTextDoc = (bundle: DocsBundle, name: string): string => {
  const doc = bundle.docs.get(name);

  if (!doc || doc.kind !== "text") {
    throw new Error(`Brak tekstowego dokumentu: ${name}`);
  }

  if (typeof doc.content !== "string") {
    throw new Error(`Dokument ${name} nie zawiera tekstu.`);
  }

  return doc.content;
};

export const getBinaryDoc = (bundle: DocsBundle, name: string): Buffer => {
  const doc = bundle.docs.get(name);

  if (!doc || doc.kind !== "binary") {
    throw new Error(`Brak binarnego dokumentu: ${name}`);
  }

  if (!Buffer.isBuffer(doc.content)) {
    throw new Error(`Dokument ${name} nie zawiera danych binarnych.`);
  }

  return doc.content;
};