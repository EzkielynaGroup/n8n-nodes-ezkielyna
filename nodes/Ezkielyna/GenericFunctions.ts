import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	ISupplyDataFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export const CREDENTIAL_NAME = 'ezkielynaApi';
export const DEFAULT_BASE_URL = 'https://api.ezkielyna.store/v1';
export const DEFAULT_CHAT_MODEL = 'deepseek-v4.1-flash';
export const DEFAULT_TTS_MODEL = 'edge-tts';
export const DEFAULT_TTS_VOICE = 'id-ID-GadisNeural';
export const DEFAULT_STT_MODEL = 'whisper-large-v3';
export const DEFAULT_IMAGE_MODEL = 'gpt-image-2';

export const MAX_TTS_CHARS = 4096;
export const MAX_SEARCH_QUERY_CHARS = 400;
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_DOWNLOAD_BYTES = 20 * 1024 * 1024;

export type ModelKind = 'chat' | 'speech' | 'transcription' | 'image' | 'video' | 'embedding';

export interface GatewayModel {
	id: string;
	owned_by?: string;
	supported_endpoint_types?: string[];
	[key: string]: unknown;
}

type AnyContext = IExecuteFunctions | ILoadOptionsFunctions | ISupplyDataFunctions;

/** Removes trailing slashes so `${base}/models` never becomes `//models`. */
export function normalizeBaseUrl(raw: unknown): string {
	const value = typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : DEFAULT_BASE_URL;
	return value.replace(/\/+$/, '');
}

/** Model ids that must never be listed by this package. */
export function isBlockedModel(id: string): boolean {
	return /uncensored|abliterated|nsfw/i.test(id);
}

const SPEECH_ID = /(^|[-_.])tts([-_.]|$)|text-to-speech|^tts-|edge-tts/i;
const TRANSCRIPTION_ID = /whisper|(^|[-_.])stt([-_.]|$)|transcri|scribe/i;
const IMAGE_ID =
	/image|imagen|dall-e|flux|banana|seedream|ideogram|midjourney|stable-diffusion|sdxl/i;
const VIDEO_ID = /video|seedance|kling|veo|sora|vidu|wan-?\d|hailuo|happyhorse/i;
const EMBEDDING_ID = /embed/i;

/**
 * Decides what a model is for. Uses `supported_endpoint_types` when the gateway sends it
 * (New API does), otherwise falls back to the model id.
 */
export function modelKind(model: GatewayModel): ModelKind {
	const id = model.id;
	const types = Array.isArray(model.supported_endpoint_types)
		? model.supported_endpoint_types.map((t) => String(t).toLowerCase())
		: [];
	if (types.includes('image-generation')) return 'image';
	if (types.includes('openai-video')) return 'video';
	if (types.includes('embeddings')) return 'embedding';
	if (types.includes('openai-audio')) {
		return TRANSCRIPTION_ID.test(id) ? 'transcription' : 'speech';
	}
	if (types.length > 0) return 'chat';
	if (TRANSCRIPTION_ID.test(id)) return 'transcription';
	if (SPEECH_ID.test(id)) return 'speech';
	if (VIDEO_ID.test(id)) return 'video';
	if (IMAGE_ID.test(id)) return 'image';
	if (EMBEDDING_ID.test(id)) return 'embedding';
	return 'chat';
}

/** Extracts the model array from a `/models` response, drops blocked ids and duplicates, sorts by id. */
export function parseModelList(response: unknown): GatewayModel[] {
	const raw = (response as IDataObject | undefined)?.data;
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const out: GatewayModel[] = [];
	for (const entry of raw) {
		const id =
			typeof (entry as IDataObject)?.id === 'string' ? ((entry as IDataObject).id as string) : '';
		if (!id || seen.has(id) || isBlockedModel(id)) continue;
		seen.add(id);
		out.push(entry as GatewayModel);
	}
	return out.sort((a, b) => a.id.localeCompare(b.id));
}

export function filterModels(models: GatewayModel[], kind?: ModelKind | 'all'): GatewayModel[] {
	if (!kind || kind === 'all') return models;
	return models.filter((m) => modelKind(m) === kind);
}

