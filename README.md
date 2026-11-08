# WorkHub 🖥️⚡

**Wspólny hub pracy dla dwóch osób**, które siedzą przy jednym biurku (lub w jednym domu).
Obie osoby logują się na swoje komputery do tej samej instancji i widzą to samo **na żywo**:
repozytoria GitHub, modele AI (Ollama / API), chat, zadania i aktywność.

```
┌────────────────┐      HTTP + Socket.IO       ┌──────────────────────────────────┐
│  Komputer A    │ ──────────────────────────► │  Serwer Node.js (Express) :3000  │
│  przeglądarka  │ ◄────────────────────────── │                                  │
└────────────────┘   token sesji, SSE (AI)     │  routes/   → auth, state, repos, │
                                               │                ai                │
┌────────────────┐      HTTP + Socket.IO       │  services/ → github.js, ai.js    │
│  Komputer B    │ ──────────────────────────► │  socket.js → chat, tasks,        │
│  przeglądarka  │ ◄────────────────────────── │              presence, activity  │
└────────────────┘                             │  store.js  → plik JSON (dane)    │
                                               └───────┬──────────────┬───────────┘
                                                       │              │
                                                  ┌────▼─────┐  ┌─────▼──────────────┐
                                                  │ GitHub   │  │ Ollama :11434      │
                                                  │ API      │  │ lub API zgodne     │
                                                  └──────────┘  │ z OpenAI           │
                                                                └────────────────────┘
```

- **Frontend:** React (Vite) — zbudowany do `client/dist`, serwowany z tego samego portu co API (zero CORS).
- **Backend:** Node.js + Express + Socket.IO.
- **Baza:** jeden plik JSON (`data/workhub.json`) — użytkownicy, sesje, zadania, czat, aktywność, rozmowy AI.
- **Real-time:** Socket.IO (chat, zadania, obecność, „pisze…”, aktywność) + SSE dla strumienia AI.

---

## 1. Wymagania

| Czego | Ile | Po co |
|---|---|---|
| Node.js | **≥ 18.17** (zalecane 20+) | serwer + build frontendu |
| (opcjonalnie) Ollama | najnowsza | modele AI lokalnie |
| (opcjonalnie) Token GitHub | PAT z zakresem `repo`/`public_repo` (read) | więcej zapytań + repo prywatne |

## 2. Instalacja

```bash
git clone <adres-repo> workhub && cd workhub
npm install
cp .env.example .env        # i uzupełnij wartości (patrz niżej)
```

## 3. Konfiguracja (`.env`)

```ini
PORT=3000                   # port serwera
HOST=0.0.0.0                # WAŻNE: 0.0.0.0 = dostęp z całej sieci LAN

AI_PROVIDER=ollama          # ollama | openai
OLLAMA_URL=http://localhost:11434
# AI_PROVIDER=openai:
# AI_BASE_URL=https://api.openai.com/v1
# AI_API_KEY=sk-...
# AI_MODEL=gpt-4o-mini

GITHUB_TOKEN=               # opcjonalnie, bez niego działa tryb anonimowy (publiczne repo)

MAX_USERS=2                 # limit kont (WorkHub jest dla dwóch osób, ale podnoś śmiało)
```

> Wszystko działa też bez `.env` (domyślne wartości) — AI i GitHub pokażą wtedy
> czytelny komunikat o braku konfiguracji i podpowiedzą, co zrobić.

## 4. Uruchomienie

**Tryb produkcyjny (zalecany dla pracy na 2 komputerach):**

```bash
npm run build     # zbuduje frontend do client/dist
npm start         # serwer pod http://0.0.0.0:3000
```

**Tryb deweloperski (hot reload, dwa procesy):**

```bash
npm run dev       # API :3000 + Vite :5173 (proxy /api i /socket.io)
```

Po starcie serwer wypisze adresy, pod którymi otworzyć aplikację, np.:

```
WorkHub uruchomiony
Serwer:  http://localhost:3000
Sieć:    http://192.168.1.10:3000
```

