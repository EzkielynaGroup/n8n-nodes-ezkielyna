'use strict';
// Pure request-building and response-mapping helpers (no HTTP).
const test = require('node:test');
const assert = require('node:assert/strict');

const g = require('../dist/nodes/Ezkielyna/GenericFunctions.js');
const { parseMultipart } = require('./helpers');

test('normalizeBaseUrl trims slashes and falls back to the public base URL', () => {
	assert.equal(g.normalizeBaseUrl('https://api.ezkielyna.store/v1/'), 'https://api.ezkielyna.store/v1');
	assert.equal(g.normalizeBaseUrl('  http://127.0.0.1:9/v1//  '), 'http://127.0.0.1:9/v1');
	assert.equal(g.normalizeBaseUrl(''), 'https://api.ezkielyna.store/v1');
	assert.equal(g.normalizeBaseUrl(undefined), 'https://api.ezkielyna.store/v1');
});

test('blocked model ids are recognised case-insensitively', () => {
	for (const id of ['x-uncensored', 'Qwen-Abliterated-7b', 'some-NSFW']) assert.equal(g.isBlockedModel(id), true, id);
	for (const id of ['deepseek-v4.1-flash', 'edge-tts', 'gpt-image-2']) assert.equal(g.isBlockedModel(id), false, id);
});

test('modelKind uses endpoint types first, then the id', () => {
	const k = (id, types) => g.modelKind({ id, supported_endpoint_types: types });
	assert.equal(k('deepseek-v4.1-flash', ['openai', 'anthropic']), 'chat');
	assert.equal(k('edge-tts', ['openai', 'openai-audio']), 'speech');
	assert.equal(k('whisper-large-v3', ['openai', 'openai-audio']), 'transcription');
	assert.equal(k('stt-xai-v1', ['openai-audio']), 'transcription');
	assert.equal(k('gpt-image-2', ['image-generation', 'openai']), 'image');
	assert.equal(k('wan-3.0-720p', ['openai-video']), 'video');
	assert.equal(k('emb', ['embeddings']), 'embedding');
	// fallback when the gateway does not send endpoint types
	assert.equal(k('tts-kokoro'), 'speech');
	assert.equal(k('whisper-1'), 'transcription');
	assert.equal(k('flux-3-image-klein'), 'image');
	assert.equal(k('doubao-seedance-2.0'), 'video');
	assert.equal(k('text-embedding-3-small'), 'embedding');
	assert.equal(k('glm-4.5'), 'chat');
});

test('parseModelList drops blocked ids and duplicates, sorts, tolerates bad input', () => {
	const list = g.parseModelList({
		data: [{ id: 'b' }, { id: 'a-uncensored' }, { id: 'a' }, { id: 'b' }, { foo: 1 }, { id: 'c-nsfw' }],
	});
	assert.deepEqual(list.map((m) => m.id), ['a', 'b']);
	assert.deepEqual(g.parseModelList(null), []);
	assert.deepEqual(g.parseModelList({ data: 'x' }), []);
	assert.deepEqual(g.toModelOptions([{ id: 'a' }]), [{ name: 'a', value: 'a' }]);
});

test('buildChatBody adds system message, temperature, max_tokens and JSON mode only when set', () => {
	assert.deepEqual(g.buildChatBody({ model: 'm', prompt: 'hai' }), {
		model: 'm',
		messages: [{ role: 'user', content: 'hai' }],
	});
	assert.deepEqual(
		g.buildChatBody({ model: 'm', prompt: 'hai', systemMessage: 'Kamu CS', temperature: 0, maxTokens: 300.7, jsonOutput: true }),
		{
			model: 'm',
			messages: [
				{ role: 'system', content: 'Kamu CS' },
				{ role: 'user', content: 'hai' },
			],
			temperature: 0,
			max_tokens: 300,
			response_format: { type: 'json_object' },
		},
	);
	assert.equal(g.buildChatBody({ model: 'm', prompt: 'x', systemMessage: '   ', maxTokens: 0 }).messages.length, 1);
	assert.equal('max_tokens' in g.buildChatBody({ model: 'm', prompt: 'x', maxTokens: 0 }), false);
});

test('mapChatResponse simplifies, joins content parts, parses fenced JSON, keeps reasoning', () => {
	const r = g.mapChatResponse({
		model: 'm',
		choices: [{ finish_reason: 'stop', message: { content: [{ type: 'text', text: 'a' }, 'b'], reasoning_content: 'r' } }],
		usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
	});
	assert.deepEqual(r, {
		text: 'ab',
		model: 'm',
		finishReason: 'stop',
		usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
		reasoning: 'r',
	});
	const j = g.mapChatResponse({ choices: [{ message: { content: '```json\n{"a":1}\n```' } }] }, true);
	assert.deepEqual(j.parsed, { a: 1 });
	const notJson = g.mapChatResponse({ choices: [{ message: { content: 'bukan json' } }] }, true);
	assert.equal(notJson.parsed, undefined);
	assert.equal(notJson.text, 'bukan json');
	assert.equal(g.mapChatResponse({}).text, '');
});

test('buildSearchBody clamps max_results and only sends valid options', () => {
	assert.deepEqual(g.buildSearchBody({ query: '  harga emas  ' }), { query: 'harga emas', max_results: 5 });
	assert.equal(g.buildSearchBody({ query: 'x', maxResults: 50 }).max_results, 10);
	assert.equal(g.buildSearchBody({ query: 'x', maxResults: 0 }).max_results, 1);
	assert.deepEqual(g.buildSearchBody({ query: 'x', maxResults: 3, timeRange: 'week', language: ' id ' }), {
		query: 'x',
		max_results: 3,
		time_range: 'week',
		language: 'id',
	});
	assert.equal('time_range' in g.buildSearchBody({ query: 'x', timeRange: 'decade' }), false);
});

