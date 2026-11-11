'use strict';
// Test helpers: a local mock of the Ezkielyna gateway (no internet, no cost) and a small
// stand-in for the n8n execute/load-options context. Only what the nodes use is implemented.

const http = require('node:http');

const FAKE_KEY = 'sk-' + 'test-local-only-0000';

const PNG_BYTES = Buffer.from(
	'89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082',
	'hex',
);
const MP3_BYTES = Buffer.concat([Buffer.from('ID3', 'ascii'), Buffer.alloc(64, 7)]);

const MODELS = [
	{ id: 'deepseek-v4.1-flash', owned_by: 'custom', supported_endpoint_types: ['openai', 'anthropic'] },
	{ id: 'glm-4.5', owned_by: 'custom', supported_endpoint_types: ['openai'] },
	{ id: 'edge-tts', owned_by: 'custom', supported_endpoint_types: ['openai', 'openai-audio'] },
	{ id: 'whisper-large-v3', owned_by: 'custom', supported_endpoint_types: ['openai', 'openai-audio'] },
	{ id: 'gpt-image-2', owned_by: 'custom', supported_endpoint_types: ['image-generation', 'openai'] },
	{ id: 'wan-3.0-720p', owned_by: 'custom', supported_endpoint_types: ['openai-video'] },
	{ id: 'text-embedding-x', owned_by: 'custom', supported_endpoint_types: ['embeddings'] },
	{ id: 'deepseek-v4-uncensored', owned_by: 'custom', supported_endpoint_types: ['openai'] },
	{ id: 'qwen-abliterated', owned_by: 'custom', supported_endpoint_types: ['openai'] },
	{ id: 'some-nsfw-model', owned_by: 'custom', supported_endpoint_types: ['openai'] },
	{ id: 'glm-4.5', owned_by: 'custom', supported_endpoint_types: ['openai'] },
];

/** Minimal multipart/form-data parser for the transcription route. */
function parseMultipart(body, contentType) {
	const match = /boundary=(.+)$/.exec(contentType || '');
	if (!match) return null;
	const boundary = Buffer.from(`--${match[1]}`);
	const parts = {};
	let start = body.indexOf(boundary);
	while (start !== -1) {
		const next = body.indexOf(boundary, start + boundary.length);
		if (next === -1) break;
		const chunk = body.subarray(start + boundary.length + 2, next - 2);
		const headerEnd = chunk.indexOf('\r\n\r\n');
		const head = chunk.subarray(0, headerEnd).toString('utf8');
		const content = chunk.subarray(headerEnd + 4);
		const name = /name="([^"]+)"/.exec(head)[1];
		const fileName = /filename="([^"]+)"/.exec(head);
		const type = /Content-Type: (.+)/i.exec(head);
		parts[name] = fileName
			? { fileName: fileName[1], mimeType: type && type[1].trim(), data: content }
			: content.toString('utf8');
		start = next;
	}
	return parts;
}

function send(res, status, body, type = 'application/json') {
	const data = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
	res.writeHead(status, { 'Content-Type': type, 'Content-Length': data.length });
	res.end(data);
}

async function startMockGateway() {
	const requests = [];
	const server = http.createServer((req, res) => {
		const chunks = [];
		req.on('data', (c) => chunks.push(c));
		req.on('end', () => {
			const raw = Buffer.concat(chunks);
			const entry = { method: req.method, path: req.url, headers: req.headers, raw };
			const isJson = (req.headers['content-type'] || '').includes('application/json');
			if (isJson && raw.length) entry.body = JSON.parse(raw.toString('utf8'));
			requests.push(entry);

			if (req.url === '/files/img.png') return send(res, 200, PNG_BYTES, 'image/png');
			if (req.headers.authorization !== `Bearer ${FAKE_KEY}`) {
				return send(res, 401, { error: { message: 'Invalid token', type: 'new_api_error' } });
			}
			const model = entry.body && entry.body.model;
			if (model === 'busy-model') return send(res, 503, { error: { message: 'No available channel' } });
			if (model === 'empty-balance') return send(res, 402, { error: { message: 'Insufficient quota' } });

			switch (`${req.method} ${req.url}`) {
				case 'GET /v1/models':
					return send(res, 200, { object: 'list', success: true, data: MODELS });
				case 'POST /v1/chat/completions': {
					const b = entry.body;
					const last = b.messages[b.messages.length - 1].content;
					// Agent with tools: ask for the first tool once, then answer with what the tool returned.
					if (Array.isArray(b.tools) && b.tools.length && !b.messages.some((m) => m.role === 'tool')) {
						return send(res, 200, {
							id: 'chatcmpl-tool',
							object: 'chat.completion',
							model: b.model,
							choices: [
								{
									index: 0,
									finish_reason: 'tool_calls',
									message: {
										role: 'assistant',
										content: null,
										tool_calls: [
											{
												id: 'call_1',
												type: 'function',
												function: { name: b.tools[0].function.name, arguments: JSON.stringify({ query: 'kurs dolar' }) },
											},
										],
									},
								},
							],
							usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 },
						});
					}
					const content = b.response_format
						? '```json\n{"produk":"kopi","harga":15000}\n```'
						: model === 'parts-model'
							? [{ type: 'text', text: 'Halo ' }, { type: 'text', text: 'dunia' }]
							: `echo: ${last}`;
					return send(res, 200, {
						id: 'chatcmpl-1',
						object: 'chat.completion',
						model: b.model,
						choices: [
							{
								index: 0,
								finish_reason: 'stop',
								message: { role: 'assistant', content, reasoning_content: model === 'reasoner' ? 'thinking' : undefined },
							},
						],
						usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
					});
				}
				case 'POST /v1/search':
					return send(res, 200, {
						results: [
							{ title: 'Harga cabai', url: 'https://example.com/a', snippet: 'Rp50.000/kg', published: '2026-11-10' },
							{ title: 'Pasar Induk', url: 'https://example.com/b', content: 'Naik 5%' },
						],
						cached: false,
						took_ms: 321,
					});
				case 'POST /v1/audio/speech':
					return send(res, 200, MP3_BYTES, 'audio/mpeg');
				case 'POST /v1/audio/transcriptions': {
					const parts = parseMultipart(raw, req.headers['content-type']);
					entry.multipart = parts;
					if (!parts || !parts.file || !parts.model) return send(res, 400, { error: { message: 'file and model required' } });
					if (parts.response_format === 'srt') {
						return send(res, 200, '1\n00:00:00,000 --> 00:00:01,000\nhalo dunia\n', 'text/plain');
					}
					return send(res, 200, { text: 'halo dunia', language: 'id', duration: 1.5 });
				}
				case 'POST /v1/images/generations': {
					const port = server.address().port;
					if (model === 'url-model') {
						return send(res, 200, { created: 1, data: [{ url: `http://127.0.0.1:${port}/files/img.png` }] });
					}
					if (model === 'no-image') return send(res, 200, { created: 1, data: [] });
					const n = entry.body.n || 1;
					return send(res, 200, {
						created: 1,
						data: Array.from({ length: n }, () => ({ b64_json: PNG_BYTES.toString('base64'), revised_prompt: 'kopi' })),
					});
				}
				default:
					return send(res, 404, { error: { message: `no route ${req.method} ${req.url}` } });
			}
		});
	});
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address();
	return {
		baseUrl: `http://127.0.0.1:${port}/v1`,
		requests,
		last: () => requests[requests.length - 1],
		close: () => new Promise((resolve) => server.close(resolve)),
	};
}

