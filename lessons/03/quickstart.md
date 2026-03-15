# Quickstart — S01E03 Proxy

## Wymagania

Plik `c:\DEV\4th-devs\.env` z kluczami:

```
OPENAI_API_KEY=sk-...
AIDEVS_API_KEY=...
```

Opcjonalnie:
```
PORT=3000
MODEL=gpt-4o-mini
MAX_TOOL_ROUNDS=5
```

---

## 1. Uruchom serwer

Terminal 1 — zostaw otwarty:

```powershell
cd c:\DEV\4th-devs\lessons\03
npm start
```

Serwer nasłuchuje na `http://localhost:3000`.

> Jeśli pojawia się błąd z background jobami: `Get-Job | Stop-Job; Get-Job | Remove-Job`

---

## 2. Wystaw serwer przez ngrok

Terminal 2:

```powershell
ngrok http 3000
```

Skopiuj URL, np. `https://petra-impeccable-amberly.ngrok-free.dev`.

---

## 3. Zgłoś do Hub

```powershell
node submit.js https://petra-impeccable-amberly.ngrok-free.dev
```

Lub z własnym sessionID:

```powershell
node submit.js https://petra-impeccable-amberly.ngrok-free.dev moja-sesja-01
```

---

## 4. Szybki test lokalny

```powershell
# Health check
Invoke-RestMethod http://localhost:3000/ -Method GET

# Test casual
$body = '{"sessionID":"test-001","msg":"Hej, jak leci?"}'
Invoke-RestMethod http://localhost:3000/ -Method POST -ContentType "application/json" -Body $body

# Test check_package
$body = '{"sessionID":"test-001","msg":"Sprawdź paczkę PKG00012345"}'
Invoke-RestMethod http://localhost:3000/ -Method POST -ContentType "application/json" -Body $body
```

---

## Skrypty

| Polecenie | Opis |
|-----------|------|
| `npm start` | Uruchamia serwer |
| `npm run dev` | Uruchamia z hot-reload |
| `node submit.js <url> [sessionID]` | Zgłasza URL do Hub |
