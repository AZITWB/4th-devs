# Plan: Aktywacja trasy kolejowej X-01 — zadanie `railway`

Przyjęty kierunek: Node.js + TypeScript (spójność z lekcją 04), modularna architektura CLI z retry/backoff, respektowanie rate-limitów API, pełne logowanie — fundament do rozwijania w kolejnych lekcjach.

---

## Cel
Zbudować aplikację CLI w TypeScript, która:
- odkryje dokumentację API poprzez akcję `help`
- wykona sekwencję akcji wymaganą do aktywacji trasy X-01 (Gdańsk–Żarnowiec)
- obsłuży błędy 503 (retry z exponential backoff) i rate-limity (nagłówki HTTP)
- wydrukuje flagę `{FLG:...}` po zakończeniu

---

## Kontekst z lekcji

### S01E05 — zarządzanie limitami
- **Rate-limity API** — nagłówki odpowiedzi informują o czasie resetu; respektować bezwzględnie
- **Retry z backoffem** — 503 to celowa symulacja; automatyczny retry jest konieczny
- **Logowanie** — w zadaniach z limitami i losowymi błędami dobre logowanie to podstawa
- **Ograniczenie zapytań** — nie „przepalać" zapytań; każde wywołanie API jest cenne
- **Heartbeat** — informuj o postępie (logi kroków)

### S01E02 — łączenie z narzędziami
- Function Calling / Tool Use opiera się na pętli: zapytanie → decyzja → akcja → wynik → ponowne zapytanie
- Schemat narzędzia = nazwa + opis + parametry + callback
- W tym zadaniu agent API (hub) sam jest „narzędziem" — my sterujemy sekwencją akcji

### S01E03 — projektowanie API / MCP
- Planowanie narzędzi: unikać zbędnych akcji, grupować logicznie
- Odpowiedzi z API normalizować do spójnego formatu wewnętrznego
- Obsługiwać brakujące/niekompletne odpowiedzi

### S01E01 — programowanie interakcji
- API bezstanowe — każde żądanie musi zawierać pełen kontekst
- Logika deterministyczna tam, gdzie to możliwe — model tylko gdy naprawdę potrzebny

---

## Założenia projektowe

1. **AI steruje sekwencją akcji** — API jest samo-dokumentujące (akcja `help`). Model LLM otrzymuje odpowiedź z `help` i na jej podstawie samodzielnie decyduje jakie akcje wywołać, w jakiej kolejności i z jakimi parametrami. Dzięki temu kod nie wymaga hardkodowania sekwencji — agent adaptuje się do odpowiedzi API i komunikatów błędów.
2. **Function Calling** — model ma dostęp do jednego narzędzia `send_hub_action`, które wywołuje akcję na API hub. Agent w pętli wywołuje narzędzie, otrzymuje wynik, decyduje o kolejnym kroku.
3. **Retry z exponential backoff** — na 503 czekamy i ponawiamy (maks. ~10 prób na żądanie). Rate-limit i retry obsługiwane na warstwie transportu (`retry.ts`), transparentnie dla agenta.
4. **Pełne logowanie** — każde żądanie i odpowiedź (status, nagłówki, body) logowane do konsoli. Każdy krok agenta (tool call, wynik) widoczny w logach.
5. **Fundament reużywalny** — moduły `hub.ts`, `retry.ts`, `ai.ts`, `logger.ts`, `config.ts` projektowane do ponownego użycia w kolejnych lekcjach.

---

## Struktura projektu

```
lessons/05/
  package.json
  tsconfig.json
  src/
    main.ts          — agent loop: system prompt + help → AI decyduje o akcjach
    config.ts        — ładowanie .env, klucze API, endpointy, stałe
    hub.ts           — komunikacja z hub.ag3nts.org/verify (POST + retry + rate-limit)
    ai.ts            — wywołanie Responses API z Function Calling (reużywalny)
    retry.ts         — generyczny mechanizm retry z exp. backoff + rate-limit awareness
    logger.ts        — czytelne logi z timestampem (reuse wzorca z lekcji 04)
    types.ts         — typy: HubRequest, HubResponse, RateLimitInfo, RetryConfig, ToolCall
```

---

## Kroki realizacji

### Faza 1: Szkielet projektu TypeScript

1. **Utworzyć `package.json`** z zależnościami `tsx` i `typescript`, skryptami `dev`, `start`, `check`.
2. **Utworzyć `tsconfig.json`** — identyczny z lekcją 04 (ES2022, NodeNext, strict).
3. **Zainstalować zależności** (`npm install`).

### Faza 2: Moduły bazowe (fundament do rozwijania)

4. **`src/types.ts`** — zdefiniować typy Hub API + typy dla Function Calling (ToolCall, ToolResult).

5. **`src/logger.ts`** — logi z timestampem: request, response, headers, retry, agent steps.

