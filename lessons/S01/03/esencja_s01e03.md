# Esencja wiedzy — S01E03: Projektowanie API dla efektywnej pracy z modelem

## O czym jest ten materiał?
To lekcja o tym, **jak projektować API, narzędzia i serwery MCP tak, żeby dobrze współpracowały z LLM**. Kluczowy wniosek: **nie wystarczy „podłączyć API”**. Trzeba je uprościć, dobrze opisać, zabezpieczyć i dostosować do sposobu działania modelu.

---

# 1. Najważniejsza myśl do zapamiętania

## Dobre narzędzie dla AI to nie kopia API
To **warstwa pośrednia**, która:
- upraszcza interfejs,
- ogranicza chaos,
- daje modelowi jasne wskazówki,
- obsługuje błędy i sytuacje brzegowe,
- chroni system przed złym użyciem.

### Zapamiętaj:
**API dla programisty ≠ narzędzie dla LLM**

---

# 2. Co sprawdzić w API zanim zbudujesz narzędzia dla AI?

Przed projektowaniem narzędzi przeanalizuj, czy API ma:

- brakujące lub ograniczone akcje,
- niejasne identyfikatory zasobów,
- niespójne nazwy pól,
- zbyt ubogie odpowiedzi,
- zbyt skomplikowane relacje między akcjami,
- polling / asynchroniczność,
- rate limiting,
- słabe wyszukiwanie i paginację.

## Wniosek
Jeśli API jest niewygodne dla modelu, to agent będzie działał gorzej.
Część problemów da się naprawić w warstwie narzędzi, ale **czasem trzeba poprawić samo API**.

### Reguła do nauki
**Najpierw poznaj API, potem projektuj narzędzia.**

---

# 3. Jak projektować zestaw narzędzi?

Autor pokazuje ważną zasadę:
**nie twórz zbyt wielu drobnych narzędzi, jeśli można je sensownie scalić.**

Na przykładzie Filesystem MCP:
- zamiast 13 osobnych narzędzi,
- można dojść do 4 głównych klas działań:
  - `fs_search`
  - `fs_read`
  - `fs_write`
  - `fs_manage`

## Dlaczego to ma sens?
Bo modelowi łatwiej działać na:
- mniejszej liczbie schematów,
- prostszych nazwach,
- bardziej logicznych grupach odpowiedzialności.

## Ale uwaga
Nie chodzi o maksymalne zmniejszanie liczby narzędzi za wszelką cenę.
Chodzi o **balans między prostotą a czytelnością**.

### Reguła do zapamiętania
**Scalaj narzędzia, ale nie kosztem zrozumiałości.**

---

# 4. Jak powinien wyglądać interfejs narzędzia dla LLM?

Dobre narzędzie dla modelu ma:
- proste nazwy,
- mało parametrów,
- jasny tryb działania,
- minimalny, ale użyteczny output,
- przewidywalne odpowiedzi.

## Ważna idea
Narzędzie ma być zaprojektowane nie tylko pod API, ale też pod:
- sposób myślenia modelu,
- jego ograniczenia,
- przypadki użycia użytkownika.

## Co trzeba brać pod uwagę?
- możliwości API,
- przejrzystość dla LLM,
- poziom złożoności akcji,
- ryzyko halucynacji,
- rzeczywiste zadania użytkownika.

### Hasło do zapamiętania
**Projektujesz nie tylko funkcję — projektujesz decyzje modelu.**

---

# 5. Implementacja dla AI musi być „mądrzejsza” niż zwykłe API

To bardzo ważny fragment lekcji.

Autor pokazuje, że narzędzie dla LLM powinno robić więcej niż zwykłe API, np.:
- rozpoznawać pomyłki modelu,
- próbować dopasować ścieżkę po nazwie pliku,
- ograniczać zbyt duże odpowiedzi,
- reagować na brak uprawnień,
- podpowiadać, co zrobić dalej.

