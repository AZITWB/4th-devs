## Plan: Deklaracja transportu SPK dla zadania sendit

Przyjęty kierunek: Node.js + TypeScript, OpenAI Responses API lub OpenRouter Responses API, analiza dokumentacji zdalnej, vision do odczytu pliku graficznego, automatyczne wysłanie odpowiedzi do Hub-a.

## Cel
Zbudować małą aplikację CLI w TypeScript, która:
- pobierze pełną dokumentację SPK z `https://hub.ag3nts.org/dane/doc/`
- odczyta wzór deklaracji oraz dane pomocnicze z plików tekstowych
- przeanalizuje obraz `trasy-wylaczone.png` z użyciem modelu vision
- złoży poprawną deklarację przewozową dla przesyłki z Gdańska do Żarnowca
- wyśle wynik do `https://hub.ag3nts.org/verify` w formacie wymaganym przez zadanie `sendit`

## Założenia domenowe
- Przesyłka powinna zostać zaklasyfikowana jako **A - Strategiczna**, ponieważ dokumentacja kategorii A obejmuje elementy krytyczne dla infrastruktury i ogniwa paliwowe, a w zadaniu mamy `kasety z paliwem do reaktora`.
- Przesyłki kategorii A są **zwolnione z opłat** i finansowane przez System, więc można uzyskać wymagane `0 PP`.
- Trasy do Żarnowca są wyłączone z użytku, ale dokumentacja dopuszcza ich użycie dla przesyłek kategorii **A oraz B**.
- Nie należy dodawać żadnych uwag specjalnych.
- Format deklaracji musi odpowiadać dokładnie wzorowi z dokumentacji, więc aplikacja nie może generować "własnej wersji" formularza.

## Struktura projektu
src/
  main.ts                — orchestracja całego procesu, uruchomienie workflow CLI
  config.ts              — env, endpointy, modele, timeouty, stałe URL
  hub.ts                 — pobieranie dokumentów i wysyłka odpowiedzi do /verify
  docs.ts                — lista wymaganych plików, fetch tekstu/binarek, cache lokalny
  vision.ts              — wrapper na Responses API dla analizy obrazu base64
  parser.ts              — ekstrakcja szablonu deklaracji i danych z plików .md
  declaration.ts         — składanie finalnego tekstu deklaracji zgodnie ze wzorem
  domain.ts              — reguły biznesowe SPK: kategoria, opłata, walidacje pól
  logger.ts              — czytelne logi kroków i błędów
  types.ts               — typy wejścia, odpowiedzi z Hub-a, model dokumentów

## Kroki

### Faza 1: Szkielet aplikacji TypeScript
1. Utworzyć aplikację CLI w TypeScript z `package.json`, `tsconfig.json` i skryptami `dev`, `start`, `check`.
2. Przyjąć uruchamianie przez `npx tsx src/main.ts`, zgodnie z praktyką z poprzednich zadań i zależnością `tsx` widoczną w przykładach.
3. Dodać `config.ts`, który:
	- czyta `.env` z katalogu głównego projektu
	- pobiera `AIDEVS_API_KEY`
	- pobiera `OPENAI_API_KEY` lub `OPENROUTER_API_KEY`
	- wybiera endpoint Responses API zgodnie z rootowym `config.js`
4. Ustalić minimalny kontrakt aplikacji: brak interakcji REPL, pojedyncze uruchomienie wykonuje cały pipeline end-to-end.

### Faza 2: Pobranie dokumentacji zdalnej
5. Zaimplementować moduł `hub.ts` / `docs.ts`, który pobiera pliki z `https://hub.ag3nts.org/dane/doc/`.
6. Obowiązkowo pobrać:
	- `index.md`
	- `zalacznik-E.md` — wzór deklaracji
	- `trasy-wylaczone.png` — lista tras wyłączonych w formie obrazu
	- `dodatkowe-wagony.md` — dodatkowe informacje o opłatach
7. Warunkowo pobrać także:
	- `zalacznik-A.md` — pełna lista tras lokalnych
	- `zalacznik-F.md` — mapa sieci
	- `zalacznik-G.md` — słownik skrótów
