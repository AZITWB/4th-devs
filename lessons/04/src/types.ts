export type DocKind = "text" | "binary";

export interface CachedDoc {
  name: string;
  url: string;
  kind: DocKind;
  content: string | Buffer;
  discoveredFrom?: string;
  cachedAt?: string;
}

export interface DocsBundle {
  entry: CachedDoc;
  docs: Map<string, CachedDoc>;
}

export interface RouteCandidate {
  routeCode: string;
  from: string;
  to: string;
  status?: string;
  reason?: string;
  notes?: string;
}

export interface RouteAnalysis {
  routes: RouteCandidate[];
  destinationRoute: RouteCandidate | null;
  confidence?: string;
  source: "vision" | "override";
  rawText: string;
}

export interface DeclarationInput {
  date: string;
  senderId: string;
  sourceStation: string;
  destinationStation: string;
  weightKg: number;
  category: string;
  contents: string;
  fee: string;
  routeCode: string;
  wdp: number;
  specialNotes: string;
}

export interface HubVerifyResponse {
  code?: number;
  message?: string;
  hint?: string;
  answer?: string;
  [key: string]: unknown;
}

export interface RuntimeOptions {
  submit: boolean;
  refresh: boolean;
  routeCodeOverride?: string;
}

export interface ExtraWagonRule {
  standardCapacityKg: number;
  wagonCapacityKg: number;
  additionalWagonFeePp: number;
  categoryExemptions: string[];
}

export interface ParsedDocs {
  declarationTemplate: string;
  abbreviations: Map<string, string>;
  extraWagonRule: ExtraWagonRule;
  networkMap: string;
}

export interface AppConfig {
  projectRoot: string;
  lessonRoot: string;
  cacheDir: string;
  docsBaseUrl: string;
  verifyUrl: string;
  aiProvider: "openai" | "openrouter";
  aiApiKey: string;
  hubApiKey: string;
  modelName: string;
  visionModel: string;
  requestTimeoutMs: number;
  visionTimeoutMs: number;
  maxVisionAttempts: number;
  responsesApiEndpoint: string;
  extraApiHeaders: Record<string, string>;
  routeCodeOverride: string;
}