test('mapSearchResults numbers results and falls back from snippet to content', () => {
	const out = g.mapSearchResults({
		results: [
			{ title: 'A', url: 'https://a', snippet: 's', published: '2026-11-01' },
			{ title: 'B', url: 'https://b', content: 'c' },
			{},
		],
	});
	assert.deepEqual(out[0], { position: 1, title: 'A', url: 'https://a', snippet: 's', published: '2026-11-01' });
	assert.deepEqual(out[1], { position: 2, title: 'B', url: 'https://b', snippet: 'c' });
	assert.deepEqual(out[2], { position: 3, title: '', url: '', snippet: '' });
	assert.deepEqual(g.mapSearchResults({}), []);
});

test('buildSpeechBody and audioMimeType', () => {
	assert.deepEqual(g.buildSpeechBody({ model: 'edge-tts', text: 'halo', voice: 'v', format: 'mp3' }), {
		model: 'edge-tts',
		input: 'halo',
		voice: 'v',
		response_format: 'mp3',
	});
	assert.equal(g.buildSpeechBody({ model: 'm', text: 't', voice: 'v', format: 'wav', speed: 1.25 }).speed, 1.25);
	assert.equal(g.audioMimeType('mp3'), 'audio/mpeg');
	assert.equal(g.audioMimeType('wav'), 'audio/wav');
	assert.equal(g.audioMimeType('weird'), 'application/octet-stream');
});

test('buildMultipart produces a body a multipart parser can read back', () => {
	const file = Buffer.from([0, 1, 2, 3, 13, 10, 255]);
	const { body, contentType } = g.buildMultipart(
		{ model: 'whisper-large-v3', language: 'id', prompt: undefined, empty: '' },
		{ fieldName: 'file', fileName: 'rekaman "1".mp3', mimeType: 'audio/mpeg', data: file },
		'testboundary',
	);
	assert.equal(contentType, 'multipart/form-data; boundary=testboundary');
	const parts = parseMultipart(body, contentType);
	assert.equal(parts.model, 'whisper-large-v3');
	assert.equal(parts.language, 'id');
	assert.equal('prompt' in parts, false);
	assert.equal('empty' in parts, false);
	assert.equal(parts.file.fileName, 'rekaman _1_.mp3');
	assert.equal(parts.file.mimeType, 'audio/mpeg');
	assert.deepEqual(parts.file.data, file);
});

test('mapTranscription handles JSON objects, JSON strings, buffers and subtitle text', () => {
	assert.deepEqual(g.mapTranscription({ text: 'halo', language: 'id', duration: 2 }, 'json'), {
		text: 'halo',
		language: 'id',
		duration: 2,
	});
	assert.deepEqual(g.mapTranscription('{"text":"hai"}', 'json'), { text: 'hai' });
	assert.deepEqual(g.mapTranscription(Buffer.from('{"text":"buf"}'), 'json'), { text: 'buf' });
	assert.deepEqual(g.mapTranscription('1\n00:00 --> 00:01\nhai', 'srt'), { text: '1\n00:00 --> 00:01\nhai' });
	assert.deepEqual(g.mapTranscription(null, 'json'), { text: '' });
});

test('image helpers: body limits, result mapping, MIME sniffing', () => {
	assert.deepEqual(g.buildImageBody({ model: 'm', prompt: 'p' }), { model: 'm', prompt: 'p', n: 1 });
	assert.deepEqual(
		g.buildImageBody({ model: 'm', prompt: 'p', n: 9, size: '1024x1024', quality: 'high', responseFormat: 'b64_json' }),
		{ model: 'm', prompt: 'p', n: 4, size: '1024x1024', quality: 'high', response_format: 'b64_json' },
	);
	assert.equal('size' in g.buildImageBody({ model: 'm', prompt: 'p', size: 'auto', quality: 'auto' }), false);
	assert.deepEqual(
		g.mapImageResults({ data: [{ b64_json: 'AA==' }, { url: 'https://x/y.png', revised_prompt: 'r' }, {}] }),
		[{ b64: 'AA==' }, { url: 'https://x/y.png', revisedPrompt: 'r' }],
	);
	const { PNG_BYTES } = require('./helpers');
	assert.deepEqual(g.sniffImageMime(PNG_BYTES), { mimeType: 'image/png', extension: 'png' });
	assert.deepEqual(g.sniffImageMime(Buffer.from([0xff, 0xd8, 0xff, 0])), { mimeType: 'image/jpeg', extension: 'jpg' });
	assert.deepEqual(g.sniffImageMime(Buffer.from('RIFF0000WEBPVP8 ', 'ascii')), { mimeType: 'image/webp', extension: 'webp' });
});

test('errorHint gives an actionable hint for common statuses, statusOf reads several shapes', () => {
	for (const s of [400, 401, 402, 403, 404, 413, 429, 503]) assert.equal(typeof g.errorHint(s), 'string', String(s));
	assert.equal(g.errorHint(418), undefined);
	assert.match(g.errorHint(403), /Media/);
	assert.equal(g.statusOf({ httpCode: '401' }), 401);
	assert.equal(g.statusOf({ response: { status: 503 } }), 503);
	assert.equal(g.statusOf({ message: 'x' }), undefined);
});
