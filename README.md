# n8n-nodes-ezkielyna

n8n community nodes for the [Ezkielyna AI API](https://ezkielyna.store/?utm_source=github&utm_medium=readme&utm_campaign=n8n-nodes-ezkielyna): chat with DeepSeek, GLM, Qwen, Kimi, Claude, GPT and other models, search the web, turn text into Indonesian speech, transcribe recordings and generate images, plus a chat model for the n8n **AI Agent**. One credential, one API key, pay from $0.5 with QRIS.

> Bahasa Indonesia: lihat [bagian di bawah](#bahasa-indonesia).

Ezkielyna is an independent AI API gateway (OpenAI-compatible) for Indonesian developers. It is not affiliated with the model vendors.

**Contents:** [Install](#install) · [Credentials](#credentials) · [Operations](#operations) · [Ezkielyna Chat Model (AI Agent)](#ezkielyna-chat-model-ai-agent) · [Example workflows](#example-workflows) · [Costs and limits](#costs-and-limits) · [FAQ](#faq) · [Development](#development) · [Bahasa Indonesia](#bahasa-indonesia)

## Install

Self-hosted n8n (owner or admin account):

1. Open **Settings → Community Nodes → Install**.
2. Enter `n8n-nodes-ezkielyna`, tick the risk notice, click **Install**.
3. Search for **Ezkielyna** in the node panel.

n8n 2.47 warns that the default of `N8N_UNVERIFIED_PACKAGES_ENABLED` will change to `false`. Until this package is verified by n8n, admins on such a version must set `N8N_UNVERIFIED_PACKAGES_ENABLED=true` to install it.

n8n Cloud: community nodes can be installed only after the package is verified by n8n. Until then, use the [OpenAI Chat Model with a custom Base URL](#can-i-use-ezkielyna-in-n8n-without-installing-a-community-node) instead.

Manual install (Docker or queue mode): run `npm install n8n-nodes-ezkielyna` in `~/.n8n/nodes` and restart n8n. See the [n8n guide](https://docs.n8n.io/integrations/community-nodes/installation/).

Requirements: a 2026 n8n release for the **Ezkielyna Chat Model** sub-node (it uses n8n's AI node SDK, tested with n8n 2.47.4). The main **Ezkielyna** node does not need the SDK; it was tested on n8n 2.47.4 only.

## Credentials

1. Buy API Credit at [ezkielyna.store/beli-api-key](https://ezkielyna.store/beli-api-key?utm_source=github&utm_medium=readme&utm_campaign=n8n-nodes-ezkielyna) (from $0.5; QRIS, DANA, GoPay or USDT) and redeem it under **Wallet** at [api.ezkielyna.store](https://api.ezkielyna.store/?utm_source=github&utm_medium=readme&utm_campaign=n8n-nodes-ezkielyna).
2. Create a key under **API Keys**. The key group decides which models the key can use:

   | Group | Models | Use it for |
   |---|---|---|
   | Standard | DeepSeek, GLM, Kimi K2, MiniMax, Qwen, MiMo and other text models; audio models such as `edge-tts` and `whisper-large-v3` | Chat, search, text to speech, transcription |
   | Premium (1.5x) | Claude, GPT, Grok, Gemini Pro and others; audio models | Chat with those models |
   | Media | Image and video models (GPT Image, Nano Banana, Flux, Imagen...) | Image generation |
   | Auto | Everything above | One key for every operation |

3. In n8n: **Credentials → Add credential → Ezkielyna API**. Paste the key (`sk-...`). Leave **Base URL** at `https://api.ezkielyna.store/v1`. Click **Save**: n8n tests the key with `GET /v1/models`.

## Operations

Node **Ezkielyna** (resources and operations):

| Resource | Operation | Endpoint | Output |
|---|---|---|---|
| Text | Message a Model | `POST /v1/chat/completions` | `text`, `model`, `finishReason`, `usage` (or the raw response with **Simplify Output** off) |
| Web Search | Search | `POST /v1/search` | One item per result: `position`, `title`, `url`, `snippet`, `published` (or one item with `results`) |
| Audio | Text to Speech | `POST /v1/audio/speech` | Audio file in a binary field (default `data`) |
| Audio | Transcribe | `POST /v1/audio/transcriptions` (multipart) | `text` (or SRT/VTT subtitles), `language`, `duration` |
| Image | Generate | `POST /v1/images/generations` | One item per image with the file in a binary field; `url` when the model returns a link |
| Model | Get Many | `GET /v1/models` | `id`, `kind` (chat, speech, transcription, image, video, embedding), `endpointTypes` |

Details:

- **Message a Model:** model dropdown loaded from your key (default `deepseek-v4.1-flash`), **Prompt**, and options **System Message**, **Sampling Temperature** (default 0.7), **Maximum Number of Tokens** (default 1024) and **JSON Output** (sends `response_format: json_object` and returns the parsed object in `parsed`; mention JSON in the prompt). Models that think out loud return their reasoning in `reasoning`.
- **Search:** query 1 to 400 characters, 1 to 10 results, optional time range (day, week, month, year) and language code (`id`, `en`).
- **Text to Speech:** default model `edge-tts`, default voice `id-ID-GadisNeural` (female; `id-ID-ArdiNeural` is male). Up to 4,096 characters per item. Formats MP3 (default), WAV, Opus, AAC, FLAC, as far as the model supports them.
- **Transcribe:** reads the audio file from a binary field (from Telegram, HTTP Request, Google Drive, Read Binary File...), max 25 MB. Default model `whisper-large-v3`. Options: language (`id` for Indonesian; empty = auto-detect), a prompt with names to spell, output as text, SRT or VTT.
- **Generate (image):** default model `gpt-image-2` (Media or Auto key). Options: number of images (1-4, each billed), size (`1024x1024`...), quality, file or link. Links are downloaded into a binary field unless **Download Image** is off; your API key is never sent to the image host.
- **Get Many (models):** filter by type, **Return All** or a limit.

The node can also be used as a **tool** by the AI Agent (n8n shows it as *Ezkielyna Tool*), for example to let an agent search the web.

Model lists never show models whose id contains `uncensored`, `abliterated` or `nsfw`.

## Ezkielyna Chat Model (AI Agent)

A sub-node that plugs into **AI Agent**, **Basic LLM Chain**, **Question and Answer Chain**, **Summarization Chain** and other nodes with a *Chat Model* input. Pick the model from the dropdown (default `deepseek-v4.1-flash`). Options: temperature, maximum number of tokens (default 1024, `-1` = model default), top P, frequency and presence penalty, timeout, max retries.

It is built on n8n's `@n8n/ai-node-sdk`, which n8n ships with its 2026 releases, so the package has no runtime dependencies. On an older n8n the sub-node shows an error asking you to update; the main node keeps working.

For agents with tools, choose a model that supports tool calling (for example `deepseek-v4.1-flash`) and test it once in the chat panel.

## Example workflows

Import from **Workflows → Create workflow → ⋯ → Import from File**:

- [`examples/01-berita-jadi-suara.json`](examples/01-berita-jadi-suara.json): Manual Trigger → **Web Search** (today's news) → **Message a Model** (3-sentence summary in Indonesian) → **Text to Speech** (MP3, `id-ID-GadisNeural`).
- [`examples/02-agen-ai-pencarian-web.json`](examples/02-agen-ai-pencarian-web.json): Chat Trigger → **AI Agent** with **Ezkielyna Chat Model**, **Simple Memory** and the Ezkielyna node as a web search tool.

After importing, select your **Ezkielyna API** credential in each Ezkielyna node. More Indonesian workflows: [EzkielynaGroup/n8n-workflows-indonesia](https://github.com/EzkielynaGroup/n8n-workflows-indonesia).

## Costs and limits

Every call is billed to your Ezkielyna balance. Public list prices on 11 Nov 2026 ([live price list](https://ezkielyna.store/models?utm_source=github&utm_medium=readme&utm_campaign=n8n-nodes-ezkielyna)):

| Model | Price |
|---|---|
| `deepseek-v4.1-flash` | $0.04 per 1M input tokens, $0.16 per 1M output tokens |
| `edge-tts` | $1.00 per 1M tokens |
| `whisper-large-v3` | $12.00 per 1M tokens |
| `gpt-image-2` | $0.0083 per image |

Prices change; the price list and **Usage Logs** at api.ezkielyna.store are the source of truth. Safety defaults in the nodes: max 1024 tokens per chat reply, 4,096 characters per speech item, 25 MB per audio file, 4 images per item. While building a workflow, **pin** the output of a node that already worked so test runs do not call the API again.

## FAQ

### How do I use DeepSeek in n8n?
Install `n8n-nodes-ezkielyna`, create an **Ezkielyna API** credential with a Standard or Auto key, and use **Ezkielyna → Text → Message a Model** with `deepseek-v4.1-flash` (or the **Ezkielyna Chat Model** under an AI Agent).

### Can I use Ezkielyna in n8n without installing a community node?
Yes. In the built-in **OpenAI Chat Model** node, create an OpenAI credential with your Ezkielyna key and Base URL `https://api.ezkielyna.store/v1`, then type the model ID (for example `deepseek-v4.1-flash`). The HTTP Request node also works with header `Authorization: Bearer sk-...`.

### How do I turn text into Indonesian speech in n8n?
Use **Ezkielyna → Audio → Text to Speech** with model `edge-tts` and voice `id-ID-GadisNeural` (or `id-ID-ArdiNeural`). The MP3 lands in the `data` binary field, ready for Telegram, WhatsApp or Google Drive nodes.

### How do I transcribe a Telegram voice note in n8n?
Telegram Trigger → Telegram (**Get a File**, download on) → **Ezkielyna → Audio → Transcribe** with language `id`. The text is in the `text` field.

### Which key group do I need?
Standard covers chat with text models, web search, text to speech and transcription. Image generation needs Media. An Auto key works for every operation.

### Is my API key safe?
n8n stores it encrypted as a credential. The node only sends it to the Base URL in the credential, never to image download links, and never writes it to the output.

## Development

```bash
npm install
npm run build       # n8n-node build → dist/
npm run lint        # n8n community node linter
npm test            # build + node --test test/ (local mock gateway, no internet, no cost)
npm run dev         # n8n with this package loaded, hot reload
```

Tests cover request building and response mapping for every operation, binary in/out, multipart upload, errors and Continue On Fail, the credential, and the AI sub-node through the real n8n AI node SDK, all against a local mock server. The packed tarball was also installed as a community package in a local n8n 2.47.4 and both example workflows ran end to end against the same mock (including an AI Agent tool call to Web Search).

## License

[MIT](LICENSE) © 2026 Ezekiel Lieberhart (Ezkielyna). Model names belong to their owners.

---

## Bahasa Indonesia

Node komunitas n8n untuk [Ezkielyna AI API](https://ezkielyna.store/?utm_source=github&utm_medium=readme&utm_campaign=n8n-nodes-ezkielyna): chat dengan DeepSeek, GLM, Qwen, Kimi, Claude, GPT dan model lain, cari di web, ubah teks jadi suara Bahasa Indonesia, transkrip rekaman, buat gambar, plus chat model untuk node **AI Agent** n8n. Satu credential, satu API key, isi saldo mulai $0.5 lewat QRIS.

Ezkielyna adalah gateway API AI independen (kompatibel OpenAI) untuk developer Indonesia, tidak berafiliasi dengan pembuat model.

### Instalasi

n8n self-hosted (akun owner atau admin):

1. Buka **Settings → Community Nodes → Install**.
2. Isi `n8n-nodes-ezkielyna`, centang pernyataan risiko, klik **Install**.
3. Cari **Ezkielyna** di panel node.

n8n 2.47 memberi peringatan bahwa default `N8N_UNVERIFIED_PACKAGES_ENABLED` akan berubah menjadi `false`. Selama paket ini belum diverifikasi n8n, admin di versi tersebut perlu mengisi `N8N_UNVERIFIED_PACKAGES_ENABLED=true` agar bisa memasangnya.

n8n Cloud: node komunitas baru bisa dipasang setelah paket diverifikasi n8n. Sementara itu, pakai node **OpenAI Chat Model** dengan Base URL kustom (lihat FAQ).

Pasang manual (Docker atau queue mode): jalankan `npm install n8n-nodes-ezkielyna` di folder `~/.n8n/nodes`, lalu restart n8n.

Syarat: sub-node **Ezkielyna Chat Model** butuh n8n rilis 2026 (memakai AI node SDK n8n; diuji dengan n8n 2.47.4). Node utama **Ezkielyna** tidak butuh SDK itu; baru diuji di n8n 2.47.4.

### Credential

1. Beli API Credit di [ezkielyna.store/beli-api-key](https://ezkielyna.store/beli-api-key?utm_source=github&utm_medium=readme&utm_campaign=n8n-nodes-ezkielyna) (mulai $0.5; QRIS, DANA, GoPay, atau USDT), lalu tukarkan di menu **Wallet** di [api.ezkielyna.store](https://api.ezkielyna.store/?utm_source=github&utm_medium=readme&utm_campaign=n8n-nodes-ezkielyna).
2. Buat key di menu **API Keys**. Grup key menentukan model yang bisa dipakai:

   | Grup | Model | Untuk |
   |---|---|---|
   | Standard | DeepSeek, GLM, Kimi K2, MiniMax, Qwen, MiMo dan model teks lain; model audio seperti `edge-tts` dan `whisper-large-v3` | Chat, pencarian web, teks ke suara, transkripsi |
   | Premium (1,5x) | Claude, GPT, Grok, Gemini Pro dan lainnya; model audio | Chat dengan model tersebut |
   | Media | Model gambar dan video (GPT Image, Nano Banana, Flux, Imagen...) | Membuat gambar |
   | Auto | Semua di atas | Satu key untuk semua operasi |

3. Di n8n: **Credentials → Add credential → Ezkielyna API**. Tempel key (`sk-...`). Biarkan **Base URL** `https://api.ezkielyna.store/v1`. Klik **Save**: n8n menguji key lewat `GET /v1/models`.

### Operasi

| Resource | Operasi | Hasil |
|---|---|---|
| Text | Message a Model | `text`, `model`, `finishReason`, `usage` (atau respons mentah kalau **Simplify Output** dimatikan) |
| Web Search | Search | Satu item per hasil: `position`, `title`, `url`, `snippet`, `published` (atau satu item berisi `results`) |
| Audio | Text to Speech | File audio di field biner (default `data`) |
| Audio | Transcribe | `text` (atau subtitle SRT/VTT), `language`, `duration` |
| Image | Generate | Satu item per gambar, file di field biner; `url` kalau model mengirim tautan |
| Model | Get Many | `id`, `kind` (chat, speech, transcription, image, video, embedding), `endpointTypes` |

- **Message a Model:** daftar model diambil dari key kamu (default `deepseek-v4.1-flash`), **Prompt**, dan opsi **System Message**, **Sampling Temperature** (default 0,7), **Maximum Number of Tokens** (default 1024), **JSON Output** (hasil JSON yang sudah di-parse ada di field `parsed`; sebut "JSON" di prompt).
- **Search:** kata kunci 1-400 karakter, 1-10 hasil, opsi rentang waktu (hari, minggu, bulan, tahun) dan kode bahasa (`id`, `en`).
- **Text to Speech:** model default `edge-tts`, suara default `id-ID-GadisNeural` (perempuan; `id-ID-ArdiNeural` laki-laki). Maksimal 4.096 karakter per item. Format MP3 (default), WAV, Opus, AAC, FLAC sejauh didukung model.
- **Transcribe:** membaca file audio dari field biner (dari Telegram, HTTP Request, Google Drive...), maksimal 25 MB. Model default `whisper-large-v3`. Opsi: bahasa (`id`; kosong = deteksi otomatis), prompt berisi nama/istilah agar ejaannya benar, hasil teks, SRT, atau VTT.
- **Generate (gambar):** model default `gpt-image-2` (key Media atau Auto). Opsi: jumlah gambar (1-4, masing-masing ditagih), ukuran, kualitas, file atau tautan. Tautan otomatis diunduh ke field biner kecuali **Download Image** dimatikan; API key tidak pernah dikirim ke host gambar.
- **Get Many (model):** filter per jenis, **Return All** atau batas jumlah.

Node ini juga bisa dipakai sebagai **tool** oleh AI Agent (muncul sebagai *Ezkielyna Tool*), misalnya agar agen bisa mencari di web.

Daftar model tidak pernah menampilkan model yang id-nya mengandung `uncensored`, `abliterated`, atau `nsfw`.

### Ezkielyna Chat Model (AI Agent)

Sub-node untuk **AI Agent**, **Basic LLM Chain**, **Question and Answer Chain**, **Summarization Chain** dan node lain yang punya input *Chat Model*. Pilih model dari daftar (default `deepseek-v4.1-flash`). Opsi: temperature, batas token (default 1024, `-1` = default model), top P, frequency/presence penalty, timeout, jumlah retry. Dibangun di atas `@n8n/ai-node-sdk` bawaan n8n rilis 2026, jadi paket ini tanpa dependensi runtime. Untuk agen yang memakai tool, pilih model yang mendukung tool calling (misalnya `deepseek-v4.1-flash`) dan coba sekali di panel chat.

### Contoh workflow

Impor lewat **Workflows → Create workflow → ⋯ → Import from File**:

- [`examples/01-berita-jadi-suara.json`](examples/01-berita-jadi-suara.json): cari berita hari ini → ringkas 3 kalimat → jadi MP3 suara Bahasa Indonesia.
- [`examples/02-agen-ai-pencarian-web.json`](examples/02-agen-ai-pencarian-web.json): chat dengan AI Agent yang memakai Ezkielyna Chat Model, Simple Memory, dan node Ezkielyna sebagai tool pencarian web.

Setelah impor, pilih credential **Ezkielyna API** di setiap node Ezkielyna. Workflow Indonesia lainnya: [EzkielynaGroup/n8n-workflows-indonesia](https://github.com/EzkielynaGroup/n8n-workflows-indonesia).

### Biaya dan batas

Setiap panggilan memotong saldo Ezkielyna. Harga daftar publik per 11 November 2026: `deepseek-v4.1-flash` $0,04 per 1 juta token input dan $0,16 per 1 juta token output; `edge-tts` $1 per 1 juta token; `whisper-large-v3` $12 per 1 juta token; `gpt-image-2` $0,0083 per gambar. Harga bisa berubah; cek [daftar harga live](https://ezkielyna.store/models?utm_source=github&utm_medium=readme&utm_campaign=n8n-nodes-ezkielyna) dan **Usage Logs** di api.ezkielyna.store. Saat menyusun workflow, **pin** output node yang sudah berhasil supaya uji coba tidak memanggil API berulang kali.

### FAQ

**Bagaimana cara pakai DeepSeek di n8n?**
Pasang `n8n-nodes-ezkielyna`, buat credential **Ezkielyna API** dengan key Standard atau Auto, lalu pakai **Ezkielyna → Text → Message a Model** dengan `deepseek-v4.1-flash` (atau **Ezkielyna Chat Model** di bawah AI Agent).

**Bisa pakai Ezkielyna di n8n tanpa memasang node komunitas?**
Bisa. Di node bawaan **OpenAI Chat Model**, buat credential OpenAI berisi key Ezkielyna dan Base URL `https://api.ezkielyna.store/v1`, lalu ketik ID model (misalnya `deepseek-v4.1-flash`). Node HTTP Request juga bisa dengan header `Authorization: Bearer sk-...`.

**Bagaimana cara membuat suara Bahasa Indonesia (text to speech) di n8n?**
Pakai **Ezkielyna → Audio → Text to Speech** dengan model `edge-tts` dan suara `id-ID-GadisNeural` (atau `id-ID-ArdiNeural`). File MP3 ada di field biner `data`, siap dikirim lewat node Telegram, WhatsApp, atau Google Drive.

**Bagaimana cara mengubah voice note Telegram jadi teks di n8n?**
Telegram Trigger → Telegram (**Get a File**, download aktif) → **Ezkielyna → Audio → Transcribe** dengan bahasa `id`. Teksnya ada di field `text`.

**Grup key mana yang saya perlukan?**
Standard cukup untuk chat model teks, pencarian web, teks ke suara, dan transkripsi. Membuat gambar butuh Media. Key Auto bisa untuk semua operasi.

**Apakah API key saya aman?**
n8n menyimpannya terenkripsi sebagai credential. Node hanya mengirim key ke Base URL di credential, tidak ke tautan unduhan gambar, dan tidak pernah menuliskannya ke output.

### Lisensi

[MIT](LICENSE) © 2026 Ezekiel Lieberhart (Ezkielyna).