/** Resolves the `={{$credentials.x}}` style expressions used in credential classes. */
function resolveCredentialExpression(value, credentials) {
	if (typeof value !== 'string' || !value.startsWith('=')) return value;
	return value.slice(1).replace(/\{\{\s*\$credentials\.(\w+)\s*\}\}/g, (_, k) => String(credentials[k] ?? ''));
}

/**
 * Behaves like n8n's helpers.httpRequest for the options this package uses:
 * json, body (object or Buffer), headers, encoding 'arraybuffer', timeout. Throws on non-2xx
 * with `httpCode` and `response` like the real helper does.
 */
async function fakeHttpRequest(options) {
	const headers = { ...(options.headers || {}) };
	let body;
	if (Buffer.isBuffer(options.body)) {
		body = options.body;
	} else if (options.body !== undefined) {
		body = JSON.stringify(options.body);
		if (!Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) {
			headers['Content-Type'] = 'application/json';
		}
	}
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), options.timeout || 10000);
	let res;
	try {
		res = await fetch(options.url, { method: options.method || 'GET', headers, body, signal: controller.signal });
	} finally {
		clearTimeout(timer);
	}
	const buf = Buffer.from(await res.arrayBuffer());
	const type = res.headers.get('content-type') || '';
	let parsed;
	if (options.encoding === 'arraybuffer') parsed = buf;
	else if (type.includes('application/json')) parsed = JSON.parse(buf.toString('utf8'));
	else parsed = buf.toString('utf8');
	if (!res.ok) {
		const error = new Error(`Request failed with status code ${res.status}`);
		error.httpCode = String(res.status);
		error.response = { status: res.status, body: parsed };
		error.description = parsed && parsed.error && parsed.error.message;
		throw error;
	}
	return parsed;
}

/**
 * Creates a stand-in for IExecuteFunctions / ILoadOptionsFunctions.
 * `params` is either one object for every item or an array with one object per item.
 */
function createContext({ params = {}, items = [{ json: {} }], credentials, credentialType, continueOnFail = false }) {
	const node = { id: 'n1', name: 'Ezkielyna', type: 'n8n-nodes-ezkielyna.ezkielyna', typeVersion: 1, position: [0, 0], parameters: {} };
	const paramsFor = (i) => (Array.isArray(params) ? params[i] : params);
	const ctx = {
		getInputData: () => items,
		getNode: () => node,
		continueOnFail: () => continueOnFail,
		getCredentials: async () => ({ ...credentials }),
		getNodeParameter(name, i, fallback) {
			const p = paramsFor(typeof i === 'number' ? i : 0) || {};
			if (Object.prototype.hasOwnProperty.call(p, name)) return p[name];
			if (fallback !== undefined) return fallback;
			throw new Error(`missing parameter ${name}`);
		},
		helpers: {
			httpRequest: fakeHttpRequest,
			async httpRequestWithAuthentication(_name, options) {
				const auth = credentialType.authenticate.properties.headers;
				const headers = { ...(options.headers || {}) };
				for (const [k, v] of Object.entries(auth)) headers[k] = resolveCredentialExpression(v, credentials);
				return fakeHttpRequest({ ...options, headers });
			},
			async prepareBinaryData(data, fileName, mimeType) {
				return { data: data.toString('base64'), fileName, mimeType, fileSize: String(data.length) };
			},
			assertBinaryData(i, prop) {
				const bin = items[i].binary && items[i].binary[prop];
				if (!bin) throw new Error(`no binary field '${prop}'`);
				return bin;
			},
			async getBinaryDataBuffer(i, prop) {
				return Buffer.from(items[i].binary[prop].data, 'base64');
			},
		},
	};
	return ctx;
}

module.exports = {
	FAKE_KEY,
	MODELS,
	MP3_BYTES,
	PNG_BYTES,
	createContext,
	fakeHttpRequest,
	parseMultipart,
	resolveCredentialExpression,
	startMockGateway,
};