export function toModelOptions(models: GatewayModel[]): INodePropertyOptions[] {
	return models.map((m) => ({ name: m.id, value: m.id }));
}

export function simplifyModel(model: GatewayModel): IDataObject {
	return {
		id: model.id,
		kind: modelKind(model),
		ownedBy: model.owned_by ?? null,
		endpointTypes: Array.isArray(model.supported_endpoint_types)
			? model.supported_endpoint_types
			: [],
	};
}

// ---------------------------------------------------------------- chat

export interface ChatInput {
	model: string;
	prompt: string;
	systemMessage?: string;
	temperature?: number;
	maxTokens?: number;
	jsonOutput?: boolean;
}

export function buildChatBody(input: ChatInput): IDataObject {
	const messages: IDataObject[] = [];
	if (input.systemMessage && input.systemMessage.trim() !== '') {
		messages.push({ role: 'system', content: input.systemMessage });
	}
	messages.push({ role: 'user', content: input.prompt });
	const body: IDataObject = { model: input.model, messages };
	if (typeof input.temperature === 'number' && !Number.isNaN(input.temperature)) {
		body.temperature = input.temperature;
	}
	if (typeof input.maxTokens === 'number' && input.maxTokens > 0) {
		body.max_tokens = Math.floor(input.maxTokens);
	}
	if (input.jsonOutput) {
		body.response_format = { type: 'json_object' };
	}
	return body;
}

/** Pulls text out of a chat completion. Handles string content and the content-part array form. */
export function extractMessageText(content: unknown): string {
	if (typeof content === 'string') return content;
	if (Array.isArray(content)) {
		return content
			.map((part) =>
				typeof part === 'string'
					? part
					: typeof (part as IDataObject)?.text === 'string'
						? ((part as IDataObject).text as string)
						: '',
			)
			.join('');
	}
	return '';
}

/** Strips a ```json fence some models add even in JSON mode. */
export function parseJsonReply(text: string): IDataObject | IDataObject[] | undefined {
	const trimmed = text
		.trim()
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/\s*```$/, '');
	try {
		const parsed = JSON.parse(trimmed) as unknown;
		if (parsed !== null && typeof parsed === 'object') return parsed as IDataObject;
	} catch {
		// not JSON: caller keeps the text
	}
	return undefined;
}

export function mapChatResponse(response: IDataObject, jsonOutput = false): IDataObject {
	const choices = Array.isArray(response.choices) ? (response.choices as IDataObject[]) : [];
	const first = choices[0] ?? {};
	const message = (first.message as IDataObject | undefined) ?? {};
	const text = extractMessageText(message.content);
	const usage = (response.usage as IDataObject | undefined) ?? {};
	const out: IDataObject = {
		text,
		model: (response.model as string | undefined) ?? null,
		finishReason: (first.finish_reason as string | undefined) ?? null,
		usage: {
			promptTokens: usage.prompt_tokens ?? null,
			completionTokens: usage.completion_tokens ?? null,
			totalTokens: usage.total_tokens ?? null,
		},
	};
	if (typeof message.reasoning_content === 'string' && message.reasoning_content !== '') {
		out.reasoning = message.reasoning_content;
	}
	if (jsonOutput) {
		const parsed = parseJsonReply(text);
		if (parsed !== undefined) out.parsed = parsed;
	}
	return out;
}

// ---------------------------------------------------------------- search

export interface SearchInput {
	query: string;
	maxResults?: number;
	timeRange?: string;
	language?: string;
}

export function buildSearchBody(input: SearchInput): IDataObject {
	const query = input.query.trim();
	const body: IDataObject = { query };
	const max = Math.min(10, Math.max(1, Math.floor(input.maxResults ?? 5)));
	body.max_results = max;
	if (input.timeRange && ['day', 'week', 'month', 'year'].includes(input.timeRange)) {
		body.time_range = input.timeRange;
	}
	if (input.language && input.language.trim() !== '') {
		body.language = input.language.trim();
	}
	return body;
}

export function mapSearchResults(response: IDataObject): IDataObject[] {
	const results = Array.isArray(response.results) ? (response.results as IDataObject[]) : [];
	return results.map((r, index) => {
		const item: IDataObject = {
			position: index + 1,
			title: typeof r.title === 'string' ? r.title : '',
			url: typeof r.url === 'string' ? r.url : '',
			snippet:
				typeof r.snippet === 'string' ? r.snippet : typeof r.content === 'string' ? r.content : '',
		};
		if (typeof r.published === 'string' && r.published !== '') item.published = r.published;
		return item;
	});
}

// ---------------------------------------------------------------- audio

const AUDIO_MIME: Record<string, string> = {
	mp3: 'audio/mpeg',
	opus: 'audio/ogg',
	aac: 'audio/aac',
	flac: 'audio/flac',
	wav: 'audio/wav',
	pcm: 'audio/pcm',
};

export function audioMimeType(format: string): string {
	return AUDIO_MIME[format] ?? 'application/octet-stream';
}

export function buildSpeechBody(input: {
	model: string;
	text: string;
	voice: string;
	format: string;
	speed?: number;
}): IDataObject {
	const body: IDataObject = {
		model: input.model,
		input: input.text,
		voice: input.voice,
		response_format: input.format,
	};
	if (typeof input.speed === 'number' && input.speed > 0 && input.speed !== 1) {
		body.speed = input.speed;
	}
	return body;
}

export interface MultipartFile {
	fieldName: string;
	fileName: string;
	mimeType: string;
	data: Buffer;
}

/** Builds a multipart/form-data body by hand so the package needs no runtime dependency. */
export function buildMultipart(
	fields: Record<string, string | undefined>,
	file: MultipartFile,
	boundary = `----ezkielyna${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`,
): { body: Buffer; contentType: string } {
	const safe = (value: string) => value.replace(/["\r\n]/g, '_');
	const parts: Buffer[] = [];
	for (const [name, value] of Object.entries(fields)) {
		if (value === undefined || value === '') continue;
		parts.push(
			Buffer.from(
				`--${boundary}\r\nContent-Disposition: form-data; name="${safe(name)}"\r\n\r\n${value}\r\n`,
				'utf8',
			),
		);
	}
	parts.push(
		Buffer.from(
			`--${boundary}\r\nContent-Disposition: form-data; name="${safe(file.fieldName)}"; filename="${safe(
				file.fileName,
			)}"\r\nContent-Type: ${file.mimeType}\r\n\r\n`,
			'utf8',
		),
	);
	parts.push(file.data);
	parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'));
	return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