8. Dodać obsługę tekstu i binarek:
	- `.md` jako UTF-8 text
	- `.png` jako `ArrayBuffer` lub `Buffer`
9. Dodać prosty cache lokalny w katalogu roboczym, aby kolejne uruchomienia nie pobierały wszystkiego od nowa.

### Faza 3: Analiza dokumentów i reguł biznesowych
10. W `parser.ts` wyciągnąć z dokumentacji najważniejsze reguły potrzebne do deklaracji:
	- klasyfikację przesyłek
	- zasady opłat
	- regułę dotyczącą Żarnowca
	- wzór deklaracji z `zalacznik-E.md`
11. W `domain.ts` zapisać jawne decyzje biznesowe, zamiast liczyć na domyślanie się przez model:
	- `category = "A"`
	- `fee = "0 PP"`
	- `specialNotes = ""`
	- `weightKg = 2800`
12. Utrzymać logikę deterministyczną tam, gdzie to możliwe, a model wykorzystać tylko tam, gdzie naprawdę jest potrzebny, czyli przy analizie obrazu i ewentualnie trudniejszej ekstrakcji szablonu.

### Faza 4: Vision dla pliku graficznego
13. Zaimplementować `vision.ts` na wzór podejścia z przykładów multimodalnych:
	- obraz przekazywany jako base64
	- pytanie tekstowe + `input_image` do Responses API
14. Zadać modelowi precyzyjne pytanie o zawartość `trasy-wylaczone.png`, np. o pełną listę tras i szczególnie trasę prowadzącą z Gdańska do Żarnowca.
15. Wymusić odpowiedź w formie możliwie uporządkowanej, np. JSON lub tabelarycznej listy pól:
	- `routeCode`
	- `from`
	- `to`
	- `status`
	- `notes`
16. Dodać walidację wyniku vision:
	- jeśli model nie znajdzie trasy do Żarnowca, spróbować drugiego promptu
	- jeśli wynik nadal jest niejednoznaczny, wesprzeć się `zalacznik-A.md` lub `zalacznik-F.md`

### Faza 5: Złożenie deklaracji
17. W `declaration.ts` przygotować funkcję budującą finalny tekst deklaracji dokładnie wg wzoru z `zalacznik-E.md`.
18. Nie tworzyć deklaracji przez swobodne promptowanie modelu, tylko przez podstawienie wartości do szablonu z zachowaniem:
	- kolejności pól
	- separatorów
	- pustych linii
	- etykiet i nagłówków
19. Wypełnić co najmniej następujące dane wejściowe:
	- nadawca: `450202122`
	- punkt nadawczy: `Gdańsk`
	- punkt docelowy: `Żarnowiec`
	- waga: `2800 kg`
	- kategoria: `A`
	- zawartość: `kasety z paliwem do reaktora`
	- opłata: `0 PP`
	- uwagi specjalne: brak / pole puste zgodnie ze wzorem
	- kod trasy: wartość ustalona na podstawie `trasy-wylaczone.png`
20. Jeśli wzór zawiera dodatkowe pola, ich wartość ustalić na podstawie dokumentacji, a nie zgadywać.

### Faza 6: Weryfikacja i wysyłka do Hub-a
21. Zaimplementować `submitAnswer()` w `hub.ts`, które wykona POST na `https://hub.ag3nts.org/verify` z payloadem:
	- `apikey`
	- `task: "sendit"`
	- `answer.declaration`
22. Przed wysyłką wypisać finalną deklarację do logów lub do stdout, aby umożliwić szybkie porównanie z wzorem.
23. Po otrzymaniu odpowiedzi:
	- jeśli sukces, wypisać flagę
	- jeśli błąd, wypisać pełny komunikat z Hub-a i zachować go do kolejnej iteracji
24. Dodać możliwość łatwego ponowienia próby po poprawkach bez ręcznej zmiany kodu.

