# Lesson 04: sendit

CLI do rozwiązania zadania `sendit` dla SPK.

## Co robi

- pobiera dokumentację z `https://hub.ag3nts.org/dane/doc/`
- zapisuje ją lokalnie w `.cache/docs/`
- analizuje obraz `trasy-wylaczone.png` przez Responses API, aby ustalić kod trasy
- buduje deklarację dokładnie według wzoru z `zalacznik-E.md`
- opcjonalnie wysyła wynik do `https://hub.ag3nts.org/verify`
- zapisuje wynikowe pliki do `output/`

## Wymagania

- Node.js 24+
- plik główny `.env` w katalogu repozytorium
- ustawione `OPENAI_API_KEY` albo `OPENROUTER_API_KEY`
- do wysyłki dodatkowo `AIDEVS_API_KEY` albo `HUB_API_KEY`

Przydatne opcjonalne zmienne:

- `MODEL_NAME`
- `VISION_MODEL`
- `REQUEST_TIMEOUT_MS`
- `VISION_TIMEOUT_MS`
- `MAX_VISION_ATTEMPTS`
- `ROUTE_CODE_OVERRIDE`

## Uruchomienie

Lokalne wygenerowanie deklaracji:

```bash
npm start
```

Wymuszenie odświeżenia dokumentów:

```bash
npm start -- --refresh
```

Wysłanie do verify:

```bash
npm start -- --submit
```

Jeśli kod trasy jest już znany i nie chcesz ponownie odpalać vision:

```bash
npm start -- --submit --route-code=X-01
```

## Wyniki

- deklaracja: `output/declaration.txt`
- odpowiedź verify: `output/verify-response.json`

## Ustalona wartość dla zadania

- trasa `Gdańsk -> Żarnowiec`: `X-01`
- `WDP` oznacza liczbę faktycznie potrzebnych dodatkowych wagonów
- dla `2800 kg` wychodzi `WDP: 4`
- kategoria `A` nadal daje `0 PP`