import {
  AI_API_KEY,
  EXTRA_API_HEADERS,
  RESPONSES_API_ENDPOINT,
  resolveModelForProvider
} from "../../../config.js";
import { extractResponseText } from "./helpers.js";

const MODEL = resolveModelForProvider("gpt-5.4");
const HUB_BASE_URL = "https://hub.ag3nts.org";
const TASK_NAME = "people";
const CURRENT_YEAR = 2026;

const HUB_API_KEY = process.env.AIDEVS_API_KEY?.trim() || "";
const AUTO_VERIFY = process.env.AIDEVS_AUTO_VERIFY === "1";

const ALLOWED_TAGS = [
  "IT",
  "transport",
  "edukacja",
  "medycyna",
  "praca z ludźmi",
  "praca z pojazdami",
  "praca fizyczna"
];

const tagsByMeaning = {
  IT: "praca zwiazana z oprogramowaniem, systemami, danymi lub infrastruktura IT",
  transport: "planowanie, organizacja lub realizacja przewozu ludzi albo towarow",
  edukacja: "nauczanie, szkolenia, przekazywanie wiedzy",
  medycyna: "diagnoza, leczenie, opieka zdrowotna, badania medyczne",
  "praca z ludźmi": "intensywna praca interpersonalna, wsparcie, obsluga, opieka",
  "praca z pojazdami": "prowadzenie, naprawa, serwis, obsluga pojazdow",
  "praca fizyczna": "przewaga czynnosci manualnych lub terenowych"
};

const peopleTagsSchema = {
  type: "json_schema",
  name: "people_tags",
  strict: true,
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              description: "Id rekordu z wejscia."
            },
            tags: {
              type: "array",
              description: "Dopasowane tagi z listy dozwolonych.",
              items: {
                type: "string",
                enum: ALLOWED_TAGS
              }
            }
          },
          required: ["id", "tags"],
          additionalProperties: false
        }
      }
    },
    required: ["items"],
    additionalProperties: false
  }
};

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const parseCsvLine = (line) => {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
};

const parsePeopleCsv = (csvText) => {
  const lines = csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));

    const born = Number.parseInt(record.birthDate?.slice(0, 4), 10);

    return {
      name: record.name?.trim() ?? "",
      surname: record.surname?.trim() ?? "",
      gender: record.gender?.trim() ?? "",
      born: Number.isNaN(born) ? null : born,
      city: record.birthPlace?.trim() ?? "",
      job: record.job?.trim() ?? ""
    };
  });
};

async function fetchPeopleCsvFromHub(apiKey) {
  const url = `${HUB_BASE_URL}/data/${encodeURIComponent(apiKey)}/people.csv`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Hub CSV download failed with status ${response.status}`);
  }

  return response.text();
}

function filterPeople(people) {
  return people.filter((person) => {
    if (person.gender !== "M") {
      return false;
    }

    if (typeof person.born !== "number") {
      return false;
    }

    const ageIn2026 = CURRENT_YEAR - person.born;
    if (ageIn2026 < 20 || ageIn2026 > 40) {
      return false;
    }

    if (normalize(person.city) !== "grudziadz") {
      return false;
    }

    return Boolean(person.job);
  });
}

async function classifyJobsWithLlm(candidates) {
  if (candidates.length === 0) {
    return [];
  }

  const prompt = [
    "Otaguj opisy stanowisk pracy na podstawie listy tagow.",
    "Mozesz przypisac wiele tagow do jednego rekordu.",
    "Zwracaj tylko tagi, ktore sa adekwatne do opisu.",
    "Nie pomijaj rekordow.",
    "",
    "Dostepne tagi i znaczenie:",
    ...Object.entries(tagsByMeaning).map(([tag, meaning]) => `- ${tag}: ${meaning}`),
    "",
    "Rekordy:",
    ...candidates.map((person, index) => `${index + 1}. id=${index + 1}; job=${person.job}`)
  ].join("\n");

  const response = await fetch(RESPONSES_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS
    },
    body: JSON.stringify({
      model: MODEL,
      input: prompt,
      text: { format: peopleTagsSchema }
    })
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    const message = data?.error?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  const outputText = extractResponseText(data);

  if (!outputText) {
    throw new Error("Missing text output in API response");
  }

  const parsed = JSON.parse(outputText);
  return Array.isArray(parsed.items) ? parsed.items : [];
}

function buildAnswer(candidates, classifiedItems) {
  const tagsById = new Map(classifiedItems.map((item) => [item.id, item.tags]));

  return candidates
    .map((person, index) => {
      const tags = Array.isArray(tagsById.get(index + 1)) ? tagsById.get(index + 1) : [];
      return {
        name: person.name,
        surname: person.surname,
        gender: person.gender,
        born: person.born,
        city: person.city,
        tags
      };
    })
    .filter((person) => person.tags.includes("transport"));
}

async function verifyOnHub(payload) {
  const response = await fetch(`${HUB_BASE_URL}/verify`, {
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
    throw new Error(`Hub verify failed with status ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function main() {
  if (!HUB_API_KEY) {
    throw new Error("Missing AIDEVS_API_KEY in .env");
  }

  const csvText = await fetchPeopleCsvFromHub(HUB_API_KEY);
  const allPeople = parsePeopleCsv(csvText);
  const filteredPeople = filterPeople(allPeople);
  const classifiedItems = await classifyJobsWithLlm(filteredPeople);
  const answer = buildAnswer(filteredPeople, classifiedItems);

  const payload = {
    apikey: HUB_API_KEY,
    task: TASK_NAME,
    answer
  };

  console.log(JSON.stringify(payload, null, 2));

  if (AUTO_VERIFY) {
    const verifyResult = await verifyOnHub(payload);
    console.log("Hub verify response:");
    console.log(typeof verifyResult === "string" ? verifyResult : JSON.stringify(verifyResult, null, 2));
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
