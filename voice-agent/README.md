# CARE voice agent

A support assistant for CARE that people can talk to from inside the app.
Ask it how to do something ("how do I add a schedule for a doctor?") or tell it
about an error you hit, and it answers from the actual CARE source code. For
problems it says how they get fixed:

| Result                                   | Meaning                                                        |
| ---------------------------------------- | -------------------------------------------------------------- |
| How to                                   | It already works, here are the steps                           |
| Fix with data or permissions             | Create missing data or grant a role / permission               |
| Fix with configuration                   | Set an existing env var / plugin setting (key and value given) |
| Needs frontend / backend / plugin change | No setting covers it; which files to change and how            |
| Needs more information                   | It asks you a follow-up question                               |

## How it works

```
CARE frontend (care_fe)                        voice-agent (this folder)
┌───────────────────────────────┐   HTTPS    ┌──────────────────────────────────────┐
│ Headset button → side panel   │──────────▶│ POST /api/ask (NDJSON progress stream)│
│ Speech-to-text (browser)      │  CARE JWT  │ verifies JWT with the CARE backend    │
│ Text-to-speech (browser)      │◀──────────│ Claude agent loop with code tools     │
└───────────────────────────────┘            │  search_code / read_file / list_dir   │
                                             │  submit_answer (structured result)   │
                                             └──────────────┬───────────────────────┘
                                                            │ in-memory index
                                         care_fe + care backend + plugins checkouts
```

- **Memory of CARE**: at start-up the server indexes the tracked files of each
  checkout (frontend, backend, plugins). The system prompt carries a catalog of
  every env var / setting the code reads, every page and API route, and each
  repo's README / CLAUDE.md. That snapshot is prompt-cached. During a question
  the agent searches and reads the code to confirm its answer and cites
  `repo:path:line`. Restart the server after pulling new code.
- **Voice** uses the browser's Web Speech API (Chrome, Edge and Safari), in
  the user's CARE language (`en`, `hi`, `ml`, ... mapped to `xx-IN`). Typing
  always works too, and an error message can be pasted with the question.
- **Conversation memory**: follow-up questions continue the same conversation
  for an hour, per user. "New conversation" clears it.
- **Safety**: only signed-in CARE users can ask questions, and each user has a
  rate limit. Only git-tracked files are indexed, so local `.env` secrets are
  never read. The agent is told never to repeat credentials or patient data.

## Run it

```bash
cd voice-agent
npm install
cp .env.example .env   # set ANTHROPIC_API_KEY, CARE_BACKEND_DIR, ...
node --env-file=.env node_modules/.bin/tsx src/server.ts
# or: export the variables and run `npm start`
```

Then point the frontend at it in `care_fe/.env.local` and restart `npm run dev`:

```
REACT_VOICE_AGENT_URL=http://localhost:8787
```

A headset button appears at the bottom right of every page once you are signed
in. When `REACT_VOICE_AGENT_URL` is not set, the button is not shown.

Ask from the terminal, without the frontend: `npm run ask`.

### Docker

```bash
docker build -t care-voice-agent voice-agent
docker run -p 8787:8787 --env-file voice-agent/.env \
  -v "$PWD":/sources/care_fe:ro -e CARE_FE_DIR=/sources/care_fe \
  -v /srv/care:/sources/care:ro -e CARE_BACKEND_DIR=/sources/care \
  care-voice-agent
```

## Configuration

| Variable                      | Default                 | Description                                                              |
| ----------------------------- | ----------------------- | ------------------------------------------------------------------------ |
| `ANTHROPIC_API_KEY`           |                         | Claude API key                                                           |
| `PORT` / `HOST`               | `8787` / `0.0.0.0`      | Listen address                                                           |
| `CARE_FE_DIR`                 | parent of this folder   | Frontend checkout                                                        |
| `CARE_BACKEND_DIR`            |                         | Backend checkout ([ohcnetwork/care](https://github.com/ohcnetwork/care)) |
| `CARE_EXTRA_SOURCES`          |                         | Plugins, `name=path,name=path`                                           |
| `CARE_API_URL`                | `http://127.0.0.1:9000` | CARE backend that validates user tokens                                  |
| `VOICE_AGENT_REQUIRE_AUTH`    | `true`                  | Set `false` only for local testing                                       |
| `VOICE_AGENT_ALLOWED_ORIGINS` | `*`                     | CORS origins of the frontend, comma separated                            |
| `VOICE_AGENT_RATE_LIMIT`      | `30`                    | Questions per user per 10 minutes                                        |
| `VOICE_AGENT_MODEL`           | `claude-opus-5-5`       | Claude model                                                             |
| `VOICE_AGENT_EFFORT`          | `medium`                | `low` answers faster, `high` researches more                             |
| `VOICE_AGENT_MAX_ITERATIONS`  | `25`                    | Max research round trips per question                                    |

## API

`POST /api/ask` with `Authorization: Bearer <CARE access token>`:

```json
{
  "question": "Why can't I save the form as a draft?",
  "session_id": "any-id-per-conversation",
  "error_text": "optional pasted error",
  "page": "/facility/…/questionnaire",
  "language": "en"
}
```

The response is newline-delimited JSON: `{"type":"status","text":"Searching the code for …"}`
lines while it researches, then one `{"type":"answer","answer":{…}}` (or
`{"type":"error","message":…}`). The answer has `spoken_summary`,
`resolution_type`, `details_markdown`, `config_changes[]`, `code_changes[]`,
`references[]` and `follow_up_question`.

`POST /api/reset {"session_id": …}` forgets a conversation. `GET /health`
reports the indexed sources.