Adres sieci LAN wyświetli też **ekran logowania** (chipy z adresem — kliknięcie kopiuje).

## 5. Test na dwóch komputerach (ta sama sieć WiFi)

1. Na komputerze **A** uruchom serwer (`npm start`) i otwórz `http://localhost:3000`.
   Zarejestruj pierwsze konto (np. `asia`).
2. Na komputerze **B** (ten sam WiFi) otwórz adres LAN z ekranu logowania
   (np. `http://192.168.1.10:3000`) i zarejestruj drugie konto (np. `piotrek`).
3. Sprawdź:
   - w **Czacie** napisz „hej” — druga osoba widzi wiadomość natychmiast + animowany „pisze…”,
   - w **Zadaniach** dodaj zadanie — po drugiej stronie pojawi się od razu, odhaczenie synchronizuje się tak samo,
   - w **Aktywności** śledzone są: komunikaty, zadania, użycie modeli AI, przeglądanie repo, przychodzenie/odchodzenie online,
   - w nagłówku widać awatary obu osób i zielone kropki **online/offline**.
4. W **Repozytoriach** podaj użytkownika GitHub (np. `torvalds`) albo frazę w wyszukiwarce,
   otwórz repo → zmieniaj gałęzie, wchodź w katalogi, otwieraj pliki, oglądaj commity.
5. W **Modelu AI** wybierz model i wyślij prompt — odpowiedź przepływa token po tokenie.

> Jak sprawdzić swój adres IP?
> Windows: `ipconfig` → „Wszystkie połączenia LAN” / macOS, Linux: `ifconfig` lub `ip addr`.

## 6. Opcjonalne integracje

### Ollama (lokalne modele)

```bash
# na maszynie, na której stoi SERWER WorkHub
curl -fsSL https://ollama.com/install.sh | sh
ollama serve &            # jeśli nie działa z systemem
ollama pull qwen2.5:3b    # albo: llama3.2, mistral, phi3…
```

WorkHub sam odczyta listę modeli z `http://localhost:11434/api/tags`.

### Token GitHub

1. GitHub → Settings → Developer settings → **Personal access tokens** → *Tokens (classic)*.
2. Zakres: `public_repo` (publiczne) lub `repo` (także prywatne) — wystarczy do odczytu.
3. Wklej do `GITHUB_TOKEN=...` w `.env` i zrestartuj serwer.

### Zdalne API AI (zamiast Ollama)

Każde API zgodne z OpenAI (OpenAI, OpenRouter, Groq, Together, LM Studio…):

```ini
AI_PROVIDER=openai
AI_BASE_URL=https://openrouter.ai/api/v1
AI_API_KEY=sk-or-...
AI_MODEL=qwen/qwen-2.5-7b-instruct
```

## 7. Struktura katalogów