## Pliki do utworzenia
- `lessons/04/package.json`
- `lessons/04/tsconfig.json`
- `lessons/04/src/main.ts`
- `lessons/04/src/config.ts`
- `lessons/04/src/hub.ts`
- `lessons/04/src/docs.ts`
- `lessons/04/src/vision.ts`
- `lessons/04/src/parser.ts`
- `lessons/04/src/declaration.ts`
- `lessons/04/src/domain.ts`
- `lessons/04/src/logger.ts`
- `lessons/04/src/types.ts`

## Referencje z przykładów i poprzednich lekcji
- `lessons/03/zadanie-plan.md` — wzorzec formy planu i podziału na fazy.
- `01_04_image_recognition/src/native/vision.js` — prosty wrapper vision przez Responses API.
- `01_04_image_guidance/src/native/analyze-image/handler.js` — przykład opakowania analizy obrazu w deterministyczny handler.
- `01_04_image_editing/src/api.js` — wzorzec klienta Responses API i ekstrakcji tool calls / textu.
- `lessons/01/s01e01-programowanie-interakcji-z-modelem-jezykowym.md` — fundament integracji LLM z kodem i obsługi API.
- `lessons/02/s01e02-techniki-laczenia-modelu-z-narzedziami.md` — zasada, że model powinien być użyty tam, gdzie kod nie wystarcza, a logika aplikacji pozostaje po stronie programu.
- `lessons/03/s01e03.md` — projektowanie odpowiedzi i struktur przyjaznych modelowi, walidacje, recovery paths.
- `lessons/04/s01e04.md` — multimodalność, przekazywanie załączników, analiza obrazów oraz użycie vision w logice agenta.

## Decyzje architektoniczne
- **TypeScript zamiast JavaScript**: plan zakłada pełną implementację w `.ts`, mimo że przykłady są głównie w `.js`, bo zadanie wymaga bardziej rygorystycznego modelowania danych i łatwiejszej walidacji odpowiedzi.
- **CLI zamiast pełnego agenta z REPL**: to zadanie jest jednorazowym workflow, więc prostsza aplikacja wsadowa będzie bardziej przewidywalna niż interaktywny agent.
- **Deterministyczne składanie deklaracji**: model nie powinien generować finalnego formularza "od zera". Ma pomóc tylko tam, gdzie dane są w obrazie albo trudne do ekstrakcji.
- **Brak MCP w MVP**: do rozwiązania zadania wystarczy fetch + Responses API, bez dokładania warstwy MCP.
- **Jawna walidacja przed wysyłką**: aplikacja ma sprawdzić komplet pól i brak niedozwolonych uwag przed wykonaniem POST do Hub-a.

## Weryfikacja
1. Uruchomienie aplikacji bez kluczy API powinno zwrócić czytelny błąd konfiguracji.
2. Pobranie dokumentacji powinno zakończyć się lokalnym zestawem plików i poprawnym odczytem tekstu / binarek.
3. Analiza `trasy-wylaczone.png` powinna zwrócić jednoznaczny kod trasy do Żarnowca lub uruchomić fallback.
4. Parser powinien poprawnie odczytać wzór z `zalacznik-E.md` bez utraty formatowania.
5. Finalna deklaracja powinna przejść lokalną walidację pól obowiązkowych.
6. Wysłanie do `verify` powinno zwrócić flagę albo komunikat błędu pozwalający na kolejną iterację.

## Ryzyka
- Wzór deklaracji może zawierać pola, których nie widać w samym `index.md` i które trzeba będzie uzupełnić na podstawie dodatkowych załączników.
- OCR/vision może źle odczytać nazwę lub kod trasy z obrazu, dlatego trzeba przygotować fallback i walidację wyniku.
- Hub może wymagać nie tylko poprawnych wartości, ale także dokładnego układu spacji i separatorów, więc nie wolno normalizować formatowania zbyt agresywnie.

## Definicja ukończenia
- Istnieje działająca aplikacja TypeScript w `lessons/04/`
- aplikacja pobiera dokumentację, analizuje obraz, buduje deklarację i wysyła ją do Hub-a
- odpowiedź z `verify` zawiera poprawną flagę dla zadania `sendit`