/** Normalises the transcription reply: JSON `{text}` or plain text (srt/vtt/text formats). */
export function mapTranscription(response: unknown, format: string): IDataObject {
	let value: unknown = response;
	if (Buffer.isBuffer(value)) value = value.toString('utf8');
	if (typeof value === 'string' && (format === 'json' || format === 'verbose_json')) {
		try {
			value = JSON.parse(value);
		} catch {
			// keep the raw string
		}
	}
	if (value !== null && typeof value === 'object') {
		const obj = value as IDataObject;
		const out: IDataObject = { text: typeof obj.text === 'string' ? obj.text : '' };
		if (typeof obj.language === 'string') out.language = obj.language;
		if (typeof obj.duration === 'number') out.duration = obj.duration;
		if (Array.isArray(obj.segments)) out.segments = obj.segments;
		return out;
	}
	return { text: typeof value === 'string' ? value : '' };
}

// ---------------------------------------------------------------- image

export function buildImageBody(input: {
	model: string;
	prompt: string;
	n?: number;
	size?: string;
	quality?: string;
	responseFormat?: string;
}): IDataObject {
	const body: IDataObject = { model: input.model, prompt: input.prompt };
	const n = Math.min(4, Math.max(1, Math.floor(input.n ?? 1)));
	body.n = n;
	if (input.size && input.size !== 'auto') body.size = input.size;
	if (input.quality && input.quality !== 'auto') body.quality = input.quality;
	if (input.responseFormat === 'b64_json' || input.responseFormat === 'url') {
		body.response_format = input.responseFormat;
	}
	return body;
}

export interface ImageResult {
	b64?: string;
	url?: string;
	revisedPrompt?: string;
}

