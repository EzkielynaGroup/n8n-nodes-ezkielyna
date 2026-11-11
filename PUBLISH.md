# Publish notes (owner)

Built locally on 12 Nov 2026. Nothing is pushed or published yet. Package name `n8n-nodes-ezkielyna` was free on npm on 12 Nov 2026.

- **GitHub repo:** `EzkielynaGroup/n8n-nodes-ezkielyna` (public; verification needs a public GitHub source)
- **Description (<= 120 chars):** n8n community nodes for Ezkielyna AI API: chat, web search, Indonesian TTS, transcription, images, AI Agent model
- **Homepage:** https://ezkielyna.store/?utm_source=github&utm_medium=repo&utm_campaign=n8n-nodes-ezkielyna
- **Topics:** n8n, n8n-community-node-package, n8n-nodes, n8n-community-node, ai-agent, llm, openai-compatible, deepseek, text-to-speech, speech-to-text, web-search, image-generation, indonesia

## n8n verification rules found (checked 12 Nov 2026)

| Rule | Status here | Source |
|---|---|---|
| Name starts with `n8n-nodes-`; keyword `n8n-community-node-package`; nodes and credentials listed in the `n8n` field of package.json | done | [Submit community nodes](https://docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/) |
| **No runtime dependencies** for verified nodes | done: no `dependencies`; only peer deps `n8n-workflow` and `@n8n/ai-node-sdk` (both provided by n8n) | same page |
| Linter passes (`npm run lint` = `n8n-node lint`, rules from `@n8n/eslint-plugin-community-nodes` + `eslint-plugin-n8n-nodes-base`) | done: 0 errors, 0 warnings with `@n8n/node-cli` 0.56.2 | same page; [n8n-nodes-starter](https://github.com/n8n-io/n8n-nodes-starter) |
| Scaffold with `npm create @n8n/node` / `n8n-node` CLI (strongly suggested) | done: config, CI and publish workflow come from `n8n-node new --template programmatic/openai-chat-model` v0.56.2 | same page |
| **From 1 May 2026: publish from GitHub Actions with an npm provenance statement**; local `npm publish` is not accepted for verification | `.github/workflows/publish.yml` from the starter is included (runs `npm run release` on a version tag, `id-token: write`); `@n8n/node-cli` must be >= 0.23.0 (we pin ^0.56.2) | same page; starter README and `publish.yml` comments |
| `npx @n8n/scan-community-package <name>` must pass: (1) npm provenance present, (2) attested source commit downloadable from a public GitHub repo, (3) ESLint on the source (`package.json`, `nodes/`, `credentials/`) and on the published tarball (`.js` + package.json) | step 3 run locally with the scanner's own `analyzePackage()` (v0.43.0) on the source tree and on the `npm pack` tarball: **both PASS**. Steps 1-2 can only run after the GitHub Actions release | [@n8n/scan-community-package README](https://www.npmjs.com/package/@n8n/scan-community-package) |
| Follow the UX guidelines (Title Case labels, sentence case descriptions, "Get Many", password fields for keys, boolean descriptions start with "Whether", errors say what to change) | done (lint enforces most of it) | [UX guidelines](https://docs.n8n.io/integrations/creating-nodes/build/reference/ux-guidelines/) |
| README in the npm package or public repo | done | submit page |
| Submit in the n8n **Creator Portal**; review can take up to 4 weeks; nodes that compete with n8n paid features may be rejected | owner action | submit page |
| AI sub-nodes in community packages: use `@n8n/ai-node-sdk` as a **peer** dependency and set `"aiNodeSdkVersion": 1` in the `n8n` field (no LangChain dependency) | done; same pattern as the starter template `programmatic/openai-chat-model` and the verified `n8n-nodes-manifest` package | `@n8n/ai-node-sdk` README (npm, v0.37.2); starter template |

Local end-to-end check (12 Nov 2026): the `npm pack` tarball was installed into `~/.n8n/nodes` of a throwaway n8n **2.47.4** (Node 26, sqlite) with `--legacy-peer-deps`, so `n8n-workflow` and `@n8n/ai-node-sdk` came from n8n itself. Via `n8n import:*` + `n8n execute` against a local mock gateway, all operations succeeded: chat, text to speech → transcribe (binary out and multipart in), web search, image (URL download, key not sent to the image host), model list, the Ezkielyna Chat Model under AI Agent, and both files in `examples/` (example 2 with a manual trigger and fixed memory key instead of the chat trigger; the agent called the Ezkielyna tool, which n8n exposed as `n8n-nodes-ezkielyna.ezkielynaTool`). Not exercised in n8n: the credential **Test** button and the model dropdowns in the editor UI (both use `GET /models`; covered by unit tests).

Caveats:
- n8n 2.47.4 prints: the default of `N8N_UNVERIFIED_PACKAGES_ENABLED` will change to `false`. Until the package is verified, self-hosted admins on such versions must set it to `true` to install it (README says so).
- `@n8n/ai-node-sdk` is marked **Preview: the API may change**. n8n 2.47.4 ships SDK 0.37.2, which the tests use. If n8n changes `supplyModel`, the sub-node may need an update; the main node does not depend on the SDK (it is loaded lazily inside `supplyData`).
- n8n Cloud shows only verified community nodes. Until verification, Cloud users should use the built-in OpenAI Chat Model with Base URL `https://api.ezkielyna.store/v1` (README FAQ says so).

## Owner actions

1. Read `README.md` and the two files in `examples/` once. Run the public-repo leak check again (must print CLEAN).
2. Create the public repo `EzkielynaGroup/n8n-nodes-ezkielyna`, push `main`. CI (`.github/workflows/ci.yml`) runs lint + build.
3. npm auth for the publish workflow, pick one:
   - **Trusted publisher (recommended):** npmjs.com → package settings → Trusted Publishers → GitHub Actions, owner `EzkielynaGroup`, repo `n8n-nodes-ezkielyna`, workflow `publish.yml`. Not verified here: npm may only allow this on a package that already exists; if so use the token option for the first release, then switch.
   - **Token:** create a granular npm token with publish rights, save it as repo secret `NPM_TOKEN`.
4. Release: in a clean clone run `npm ci && npm run release` (lints, builds, asks for the version, updates CHANGELOG, commits, tags, pushes). The tag triggers `publish.yml`, which publishes with provenance. package.json is at `0.1.0`; choosing `1.0.0` for the first public release is fine.
5. After the workflow finishes: `npx @n8n/scan-community-package n8n-nodes-ezkielyna` must exit 0.
6. Submit in the n8n Creator Portal (https://creators.n8n.io). Use the description above; categories in the codex files are Development, Productivity.
7. Optional live smoke test with a real key in a local n8n: Text (deepseek-v4.1-flash, max 50 tokens), Web Search (1 result), Text to Speech (one sentence, edge-tts), Transcribe (that MP3), Image (only with a Media/Auto key, 1 image ≈ $0.0083), AI Agent example. Expected total cost well under $0.05.

## What was not verified

- No call to the real gateway (no key; paid endpoints). `/v1/search` result fields follow the Ezkielyna Agent client (`title`, `url`, `snippet`, `published`), with `content` as a fallback. `/v1/models` is assumed to include `supported_endpoint_types` as New API does; when it is missing the node falls back to model-id rules.
- Voice names other than `id-ID-GadisNeural` / `id-ID-ArdiNeural`, `speed`, non-MP3 formats and image `quality`/`size` support per model were not tested live.
- Behaviour on n8n versions other than 2.47.4.
