'use strict';
// Runs the compiled Ezkielyna node against a local mock gateway (no internet, no cost).
const test = require('node:test');
const assert = require('node:assert/strict');

const { Ezkielyna } = require('../dist/nodes/Ezkielyna/Ezkielyna.node.js');
const { EzkielynaApi } = require('../dist/credentials/EzkielynaApi.credentials.js');
const { FAKE_KEY, MP3_BYTES, PNG_BYTES, createContext, startMockGateway } = require('./helpers');

let gw;
const node = new Ezkielyna();
const credentialType = new EzkielynaApi();

test.before(async () => {
	gw = await startMockGateway();
});
test.after(async () => {
	await gw.close();
});

const ctxFor = (params, extra = {}) =>
	createContext({
		params,
		credentials: { apiKey: FAKE_KEY, baseUrl: `${gw.baseUrl}/` },
		credentialType,
		...extra,
	});
const run = (params, extra) => node.execute.call(ctxFor(params, extra));

test('Text → Message a Model sends an OpenAI chat request and simplifies the reply', async () => {
	const [out] = await run({
		resource: 'text',
		operation: 'message',
		model: 'deepseek-v4.1-flash',
		prompt: 'Halo',
		simplify: true,
		options: { systemMessage: 'Jawab singkat', temperature: 0.2, maxTokens: 200 },
	});
	const req = gw.last();
	assert.equal(req.method, 'POST');
	assert.equal(req.path, '/v1/chat/completions');
	assert.equal(req.headers.authorization, `Bearer ${FAKE_KEY}`);
	assert.deepEqual(req.body, {
		model: 'deepseek-v4.1-flash',
		messages: [
			{ role: 'system', content: 'Jawab singkat' },
			{ role: 'user', content: 'Halo' },
		],
		temperature: 0.2,
		max_tokens: 200,
	});
	assert.equal(out.length, 1);
	assert.deepEqual(out[0].json, {
		text: 'echo: Halo',
		model: 'deepseek-v4.1-flash',
		finishReason: 'stop',
		usage: { promptTokens: 11, completionTokens: 7, totalTokens: 18 },
	});
	assert.deepEqual(out[0].pairedItem, { item: 0 });
});

test('Text: default max tokens is 1024, JSON mode parses the reply, raw output keeps choices', async () => {
	const [jsonOut] = await run({
		resource: 'text',
		operation: 'message',
		model: 'm',
		prompt: 'Balas JSON',
		simplify: true,
		options: { jsonOutput: true },
	});
	assert.equal(gw.last().body.max_tokens, 1024);
	assert.deepEqual(gw.last().body.response_format, { type: 'json_object' });
	assert.deepEqual(jsonOut[0].json.parsed, { produk: 'kopi', harga: 15000 });

	const [raw] = await run({ resource: 'text', operation: 'message', model: 'm', prompt: 'x', simplify: false, options: {} });
	assert.equal(raw[0].json.object, 'chat.completion');
	assert.ok(Array.isArray(raw[0].json.choices));
});

test('Text: processes every input item with its own prompt', async () => {
	const [out] = await run(
		[
			{ resource: 'text', operation: 'message', model: 'm', prompt: 'satu', simplify: true, options: {} },
			{ resource: 'text', operation: 'message', model: 'm', prompt: 'dua', simplify: true, options: {} },
		],
		{ items: [{ json: {} }, { json: {} }] },
	);
	assert.deepEqual(out.map((o) => o.json.text), ['echo: satu', 'echo: dua']);
	assert.deepEqual(out.map((o) => o.pairedItem.item), [0, 1]);
});

test('Text: an empty prompt fails before any request is made', async () => {
	const before = gw.requests.length;
	await assert.rejects(
		run({ resource: 'text', operation: 'message', model: 'm', prompt: '  ', simplify: true, options: {} }),
		/'Prompt' is empty/,
	);
	assert.equal(gw.requests.length, before);
});

test('Web Search returns one item per result, or one item with all results', async () => {
	const [split] = await run({
		resource: 'webSearch',
		operation: 'search',
		query: 'harga cabai',
		maxResults: 20,
		splitResults: true,
		options: { timeRange: 'week', language: 'id' },
	});
	assert.equal(gw.last().path, '/v1/search');
	assert.deepEqual(gw.last().body, { query: 'harga cabai', max_results: 10, time_range: 'week', language: 'id' });
	assert.equal(split.length, 2);
	assert.deepEqual(split[0].json, {
		query: 'harga cabai',
		position: 1,
		title: 'Harga cabai',
		url: 'https://example.com/a',
		snippet: 'Rp50.000/kg',
		published: '2026-11-10',
	});
	assert.equal(split[1].json.snippet, 'Naik 5%');

	const [joined] = await run({
		resource: 'webSearch',
		operation: 'search',
		query: 'harga cabai',
		maxResults: 5,
		splitResults: false,
		options: {},
	});
	assert.equal(joined.length, 1);
	assert.equal(joined[0].json.results.length, 2);
	assert.equal(joined[0].json.cached, false);
	assert.equal(joined[0].json.tookMs, 321);
});