export function mapImageResults(response: IDataObject): ImageResult[] {
	const data = Array.isArray(response.data) ? (response.data as IDataObject[]) : [];
	return data
		.map((d) => {
			const r: ImageResult = {};
			if (typeof d.b64_json === 'string' && d.b64_json !== '') r.b64 = d.b64_json;
			if (typeof d.url === 'string' && d.url !== '') r.url = d.url;
			if (typeof d.revised_prompt === 'string') r.revisedPrompt = d.revised_prompt;
			return r;
		})
		.filter((r) => r.b64 !== undefined || r.url !== undefined);
}

/** Guesses an image MIME type from the first bytes (PNG, JPEG, WEBP, GIF). */
export function sniffImageMime(data: Buffer): { mimeType: string; extension: string } {
	if (
		data.length >= 4 &&
		data[0] === 0x89 &&
		data[1] === 0x50 &&
		data[2] === 0x4e &&
		data[3] === 0x47
	) {
		return { mimeType: 'image/png', extension: 'png' };
	}
	if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
		return { mimeType: 'image/jpeg', extension: 'jpg' };
	}
	if (
		data.length >= 12 &&
		data.toString('ascii', 0, 4) === 'RIFF' &&
		data.toString('ascii', 8, 12) === 'WEBP'
	) {
		return { mimeType: 'image/webp', extension: 'webp' };
	}
	if (data.length >= 3 && data.toString('ascii', 0, 3) === 'GIF') {
		return { mimeType: 'image/gif', extension: 'gif' };
	}
	return { mimeType: 'image/png', extension: 'png' };
}

// ---------------------------------------------------------------- HTTP

/** Short, actionable hint per HTTP status (shown under the n8n error message). */
export function errorHint(status: number | undefined): string | undefined {
	switch (status) {
		case 400:
			return 'Check the model name and the parameters. Some models do not support every option (for example JSON output or a voice).';
		case 401:
			return 'The API key was not accepted. Open the Ezkielyna API credential and paste the key again from api.ezkielyna.store → API Keys.';
		case 402:
			return 'The API balance is empty. Top up at ezkielyna.store, then run the node again.';
		case 403:
			return 'This key cannot use this model. Use a key from a group that includes it (Standard for text, Premium, Media for images and video, Auto for everything).';
		case 404:
			return 'The endpoint or model was not found. Check the Base URL in the credential (it must end with /v1) and the model name.';
		case 413:
			return 'The request is too large. Send a shorter text or a smaller file.';
		case 429:
			return 'Rate limit reached. Wait a moment, then retry; add a Wait node between items for large batches.';
		case 500:
		case 502:
		case 503:
		case 504:
			return 'The model is busy or temporarily unavailable. Retry later or pick another model.';
		default:
			return undefined;
	}
}

export function statusOf(error: unknown): number | undefined {
	const e = error as IDataObject & { response?: IDataObject; cause?: IDataObject };
	const candidates = [
		e?.httpCode,
		e?.statusCode,
		e?.status,
		e?.response?.status,
		e?.response?.statusCode,
		e?.cause?.status,
	];
	for (const c of candidates) {
		const n = typeof c === 'string' ? Number.parseInt(c, 10) : c;
		if (typeof n === 'number' && Number.isFinite(n) && n >= 100) return n;
	}
	return undefined;
}

export async function ezkielynaRequest(
	this: AnyContext,
	method: IHttpRequestMethods,
	endpoint: string,
	options: Partial<IHttpRequestOptions> = {},
	itemIndex?: number,
): Promise<unknown> {
	const credentials = await this.getCredentials(CREDENTIAL_NAME);
	const request: IHttpRequestOptions = {
		method,
		url: `${normalizeBaseUrl(credentials.baseUrl)}${endpoint}`,
		json: true,
		timeout: 120_000,
		...options,
	};
	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, CREDENTIAL_NAME, request);
	} catch (error) {
		const status = statusOf(error);
		const description = errorHint(status);
		throw new NodeApiError(this.getNode(), error as JsonObject, {
			...(description ? { description } : {}),
			...(status ? { httpCode: String(status) } : {}),
			...(itemIndex !== undefined ? { itemIndex } : {}),
		});
	}
}

export async function loadModels(
	this: AnyContext,
	kind?: ModelKind | 'all',
): Promise<GatewayModel[]> {
	const response = await ezkielynaRequest.call(this, 'GET', '/models');
	return filterModels(parseModelList(response), kind);
}
