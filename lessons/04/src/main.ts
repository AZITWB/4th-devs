import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getConfig } from "./config.js";
import { renderDeclaration } from "./declaration.js";
import { fetchDocsBundle, getBinaryDoc } from "./docs.js";
import { buildDeclarationInput, validateDeclarationInput } from "./domain.js";
import { submitAnswer } from "./hub.js";
import { logger } from "./logger.js";
import { parseDocsBundle } from "./parser.js";
import type { AppConfig, RouteAnalysis, RuntimeOptions } from "./types.js";
import { analyzeDisabledRoutes } from "./vision.js";

const parseArgs = (): RuntimeOptions => {
  const args = process.argv.slice(2);
  const options: RuntimeOptions = { submit: false, refresh: false };

  for (const arg of args) {
    if (arg === "--submit") {
      options.submit = true;
      continue;
    }

    if (arg === "--refresh") {
      options.refresh = true;
      continue;
    }

    if (arg.startsWith("--route-code=")) {
      options.routeCodeOverride = arg.slice("--route-code=".length).trim();
    }
  }

  return options;
};

const resolveRouteAnalysis = async (
  routeCodeOverride: string,
  imageBuffer: Buffer,
  networkMap: string,
  config: AppConfig
): Promise<RouteAnalysis> => {
  if (routeCodeOverride) {
    return {
      routes: [],
      destinationRoute: {
        routeCode: routeCodeOverride,
        from: "Gdańsk",
        to: "Żarnowiec",
        status: "override"
      },
      confidence: "manual",
      source: "override",
      rawText: routeCodeOverride
    };
  }

  return analyzeDisabledRoutes(config, imageBuffer, networkMap);
};

const saveOutputFile = async (lessonRoot: string, fileName: string, content: string) => {
  const outputDir = path.join(lessonRoot, "output");
  await mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, fileName);
  await writeFile(filePath, content, "utf8");
  return filePath;
};

const main = async () => {
  const options = parseArgs();
  const config = getConfig(options);

  logger.section("Pobieranie dokumentacji");
  const docsBundle = await fetchDocsBundle(config, options.refresh);
  const parsedDocs = parseDocsBundle(docsBundle);

  logger.section("Analiza trasy");
  const routeAnalysis = await resolveRouteAnalysis(
    config.routeCodeOverride,
    getBinaryDoc(docsBundle, "trasy-wylaczone.png"),
    parsedDocs.networkMap,
    config
  );

  if (!routeAnalysis.destinationRoute?.routeCode) {
    throw new Error("Nie udało się ustalić kodu trasy do Żarnowca.");
  }

  logger.info(
    "Ustalony kod trasy",
    `${routeAnalysis.destinationRoute.routeCode} (${routeAnalysis.source})`
  );

  logger.section("Składanie deklaracji");
  const declarationInput = buildDeclarationInput(
    routeAnalysis.destinationRoute.routeCode,
    parsedDocs.extraWagonRule
  );

  validateDeclarationInput(declarationInput);

  const declaration = renderDeclaration(parsedDocs.declarationTemplate, declarationInput);
  const declarationPath = await saveOutputFile(config.lessonRoot, "declaration.txt", declaration);
  console.log(declaration);
  logger.info("Zapisano deklarację", declarationPath);

  if (!options.submit) {
    logger.info("Tryb lokalny", "Dodaj --submit, aby wysłać deklarację do verify.");
    return;
  }

  logger.section("Wysyłka do verify");
  const result = await submitAnswer(config, declaration);
  const verifyResponsePath = await saveOutputFile(
    config.lessonRoot,
    "verify-response.json",
    `${JSON.stringify(result, null, 2)}\n`
  );
  console.log(JSON.stringify(result, null, 2));
  logger.info("Zapisano odpowiedź verify", verifyResponsePath);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error("Zadanie nie powiodło się", message);
  process.exitCode = 1;
});