## Czyli:
Narzędzie nie tylko wykonuje akcję.
Narzędzie **prowadzi model**.

### Reguła do nauki
**LLM potrzebuje nie tylko danych, ale też wskazówek.**

---

# 6. Dynamiczne odpowiedzi sukcesu i błędów

Jedna z najmocniejszych tez materiału:
**komunikaty błędów i odpowiedzi powinny być pisane z myślą o kolejnym kroku modelu.**

Zamiast:
- „błąd”,
- „nie znaleziono”,
- „niepoprawne dane”,

lepiej zwracać:
- co dokładnie poszło nie tak,
- co zostało poprawione automatycznie,
- co model powinien zrobić teraz.

## Przykłady dobrych odpowiedzi
- „Nie znaleziono etykiety o tej nazwie. Dostępne etykiety to: X, Y, Z.”
- „Zażądano linii 48–70, ale plik ma tylko 59 linii. Wczytano zakres 48–59.”

## Wniosek
Dobra odpowiedź narzędzia to mini-instrukcja dla kolejnego ruchu agenta.

### Zapamiętaj
**Output narzędzia ma pomagać myśleć modelowi.**

---

# 7. MCP — czym jest naprawdę?

## Najprościej
MCP (Model Context Protocol) to standard, który ułatwia podłączanie narzędzi, zasobów i integracji do agentów AI.

## Po co?
Bo każdy provider i każda aplikacja obsługuje narzędzia trochę inaczej.
MCP pozwala zrobić integrację raz i używać jej w wielu miejscach.

## Najważniejsze pojęcia
- **Host** — aplikacja korzystająca z MCP,
- **Client** — warstwa połączenia,
- **Server** — proces / aplikacja udostępniająca narzędzia.

## Kluczowy wniosek
Dla agenta nie ma większego znaczenia, czy narzędzie jest:
- natywne,
- czy dostarczone przez MCP.

Liczy się to, że ostatecznie dostaje **schemat i możliwość wywołania funkcji**.

### Formułka do zapamiętania
**MCP to standard dostarczania narzędzi, a nie „magia”, która sama rozwiązuje problemy projektowe.**

---

# 8. MCP nie zastępuje natywnych narzędzi

To ważne.
Autor podkreśla, że MCP nie musi być alternatywą dla własnych narzędzi.
Może działać **obok nich**.

## Czyli można:
- mieć narzędzia zapisane lokalnie w aplikacji,
- podłączyć zewnętrzne serwery MCP,
- połączyć wszystko w jedną listę dostępnych funkcji.

## Wniosek
MCP to raczej **warstwa integracyjna**, a nie nowy sposób myślenia o tool use od zera.

---

# 9. Główne komponenty MCP

MCP to nie tylko narzędzia. Są też:

## 1. Apps
Interaktywne interfejsy zwracane użytkownikowi.

## 2. Resources
Dane do odczytu, np. pliki, obrazy, listy zasobów.

## 3. Prompts
Gotowe instrukcje lub komendy wybierane przez użytkownika.

## 4. Sampling
Serwer MCP prosi hosta o wykonanie zapytania do modelu.

## 5. Elicitation
Serwer MCP prosi użytkownika o dodatkowe dane lub akcję.

### Zapamiętaj skrót
**MCP = Tools + Apps + Resources + Prompts + Sampling + Elicitation**

---

# 10. Dwa transporty MCP

## STDIO
Dobre dla:
- lokalnych procesów,
- narzędzi działających na tej samej maszynie,
- aplikacji desktopowych,
- sytuacji „1 użytkownik = 1 proces”.

## Streamable HTTP
Lepszy domyślnie dla:
- zdalnych serwerów,
- wdrożeń na VPS / Workers,
- wielu użytkowników,
- sesji i autoryzacji.

### Reguła do zapamiętania
**STDIO — lokalnie. HTTP — produkcyjnie i zdalnie.**

