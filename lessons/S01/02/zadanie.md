## Zadanie

Musisz namierzyć, która z podejrzanych osób z poprzedniego zadania **przebywała blisko jednej z elektrowni atomowych.** Musisz także ustalić jej **poziom dostępu** oraz informację koło której elektrowni widziano tę osobę. Zebrane tak dane prześlij do `/verify`. Nazwa zadania to **findhim**.

#### Skąd wziąć dane?

1. **Lista elektrowni + ich kody**
   - Pobierz JSON z listą elektrowni (wraz z kodami identyfikacyjnymi) z:
     - `https://hub.ag3nts.org/data/tutaj-twój-klucz/findhim_locations.json`

2. **Gdzie widziano konkretną osobę (lokalizacje)**

   - Endpoint: `https://hub.ag3nts.org/api/location`
   - Metoda: `POST`
   - Body: `raw JSON` (nie form-data!)
   - Zawsze wysyłasz pole `apikey` oraz dane osoby (`name`, `surname`)
   - Odpowiedź: lista współrzędnych (koordynatów), w których daną osobę widziano.

   Przykładowy payload:

   ```json
   {
     "apikey": "tutaj-twój-klucz",
     "name": "Jan",
     "surname": "Kowalski"
   }
   ```

3. **Jaki poziom dostępu ma wskazana osoba**

   - Endpoint: `https://hub.ag3nts.org/api/accesslevel`
   - Metoda: `POST`
   - Body: `raw JSON`
   - Wymagane: `apikey`, `name`, `surname` oraz `birthYear` (rok urodzenia bierzesz z danych z poprzedniego zadania, np. z CSV)

   Przykładowy payload:

   ```json
   {
     "apikey": "tutaj-twój-klucz",
     "name": "Jan",
     "surname": "Kowalski",
     "birthYear": 1987
   }
   ```

#### Co masz zrobić krok po kroku?

Dla każdej podejrzanej osoby:

1. Pobierz listę jej lokalizacji z `/api/location`.
2. Porównaj otrzymane koordynaty z koordynatami elektrowni z `findhim_locations.json`.
3. Jeśli lokalizacja jest bardzo blisko jednej z elektrowni — masz kandydata.
4. Dla tej osoby pobierz `accessLevel` z `/api/accesslevel`.
5. Zidentyfikuj **kod elektrowni** (format: `PWR0000PL`) i przygotuj raport.

#### Jak wysłać odpowiedź?

Wysyłasz ją metodą **POST** na `https://hub.ag3nts.org/verify`.

Nazwa zadania to: **findhim**.

Pole `answer` to **pojedynczy obiekt** zawierający:

- `name` – imię podejrzanego
- `surname` – nazwisko podejrzanego
- `accessLevel` – poziom dostępu z `/api/accesslevel`
- `powerPlant` – kod elektrowni z `findhim_locations.json` (np. `PWR1234PL`)

Przykład JSON do wysłania na `/verify`:

```json
{
  "apikey": "tutaj-twój-klucz",
  "task": "findhim",
  "answer": {
    "name": "Jan",
    "surname": "Kowalski",
    "accessLevel": 3,
    "powerPlant": "PWR1234PL"
  }
}
```