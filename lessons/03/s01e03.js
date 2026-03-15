import { readFile } from "node:fs/promises";
import {
  AI_API_KEY,
  EXTRA_API_HEADERS,
  RESPONSES_API_ENDPOINT,
  resolveModelForProvider
} from "../../config.js";
import { extractResponseText } from "./helpers.js";

const MODEL = resolveModelForProvider("gpt-5.4");
const HUB_BASE_URL = "https://hub.ag3nts.org";
const FINDHIM_TASK = "findhim";
const MAX_AGENT_STEPS = 20;

const HUB_API_KEY = process.env.AIDEVS_API_KEY?.trim() || "";
const AUTO_VERIFY = process.env.AIDEVS_AUTO_VERIFY !== "0";

const runtimeState = {
  suspects: null,
  plants: null,
  submission: null
};

const toNumber = (value) => {
  const num = typeof value === "number" ? value : Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(num) ? num : null;
};

const extractPoint = (candidate) => {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const lat = toNumber(candidate.lat ?? candidate.latitude ?? candidate.y);
  const lon = toNumber(candidate.lon ?? candidate.lng ?? candidate.longitude ?? candidate.x);

  if (lat === null || lon === null) {
    return null;
  }

  return { lat, lon };
};

const degToRad = (deg) => (deg * Math.PI) / 180;

const haversineKm = (a, b) => {
  const earthRadiusKm = 6371;
  const dLat = degToRad(b.lat - a.lat);
  const dLon = degToRad(b.lon - a.lon);
  const lat1 = degToRad(a.lat);
  const lat2 = degToRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
};

async function fetchText(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`GET ${url} failed with status ${response.status}`);
  }

  return response.text();
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new Error(`POST ${url} failed with status ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

function parseSuspects(resultPayload) {
  if (!Array.isArray(resultPayload?.answer)) {
    throw new Error("Invalid result.json format: missing array in field 'answer'");
  }

  return resultPayload.answer
    .map((person) => ({
      name: String(person?.name ?? "").trim(),
      surname: String(person?.surname ?? "").trim(),
      born: Number.parseInt(person?.born, 10)
    }))
    .filter((person) => person.name && person.surname && Number.isFinite(person.born));
}

function parsePowerPlants(payload) {
  const fromObject = payload?.power_plants && typeof payload.power_plants === "object"
    ? Object.entries(payload.power_plants).map(([city, item]) => ({
        city,
        code: String(item?.code ?? "").trim(),
        isActive: item?.is_active !== false
      }))
    : [];

  const fromArray = Array.isArray(payload)
    ? payload.map((item) => ({
        city: String(item?.city ?? item?.name ?? "").trim(),
        code: String(item?.code ?? item?.powerPlant ?? item?.plantCode ?? item?.id ?? "").trim(),
        isActive: item?.is_active !== false
      }))
    : [];

  const plants = [...fromObject, ...fromArray].filter((item) => item.city && item.code);

  if (plants.length === 0) {
    throw new Error("No valid power plant coordinates found in findhim_locations.json");
  }

  return plants;
}

const geocodeCache = new Map();

async function geocodeCity(city) {
  if (geocodeCache.has(city)) {
    return geocodeCache.get(city);
  }

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&country=Poland&city=${encodeURIComponent(city)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "4th-devs-findhim-agent/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Geocoding failed for city '${city}' with status ${response.status}`);
  }

  const data = await response.json();
  const first = Array.isArray(data) ? data[0] : null;
  const lat = toNumber(first?.lat);
  const lon = toNumber(first?.lon);

  if (lat === null || lon === null) {
    throw new Error(`No geocoding coordinates found for city '${city}'`);
  }

  const point = { lat, lon };
  geocodeCache.set(city, point);
  return point;
}

function parseSightings(payload) {
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.locations)
      ? payload.locations
      : Array.isArray(payload?.points)
        ? payload.points
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.result)
            ? payload.result
            : [];

  return candidates
    .map((item) => extractPoint(item))
    .filter(Boolean);
}

function parseAccessLevel(payload) {
  if (typeof payload === "number") {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const candidate = payload.accessLevel ?? payload.access_level ?? payload.level ?? payload.access;
    const level = Number.parseInt(candidate, 10);
    if (Number.isFinite(level)) {
      return level;
    }
  }

  throw new Error(`Could not parse accessLevel from payload: ${JSON.stringify(payload)}`);
}

async function ensureSuspects() {
  if (runtimeState.suspects) {
    return runtimeState.suspects;
  }

  const raw = await readFile(new URL("../01/result.json", import.meta.url), "utf8");
  const parsed = JSON.parse(raw);
  const suspects = parseSuspects(parsed);

  if (suspects.length === 0) {
    throw new Error("No suspects found in lessons/01/result.json");
  }

  runtimeState.suspects = suspects;
  return suspects;
}

async function ensurePlants() {
  if (runtimeState.plants) {
    return runtimeState.plants;
  }

  const plantsRaw = await fetchText(`${HUB_BASE_URL}/data/${encodeURIComponent(HUB_API_KEY)}/findhim_locations.json`);
  const parsed = JSON.parse(plantsRaw);
  const plants = parsePowerPlants(parsed);

  const enriched = [];
  for (const plant of plants) {
    const point = await geocodeCity(plant.city);
    enriched.push({ ...plant, ...point });
  }

  runtimeState.plants = enriched;
  return enriched;
}