---

# 11. Agent vs workflow

Bardzo ważne rozróżnienie.

## Workflow
- większa kontrola,
- mniejsza elastyczność,
- z góry ustalone kroki.

## Agent
- większa elastyczność,
- większa dynamika,
- może sam eksplorować, sprawdzać i poprawiać,
- ale rośnie ryzyko błędów.

## Najważniejszy wniosek
Jeśli chcesz, żeby kroki były zawsze identyczne, często lepszy będzie **workflow**.
Jeśli zadanie wymaga eksploracji i korekt, lepszy może być **agent**.

### Formułka do nauki
**Workflow = kontrola. Agent = elastyczność.**

---

# 12. Jak budować serwery MCP w praktyce?

Autor poleca podejście **spec-driven**.

## Praktyczny proces
1. Weź szablon serwera MCP.
2. Wklej dokumentację API do osobnego pliku.
3. Każ agentowi przeczytać README i manual.
4. Poproś o propozycję listy narzędzi.
5. Ogranicz ich liczbę i pogrupuj sensownie.
6. Zaprojektuj input/output.
7. Wygeneruj implementację.
8. Zweryfikuj kod.
9. Usuń zbędne elementy szablonu.

## Główny sens tego podejścia
LLM dobrze pomaga w budowie MCP, ale trzeba go prowadzić dokumentacją i iteracyjnie kontrolować wynik.

### Reguła do zapamiętania
**Nie buduj MCP „na pamięć modelu” — buduj na specyfikacji i iteracjach.**

---

# 13. Bezpieczeństwo i prywatność

To jeden z najważniejszych tematów całej lekcji.

## Kluczowa teza
MCP ani tool use **same z siebie nie rozwiązują problemów bezpieczeństwa**.

## Co jest problemem?
- prompt injection,
- nieprzewidywalne środowisko użytkownika,
- nieznane inne narzędzia hosta,
- nieznane procesy i przepływy danych,
- możliwe działania złą intencją.

## Co robić?
Stosować twarde ograniczenia programistyczne:
- walidacje,
- limity,
- autoryzację,
- zawężanie akcji,
- kontrolę uprawnień,
- anonimizację,
- dodatkowe weryfikacje.

### Zdanie do wbicia w pamięć
**Bezpieczeństwa nie zostawiasz modelowi — wymuszasz je kodem.**

---

# 14. Autoryzacja i uprawnienia

Jeśli serwer MCP działa dla użytkowników końcowych, trzeba pilnować:
- kto ma dostęp,
- do jakich narzędzi,
- do jakich danych,
- z jakim zakresem działań.

## Wniosek
Nie wystarczy „udostępnić narzędzia”.
Trzeba kontrolować:
- tożsamość,
- zakres dostępu,
- kontekst użycia.

### Reguła
**Każde narzędzie powinno działać w granicach uprawnień użytkownika, nie modelu.**

---

# 15. Dużo narzędzi = nowe problemy

Gdy pojawia się dużo serwerów i narzędzi, rośnie ryzyko:
- konfliktów nazw,
- nakładania odpowiedzialności,
- chaosu decyzyjnego dla modelu,
- spadku skuteczności wyboru właściwego narzędzia.

## Co z tego wynika?
Trzeba:
- pilnować nazewnictwa,
- unikać dublowania funkcji,
- porządkować kompetencje narzędzi,
- ograniczać liczbę narzędzi do sensownego minimum.

---

# 16. MCP i lokalne modele open-source

Materiał porusza też temat używania MCP z lokalnymi modelami.

## Wniosek praktyczny
To możliwe, ale skuteczność zależy od:
- jakości modelu,
- umiejętności korzystania z narzędzi,
- długości kontekstu,
- stabilności wywołań.

### Zapamiętaj
**MCP nie czyni słabego modelu nagle dobrym agentem.**

---