test('Web Search rejects an empty or too long query', async () => {
	const base = { resource: 'webSearch', operation: 'search', maxResults: 5, splitResults: true, options: {} };
	await assert.rejects(run({ ...base, query: '' }), /1 to 400 characters/);
	await assert.rejects(run({ ...base, query: 'a'.repeat(401) }), /1 to 400 characters/);
});

test('Audio → Text to Speech returns the audio as binary with the Indonesian default voice', async () => {
	const [out] = await run(
		{
			resource: 'audio',
			operation: 'textToSpeech',
			model: 'edge-tts',
			text: 'Pesanan kamu sudah dikirim',
			voice: 'id-ID-GadisNeural',
			binaryPropertyName: 'audio',
			options: { fileName: 'notif' },
		},
		{ items: [{ json: { order: 7 } }] },
	);
	assert.equal(gw.last().path, '/v1/audio/speech');
	assert.deepEqual(gw.last().body, {
		model: 'edge-tts',
		input: 'Pesanan kamu sudah dikirim',
		voice: 'id-ID-GadisNeural',
		response_format: 'mp3',
	});
	const item = out[0];
	assert.deepEqual(item.json, { model: 'edge-tts', voice: 'id-ID-GadisNeural', format: 'mp3', characters: 26, bytes: MP3_BYTES.length });
	assert.equal(item.binary.audio.fileName, 'notif.mp3');
	assert.equal(item.binary.audio.mimeType, 'audio/mpeg');
	assert.deepEqual(Buffer.from(item.binary.audio.data, 'base64'), MP3_BYTES);
});

test('Text to Speech refuses text over 4096 characters', async () => {
	await assert.rejects(
		run({ resource: 'audio', operation: 'textToSpeech', model: 'edge-tts', text: 'a'.repeat(4097), voice: 'v', binaryPropertyName: 'data', options: {} }),
		/longer than 4096/,
	);
});

test('Audio → Transcribe uploads the binary file as multipart and returns the text', async () => {
	const audio = Buffer.from('fake-audio-bytes\r\n--not-a-boundary');
	const items = [{ json: {}, binary: { data: { data: audio.toString('base64'), mimeType: 'audio/mpeg', fileName: 'rekaman.mp3' } } }];
	const [out] = await run(
		{ resource: 'audio', operation: 'transcribe', model: 'whisper-large-v3', binaryPropertyName: 'data', options: { language: 'id', prompt: 'Kopi Gayo' } },
		{ items },
	);
	const req = gw.last();
	assert.equal(req.path, '/v1/audio/transcriptions');
	assert.match(req.headers['content-type'], /^multipart\/form-data; boundary=/);
	assert.equal(req.multipart.model, 'whisper-large-v3');
	assert.equal(req.multipart.language, 'id');
	assert.equal(req.multipart.prompt, 'Kopi Gayo');
	assert.equal(req.multipart.response_format, 'json');
	assert.equal(req.multipart.file.fileName, 'rekaman.mp3');
	assert.deepEqual(req.multipart.file.data, audio);
	assert.deepEqual(out[0].json, { text: 'halo dunia', language: 'id', duration: 1.5, model: 'whisper-large-v3', format: 'json' });

	const [srt] = await run(
		{ resource: 'audio', operation: 'transcribe', model: 'whisper-large-v3', binaryPropertyName: 'data', options: { format: 'srt' } },
		{ items },
	);
	assert.match(srt[0].json.text, /00:00:00,000 --> 00:00:01,000/);
});

test('Transcribe fails clearly when the binary field is missing', async () => {
	await assert.rejects(
		run({ resource: 'audio', operation: 'transcribe', model: 'whisper-large-v3', binaryPropertyName: 'data', options: {} }),
		/no binary field 'data'/,
	);
});

test('Image → Generate turns base64 images into binary items', async () => {
	const [out] = await run({
		resource: 'image',
		operation: 'generate',
		model: 'gpt-image-2',
		prompt: 'Foto kopi susu',
		binaryPropertyName: 'data',
		options: { n: 2, size: '1024x1024', responseFormat: 'b64_json' },
	});
	assert.deepEqual(gw.last().body, {
		model: 'gpt-image-2',
		prompt: 'Foto kopi susu',
		n: 2,
		size: '1024x1024',
		response_format: 'b64_json',
	});
	assert.equal(out.length, 2);
	assert.equal(out[1].json.index, 1);
	assert.equal(out[0].json.revisedPrompt, 'kopi');
	assert.equal(out[0].binary.data.mimeType, 'image/png');
	assert.equal(out[1].binary.data.fileName, 'image-2.png');
	assert.deepEqual(Buffer.from(out[0].binary.data.data, 'base64'), PNG_BYTES);
});

