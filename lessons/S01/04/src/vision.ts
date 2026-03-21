import type { AppConfig, RouteAnalysis, RouteCandidate } from "./types.js";

const extractResponseText = (data: unknown) => {
  if (typeof data !== "object" || data === null) {
    return "";
  }

  const response = data as {
    output_text?: string;
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  };

  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  for (const item of response.output ?? []) {
    if (item.type !== "message") {
      continue;
    }

    for (const part of item.content ?? []) {
      if (part.type === "output_text" && typeof part.text === "string") {
        return part.text.trim();
      }
    }
  }

  return "";
};

const extractJsonObject = (text: string) => {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] ?? text;
  const objectMatch = candidate.match(/\{[\s\S]*\}/);

  if (!objectMatch) {
    throw new Error("Model vision nie zwrócił obiektu JSON.");
  }

  return JSON.parse(objectMatch[0]) as {
    routes?: RouteCandidate[];
    targetRoute?: RouteCandidate | null;
    confidence?: string;
  };
};

const callVision = async (
  config: AppConfig,
  imageBase64: string,
  prompt: string
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.visionTimeoutMs);

  try {
    const response = await fetch(config.responsesApiEndpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.aiApiKey}`,
        ...config.extraApiHeaders
      },
      body: JSON.stringify({
        model: config.visionModel,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              {
                type: "input_image",
                image_url: `data:image/png;base64,${imageBase64}`
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data?.error?.message || `Vision request failed (${response.status})`);
    }

    return extractResponseText(data);
  } finally {
    clearTimeout(timeout);
  }
};

const buildPrompt = (networkMap: string, focused = false) => `
Przeanalizuj obraz listy tras wyłączonych w systemie SPK.

Kontekst z dokumentacji tekstowej:
${networkMap}

Zwróć WYŁĄCZNIE JSON w formacie:
{
  "routes": [
    {
      "routeCode": "X-01",
      "from": "Miasto A",
      "to": "Miasto B",
      "status": "wyłączona",
      "notes": "krótki opis"
    }
  ],
  "targetRoute": {
    "routeCode": "X-01",
    "from": "Gdańsk",
    "to": "Żarnowiec",
    "status": "wyłączona",
    "notes": "krótkie uzasadnienie"
  },
  "confidence": "high"
}

Zasady:
- Odczytaj wszystkie kody tras widoczne na obrazie, jeśli są czytelne.
- Szczególnie znajdź trasę pomiędzy Gdańskiem i Żarnowcem.
- Nie zgaduj. Jeśli coś jest nieczytelne, zaznacz to w notes.
- Nazwy miast podawaj dokładnie po polsku.
${focused ? "- Skup się przede wszystkim na górnej części obrazu i relacji Gdańsk <-> Żarnowiec." : ""}
`.trim();

export const analyzeDisabledRoutes = async (
  config: AppConfig,
  imageBuffer: Buffer,
  networkMap: string
): Promise<RouteAnalysis> => {
  const imageBase64 = imageBuffer.toString("base64");
  let lastText = "";

  for (let attempt = 0; attempt < config.maxVisionAttempts; attempt += 1) {
    lastText = await callVision(config, imageBase64, buildPrompt(networkMap, attempt > 0));
    const parsed = extractJsonObject(lastText);
    const destinationRoute = parsed.targetRoute && parsed.targetRoute.routeCode
      ? parsed.targetRoute
      : (parsed.routes ?? []).find((route) => {
        const from = route.from.toLowerCase();
        const to = route.to.toLowerCase();
        return (
          (from.includes("gda") && to.includes("żarn")) ||
          (from.includes("żarn") && to.includes("gda"))
        );
      }) ?? null;

    if (destinationRoute?.routeCode) {
      return {
        routes: parsed.routes ?? [],
        destinationRoute,
        confidence: parsed.confidence,
        source: "vision",
        rawText: lastText
      };
    }
  }

  throw new Error(`Nie udało się ustalić kodu trasy do Żarnowca. Ostatnia odpowiedź vision: ${lastText}`);
};