```
.
├── package.json              # wszystkie zależności + skrypty (root)
├── .env.example              # szablon konfiguracji
├── README.md
├── scripts/
│   └── smoke.js              # test dymny API + Socket.IO (npm run smoke)
├── server/
│   ├── index.js              # Express + Socket.IO + statyczny frontend
│   ├── config.js             # .env + adresy LAN
│   ├── store.js              # baza JSON (użytkownicy, zadania, czat, aktywność)
│   ├── middleware.js         # auth Bearer-token, błędy
│   ├── socket.js             # real-time: chat, zadania, presence, aktywność
│   ├── routes/
│   │   ├── auth.js           # rejestracja / logowanie / logout / me / users
│   │   ├── state.js          # /api/state (startowy stan pulpitu), /api/info
│   │   ├── repos.js          # proxy GitHub: user, search, tree, commits, blob
│   │   └── ai.js             # listy modeli + strumień SSE czatu z modelem
│   └── services/
│       ├── github.js         # klient GitHub API (limity, czytelne błędy PL)
│       └── ai.js             # adaptery: Ollama + OpenAI-kompatybilne (streaming)
├── client/
│   ├── index.html            # fonty (Inter, Space Grotesk), favicon
│   ├── vite.config.js        # dev proxy → :3000
│   └── src/
│       ├── main.jsx
│       ├── App.jsx           # sesja, Socket.IO, motyw, toasty, routing logowania
│       ├── api.js            # fetch + parser SSE
│       ├── styles.css        # design system (motywy, animacje, siatka)
│       ├── lib/format.js     # czas „x min temu”, kolory języków, inicjały
│       └── components/
│           ├── Login.jsx     # logowanie/rejestracja + adresy LAN + statusy
│           ├── Dashboard.jsx # siatka kafelków
│           ├── Header.jsx    # online, motyw, logout
│           ├── Tile.jsx      # ogólny kafel (animacja wejścia, hover)
│           ├── Chat.jsx      # czat + „pisze…”
│           ├── Tasks.jsx     # wspólne zadania
│           ├── Activity.jsx  # feed aktywności
│           ├── Repos.jsx     # repo → gałęzie → pliki/commity → podgląd pliku
│           ├── AIChat.jsx    # model + prompt + streaming na żywo
│           ├── Icons.jsx     # zestaw ikon SVG
│           └── bits.jsx      # Empty / ErrorBox / Skeleton
└── data/                     # runtime: workhub.json (tworzony automatycznie)
```

## 8. Rozwiązywanie problemów

| Objaw | Co zrobić |
|---|---|
| Drugi komputer nie może się połączyć | Czy `HOST=0.0.0.0`? Czy oba komputery są w tym samym WiFi? Wyłącz/uruchom firewall Windows (przepuść port 3000 dla Node.js). |
| „Ollama jest niedostępna…” | `ollama serve` na maszynie serwera; `OLLAMA_URL` musi wskazywać tę maszynę (`localhost`, gdy Ollama i WorkHub są na tym samym PC). |
| „Limit zapytań GitHub wyczerpany” | Ustaw `GITHUB_TOKEN` — limit skacze ze 60 do 5000 zapytań/h. |
| „Model nie istnieje w Ollama” | `ollama list` — podgląd nazw; pobrań brakujący (`ollama pull <nazwa>`). |
| Straciłem hasła | Usuń `data/workhub.json` (kasuje też dane) lub poproś kolegę o zalogowanie i wylogowanie konta… najprościej: nowy plik = czysta instancja. |

## 9. Skrypty

| Skrypt | Opis |
|---|---|
| `npm run build` | build frontendu do `client/dist` |
| `npm start` | produkcja: Express serwuje API + Socket.IO + statyczny frontend |
| `npm run dev` | dev: API (:3000) + Vite (:5173) równolegle |
| `npm run smoke` | test dymny: rejestracja, stan, chat/zadania przez Socket.IO (wymaga uruchomionego serwera) |

## 10. Co można dorobić później

- **Pokoje/kanały** — zamiast jednego wspólnego czatu: tematy (np. „bug w bilansie”, „wyjazd”)
- **GitLab/Bitbucket** — dodatkowy adapter w `server/services/` (interfejs GitHub pozostaje ten sam)
- **Załączniki w czacie** (mini plikobaza na dysku + endpoint pobierania)
- **Podgląd renderowanego Markdown / diagramów w plikach**
- **Tryb „fokus”** — ukrycie kafelków, które nie są potrzebne (układ zapisywany per użytkownik)
- **Powiadomienia push** (Web Notifications) gdy druga osoba pisze/odhacza zadanie
- **Kluczowanie zadań terminem i przypisaniem do osoby** (dziś: wspólna pula)
- **Szyfrowanie spoczynku** pliku `data/workhub.json` (np. AES-GCM z hasłem z `.env`)
- **Automatyczne backupy** bazy do `data/backups/`
- **Wykres aktywności** (ile kto napisał/odhaczył w dniach)
- **Integracja z kalendarzem** (wspólne „co dziś robimy”)
- **Druk / wyeksportowanie wspólnego sprinta** do PDF/Markdown