6. **`src/config.ts`** — ładowanie konfiguracji:
   - `.env` z katalogu głównego projektu
   - `AIDEVS_API_KEY` — klucz Hub
   - `OPENAI_API_KEY` / `OPENROUTER_API_KEY` — klucz AI provider
   - Endpoint Responses API (OpenAI lub OpenRouter)
   - Retry config, timeouty

7. **`src/retry.ts`** — generyczny retry z exponential backoff + rate-limit awareness.

8. **`src/hub.ts`** — `sendAction()` z retry + rate-limit; `extractFlag()` szuka `{FLG:...}`.

9. **`src/ai.ts`** — wywołanie Responses API z Function Calling:
   - Funkcja `chat(input, tools, instructions)` → odpowiedź z modelu
   - Ekstrakcja tool calls i tekstu z odpowiedzi
   - Reużywalny moduł dla kolejnych lekcji

### Faza 3: Agent loop z Function Calling

10. **`src/main.ts`** — orchestracja agenta:
    1. Wyślij akcję `help` → otrzymaj dokumentację API
    2. Przekaż dokumentację jako kontekst do LLM razem z system promptem:
       - "Aktywuj trasę X-01. Masz narzędzie `send_hub_action`. Oto dokumentacja API: {help}"
    3. Agent loop: model wybiera narzędzie → `sendAction()` → wynik wraca do modelu → powtórz
    4. Po każdej odpowiedzi z hub sprawdź flagę `{FLG:...}`
    5. Gdy model zwróci tekst (nie tool call) lub znaleziono flagę → zakończ

11. **Tool definition** — jedno narzędzie `send_hub_action`:
    - `action` (string, required) — nazwa akcji API
    - `params` (object, optional) — dodatkowe parametry akcji
    - Model sam decyduje o sekwencji i parametrach na podstawie help + błędów API

### Faza 4: Obsługa błędów i rate-limitów

12. **Warstwa transportu** (retry.ts / hub.ts) obsługuje 503 i rate-limity transparentnie — agent nie musi o nich wiedzieć.
13. **Błędy biznesowe** (zły parametr, zła kolejność) wracają do modelu jako wynik tool call — model czyta komunikat i dostosowuje następny krok.
14. **Max steps** — agent loop ma limit kroków (np. 15) aby nie zapętlić się.

### Faza 5: Uruchomienie

15. `npx tsx src/main.ts` — agent autonomicznie: help → reconfigure → setstatus → save → flaga.
16. `npx tsx src/main.ts --discover` — tryb bez AI, tylko wypisz odpowiedź `help`.

---

## Elementy reużywalne (fundament na kolejne lekcje)

| Moduł | Rola | Reuse |
|-------|------|-------|
| `config.ts` | Ładowanie .env, klucze API (Hub + AI provider), endpointy | Każde zadanie |
| `ai.ts` | Responses API + Function Calling, ekstrakcja tool calls | Każde zadanie z AI |
| `hub.ts` | POST do /verify z retry + rate-limit | Każde zadanie z hub.ag3nts.org |
| `retry.ts` | Generyczny retry z backoff + rate-limit | Dowolne API z limitami |
| `logger.ts` | Logowanie z timestamp + sekcje + request/response | Wszystkie projekty |
| `types.ts` | Typy Hub API + Function Calling | Każde zadanie |

---

## Kluczowe wzorce z lekcji

- **Loguj wszystko** (S01E05) — każde wywołanie, odpowiedź, nagłówki, retry
- **Nie zgaduj** (S01E05 wskazówka) — API jest samo-dokumentujące, czytaj odpowiedzi
- **AI steruje sekwencją** (S01E02) — Function Calling w pętli; model adaptuje się do błędów
- **Oszczędność zapytań** (S01E05) — przy limitach liczy się każde żądanie; jeden tool = jedno wywołanie hub
- **Error recovery** (S01E05, S01E02) — 503 i rate-limit to normalne zdarzenia, nie awaria
- **Modularna architektura** (S01E05 sekcja produkcyjna) — oddzielenie warstw: transport, retry, logika

---

## Notatki implementacyjne

- Używamy `fetch` (natywny w Node 24+), nie potrzeba `node-fetch`
- `AbortController` z timeoutem na każde żądanie (30s)
- Rate-limit nagłówki mogą mieć różne nazwy — sprawdzić warianty
- Flaga `{FLG:...}` może pojawić się w dowolnym polu odpowiedzi — szukać w `JSON.stringify(response)`
- System prompt dla agenta zawiera dokumentację z `help` + cel (aktywacja X-01)
- Model powinien czytać błędy API i adaptować kolejne wywołania
- Wspólny interfejs AI (OpenAI / OpenRouter) przez root config.js pattern
- `--discover` zachowany jako fallback bez AI