# 17. Co warto zapamiętać o publikacji serwerów MCP?

Jeśli serwer ma być zdalny i używany szerzej:
- domyślnie myśl o Streamable HTTP,
- myśl o sesjach użytkowników,
- myśl o OAuth / autoryzacji,
- myśl o kontroli dostępu,
- myśl o produkcyjnym wdrożeniu.

## Czyli
Serwer MCP to nie tylko „narzędzia dla modelu”, ale też normalna odpowiedzialność backendowa.

---

# 18. Pigułka egzaminacyjna — 10 zdań, które warto umieć powiedzieć z pamięci

1. **Narzędzie dla LLM nie powinno być surową kopią API.**
2. **Najpierw analizuję API, potem projektuję warstwę narzędzi.**
3. **Mniej narzędzi zwykle pomaga, jeśli nie tracę czytelności.**
4. **Interfejs dla modelu musi być prosty, przewidywalny i dobrze opisany.**
5. **Output narzędzia powinien podpowiadać modelowi następny krok.**
6. **MCP to standard integracji narzędzi, zasobów i interakcji z agentami.**
7. **MCP może działać razem z natywnymi narzędziami aplikacji.**
8. **STDIO jest dobre lokalnie, a Streamable HTTP lepsze dla zdalnych wdrożeń.**
9. **Workflow daje kontrolę, agent daje elastyczność.**
10. **Bezpieczeństwo trzeba wymuszać kodem, a nie zaufaniem do modelu.**

---

# 19. Superkrótka mapa myśli

## Projektowanie narzędzi dla AI
→ poznaj API  
→ uprość interfejs  
→ pogrupuj akcje  
→ dawaj dynamiczne wskazówki  
→ obsłuż błędy i edge case’y  
→ chroń system ograniczeniami

## MCP
→ host / client / server  
→ tools + resources + prompts + apps  
→ STDIO lokalnie  
→ HTTP zdalnie  
→ może współistnieć z własnymi narzędziami

## Architektura
→ agent = elastyczność  
→ workflow = kontrola  
→ spec-driven = najlepsza praktyka  
→ bezpieczeństwo = walidacje, uprawnienia, limity

---

# 20. Fiszki do nauki

## Pytanie:
Czym różni się API dla programisty od narzędzia dla LLM?

## Odpowiedź:
Narzędzie dla LLM powinno upraszczać API, prowadzić model, obsługiwać błędy i ograniczać ryzyko pomyłek.

---

## Pytanie:
Po co scalać narzędzia?

## Odpowiedź:
Aby zmniejszyć liczbę schematów i uprościć wybór funkcji przez model, ale bez utraty czytelności.

---

## Pytanie:
Po co dynamiczne komunikaty błędów?

## Odpowiedź:
Żeby model wiedział, co poszło nie tak i jaki powinien być kolejny krok.

---

## Pytanie:
Czym jest MCP?

## Odpowiedź:
To standard integracji narzędzi, zasobów i interakcji między agentami AI a zewnętrznymi systemami.

---

## Pytanie:
Kiedy użyć STDIO, a kiedy Streamable HTTP?

## Odpowiedź:
STDIO lokalnie, Streamable HTTP dla zdalnych i produkcyjnych wdrożeń.

---

## Pytanie:
Kiedy lepszy jest workflow niż agent?

## Odpowiedź:
Gdy zależy nam na stałej kolejności kroków i pełnej kontroli nad procesem.

---

## Pytanie:
Jak zabezpieczać systemy z LLM?

## Odpowiedź:
Przez walidacje, limity, autoryzację, zawężanie akcji i kontrolę uprawnień.

---

# 21. Jednozdaniowe podsumowanie całej lekcji

**Najlepsze narzędzia dla AI powstają wtedy, gdy upraszczasz API, projektujesz je pod sposób działania modelu, wdrażasz MCP świadomie i wymuszasz bezpieczeństwo kodem.**