test('Image: a URL reply is downloaded, or passed through when download is off', async () => {
	const base = { resource: 'image', operation: 'generate', model: 'url-model', prompt: 'p', binaryPropertyName: 'img' };
	const [dl] = await run({ ...base, options: {} });
	assert.equal(gw.last().path, '/files/img.png');
	assert.equal(gw.last().headers.authorization, undefined, 'the key must not be sent to the image host');
	assert.equal(dl[0].binary.img.fileName, 'image.png');
	assert.match(dl[0].json.url, /\/files\/img\.png$/);

	const [noDl] = await run({ ...base, options: { download: false } });
	assert.equal(noDl[0].binary, undefined);
	assert.match(noDl[0].json.url, /\/files\/img\.png$/);

	await assert.rejects(run({ ...base, model: 'no-image', options: {} }), /returned no image/);
});

test('Model → Get Many filters by type, hides blocked models, applies the limit', async () => {
	const [all] = await run({ resource: 'model', operation: 'getAll', kind: 'all', returnAll: true });
	assert.equal(gw.last().method, 'GET');
	assert.equal(gw.last().path, '/v1/models');
	const ids = all.map((o) => o.json.id);
	assert.equal(ids.some((id) => /uncensored|abliterated|nsfw/i.test(id)), false);
	assert.equal(new Set(ids).size, ids.length);
	assert.deepEqual(all.find((o) => o.json.id === 'edge-tts').json, {
		id: 'edge-tts',
		kind: 'speech',
		ownedBy: 'custom',
		endpointTypes: ['openai', 'openai-audio'],
	});

	const [chat] = await run({ resource: 'model', operation: 'getAll', kind: 'chat', returnAll: true });
	assert.deepEqual(chat.map((o) => o.json.id), ['deepseek-v4.1-flash', 'glm-4.5']);

	const [limited] = await run({ resource: 'model', operation: 'getAll', kind: 'all', returnAll: false, limit: 2 });
	assert.equal(limited.length, 2);
});

test('Model dropdowns only list models of the right type', async () => {
	const ctx = ctxFor({});
	const lo = node.methods.loadOptions;
	assert.deepEqual((await lo.getChatModels.call(ctx)).map((o) => o.value), ['deepseek-v4.1-flash', 'glm-4.5']);
	assert.deepEqual((await lo.getSpeechModels.call(ctx)).map((o) => o.value), ['edge-tts']);
	assert.deepEqual((await lo.getTranscriptionModels.call(ctx)).map((o) => o.value), ['whisper-large-v3']);
	assert.deepEqual((await lo.getImageModels.call(ctx)).map((o) => o.value), ['gpt-image-2']);
});

test('API errors become NodeApiError with an actionable hint', async () => {
	const params = { resource: 'text', operation: 'message', model: 'm', prompt: 'x', simplify: true, options: {} };
	const wrongKey = createContext({
		params,
		credentials: { apiKey: 'sk-wrong', baseUrl: gw.baseUrl },
		credentialType,
	});
	await assert.rejects(node.execute.call(wrongKey), (err) => {
		assert.equal(err.constructor.name, 'NodeApiError');
		assert.equal(String(err.httpCode), '401');
		assert.match(err.description, /API key was not accepted/);
		return true;
	});
	await assert.rejects(run({ ...params, model: 'empty-balance' }), (err) => /Top up/.test(err.description));
	await assert.rejects(run({ ...params, model: 'busy-model' }), (err) => String(err.httpCode) === '503');
});

test('Continue On Fail returns the error as an item and keeps going', async () => {
	const [out] = await run(
		[
			{ resource: 'text', operation: 'message', model: 'busy-model', prompt: 'x', simplify: true, options: {} },
			{ resource: 'text', operation: 'message', model: 'm', prompt: 'ok', simplify: true, options: {} },
		],
		{ items: [{ json: {} }, { json: {} }], continueOnFail: true },
	);
	assert.equal(out.length, 2);
	assert.ok(out[0].json.error);
	assert.deepEqual(out[0].pairedItem, { item: 0 });
	assert.equal(out[1].json.text, 'echo: ok');
});

test('Credential: Bearer header, GET /models test, password field, default base URL', () => {
	assert.equal(credentialType.name, 'ezkielynaApi');
	assert.deepEqual(credentialType.authenticate, {
		type: 'generic',
		properties: { headers: { Authorization: '=Bearer {{$credentials.apiKey}}' } },
	});
	assert.equal(credentialType.test.request.url, '/models');
	assert.equal(credentialType.test.request.method, 'GET');
	const key = credentialType.properties.find((p) => p.name === 'apiKey');
	assert.equal(key.typeOptions.password, true);
	const base = credentialType.properties.find((p) => p.name === 'baseUrl');
	assert.equal(base.default, 'https://api.ezkielyna.store/v1');
	// the test request base URL expression strips trailing slashes
	const expr = credentialType.test.request.baseURL.slice(3, -2);
	const fn = new Function('$credentials', `return ${expr}`);
	assert.equal(fn({ baseUrl: 'https://api.ezkielyna.store/v1/' }), 'https://api.ezkielyna.store/v1');
});