const tools = [
  {
    type: "function",
    name: "list_suspects",
    description: "Return suspects from previous task result file. Use this first.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "get_person_locations",
    description: "Get observed coordinates for one suspect from hub /api/location.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        surname: { type: "string" }
      },
      required: ["name", "surname"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "find_nearest_power_plant",
    description: "Given suspect locations, compute nearest power plant and distance in km.",
    parameters: {
      type: "object",
      properties: {
        locations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              lat: { type: "number" },
              lon: { type: "number" }
            },
            required: ["lat", "lon"],
            additionalProperties: false
          }
        }
      },
      required: ["locations"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "get_access_level",
    description: "Get access level for a suspect from hub /api/accesslevel.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        surname: { type: "string" },
        birthYear: { type: "integer" }
      },
      required: ["name", "surname", "birthYear"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "submit_findhim_answer",
    description: "Submit final findhim answer to /verify. Call this once with best candidate.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        surname: { type: "string" },
        accessLevel: { type: "integer" },
        powerPlant: { type: "string" }
      },
      required: ["name", "surname", "accessLevel", "powerPlant"],
      additionalProperties: false
    },
    strict: true
  }
];

const handlers = {
  async list_suspects() {
    return { suspects: await ensureSuspects() };
  },

  async get_person_locations({ name, surname }) {
    const payload = await postJson(`${HUB_BASE_URL}/api/location`, {
      apikey: HUB_API_KEY,
      name,
      surname
    });

    return { locations: parseSightings(payload) };
  },

  async find_nearest_power_plant({ locations }) {
    const plants = await ensurePlants();
    const points = Array.isArray(locations)
      ? locations.map((item) => extractPoint(item)).filter(Boolean)
      : [];

    let nearest = null;

    for (const point of points) {
      for (const plant of plants) {
        const distanceKm = haversineKm(point, plant);
        if (!nearest || distanceKm < nearest.distanceKm) {
          nearest = {
            powerPlant: plant.code,
            city: plant.city,
            distanceKm
          };
        }
      }
    }

    if (!nearest) {
      return { powerPlant: null, city: null, distanceKm: null };
    }

    return nearest;
  },

  async get_access_level({ name, surname, birthYear }) {
    const payload = await postJson(`${HUB_BASE_URL}/api/accesslevel`, {
      apikey: HUB_API_KEY,
      name,
      surname,
      birthYear
    });

    return { accessLevel: parseAccessLevel(payload) };
  },

  async submit_findhim_answer({ name, surname, accessLevel, powerPlant }) {
    const verifyPayload = {
      apikey: HUB_API_KEY,
      task: FINDHIM_TASK,
      answer: {
        name,
        surname,
        accessLevel,
        powerPlant
      }
    };

    if (!AUTO_VERIFY) {
      runtimeState.submission = { skipped: true, payload: verifyPayload };
      return runtimeState.submission;
    }

    const verifyResult = await postJson(`${HUB_BASE_URL}/verify`, verifyPayload);
    runtimeState.submission = { skipped: false, payload: verifyPayload, verifyResult };
    return runtimeState.submission;
  }
};

function getToolCalls(response) {
  return Array.isArray(response?.output)
    ? response.output.filter((item) => item?.type === "function_call")
    : [];
}

async function callModel({ input, previousResponseId }) {
  const response = await fetch(RESPONSES_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS
    },
    body: JSON.stringify({
      model: MODEL,
      input,
      tools,
      ...(previousResponseId ? { previous_response_id: previousResponseId } : {})
    })
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    const message = data?.error?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function runAgent() {
  const initialInput = [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: [
            "You are solving task 'findhim'.",
            "Use tools only.",
            "Find the suspect from list_suspects whose observed locations are closest to any power plant.",
            "Then get access level for that suspect.",
            "Then call submit_findhim_answer exactly once with final fields.", 
            "After submit, return short confirmation with chosen name, surname, accessLevel, and powerPlant."
          ].join("\n")
        }
      ]
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: "Solve the findhim task now."
        }
      ]
    }
  ];

  let response = await callModel({ input: initialInput });

  for (let step = 0; step < MAX_AGENT_STEPS; step += 1) {
    const toolCalls = getToolCalls(response);

    if (toolCalls.length === 0) {
      return response;
    }

    const toolOutputs = [];

    for (const call of toolCalls) {
      const handler = handlers[call.name];
      if (!handler) {
        throw new Error(`Unknown tool call: ${call.name}`);
      }

      const args = call.arguments ? JSON.parse(call.arguments) : {};
      const result = await handler(args);

      toolOutputs.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(result)
      });
    }

    response = await callModel({
      input: toolOutputs,
      previousResponseId: response.id
    });
  }

  throw new Error(`Agent did not finish within ${MAX_AGENT_STEPS} steps.`);
}

async function main() {
  if (!HUB_API_KEY) {
    throw new Error("Missing AIDEVS_API_KEY in .env");
  }

  const finalResponse = await runAgent();
  const finalText = extractResponseText(finalResponse);

  if (runtimeState.submission?.payload) {
    console.log(JSON.stringify(runtimeState.submission.payload, null, 2));
  }

  if (runtimeState.submission?.verifyResult) {
    console.log("Hub verify response:");
    console.log(JSON.stringify(runtimeState.submission.verifyResult, null, 2));
  }

  if (finalText) {
    console.log("Agent summary:");
    console.log(finalText);
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
