import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { audioFields, audioOperations } from './descriptions/AudioDescription';
import { imageFields, imageOperations } from './descriptions/ImageDescription';
import { modelFields, modelOperations } from './descriptions/ModelDescription';
import { searchFields, searchOperations } from './descriptions/SearchDescription';
import { textFields, textOperations } from './descriptions/TextDescription';
import {
	MAX_AUDIO_BYTES,
	MAX_IMAGE_DOWNLOAD_BYTES,
	MAX_SEARCH_QUERY_CHARS,
	MAX_TTS_CHARS,
	audioMimeType,
	buildChatBody,
	buildImageBody,
	buildMultipart,
	buildSearchBody,
	buildSpeechBody,
	ezkielynaRequest,
	loadModels,
	mapChatResponse,
	mapImageResults,
	mapSearchResults,
	mapTranscription,
	simplifyModel,
	sniffImageMime,
	toModelOptions,
} from './GenericFunctions';

/*
 * Programmatic style on purpose: text to speech and image generation return binary files,
 * transcription uploads a binary file as multipart/form-data, and one image request can
 * return several files. Declarative routing cannot read or write binary data like that.
 */
export class Ezkielyna implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Ezkielyna',
		name: 'ezkielyna',
		icon: { light: 'file:../../icons/ezkielyna.svg', dark: 'file:../../icons/ezkielyna.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Chat, web search, text to speech, transcription and image generation through the Ezkielyna AI API gateway',
		defaults: {
			name: 'Ezkielyna',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'ezkielynaApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Audio', value: 'audio' },
					{ name: 'Image', value: 'image' },
					{ name: 'Model', value: 'model' },
					{ name: 'Text', value: 'text' },
					{ name: 'Web Search', value: 'webSearch' },
				],
				default: 'text',
			},
			...textOperations,
			...textFields,
			...searchOperations,
			...searchFields,
			...audioOperations,
			...audioFields,
			...imageOperations,
			...imageFields,
			...modelOperations,
			...modelFields,
		],
	};

	methods = {
		loadOptions: {
			async getChatModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return toModelOptions(await loadModels.call(this, 'chat'));
			},
			async getSpeechModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return toModelOptions(await loadModels.call(this, 'speech'));
			},
			async getTranscriptionModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return toModelOptions(await loadModels.call(this, 'transcription'));
			},
			async getImageModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return toModelOptions(await loadModels.call(this, 'image'));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'text' && operation === 'message') {
					returnData.push(...(await messageModel.call(this, i)));
				} else if (resource === 'webSearch' && operation === 'search') {
					returnData.push(...(await webSearch.call(this, i)));
				} else if (resource === 'audio' && operation === 'textToSpeech') {
					returnData.push(...(await generateSpeech.call(this, i)));
				} else if (resource === 'audio' && operation === 'transcribe') {
					returnData.push(...(await transcribe.call(this, i)));
				} else if (resource === 'image' && operation === 'generate') {
					returnData.push(...(await generateImage.call(this, i)));
				} else if (resource === 'model' && operation === 'getAll') {
					returnData.push(...(await listModels.call(this, i)));
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`The operation '${operation}' is not supported for resource '${resource}'`,
						{ itemIndex: i },
					);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				if (error instanceof NodeApiError) {
					throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex: i });
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}

async function messageModel(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const model = this.getNodeParameter('model', i) as string;
	const prompt = this.getNodeParameter('prompt', i) as string;
	const simplify = this.getNodeParameter('simplify', i, true) as boolean;
	const options = this.getNodeParameter('options', i, {}) as IDataObject;

	if (!prompt || prompt.trim() === '') {
		throw new NodeOperationError(this.getNode(), "'Prompt' is empty", {
			itemIndex: i,
			description: 'Type a message or map a field from the previous node into it',
		});
	}

	const jsonOutput = options.jsonOutput === true;
	const body = buildChatBody({
		model,
		prompt,
		systemMessage: options.systemMessage as string | undefined,
		temperature: options.temperature as number | undefined,
		maxTokens: (options.maxTokens as number | undefined) ?? 1024,
		jsonOutput,
	});
	const response = (await ezkielynaRequest.call(
		this,
		'POST',
		'/chat/completions',
		{ body },
		i,
	)) as IDataObject;

	const json = simplify ? mapChatResponse(response, jsonOutput) : response;
	return [{ json, pairedItem: { item: i } }];
}

async function webSearch(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const query = (this.getNodeParameter('query', i) as string) ?? '';
	const maxResults = this.getNodeParameter('maxResults', i, 5) as number;
	const split = this.getNodeParameter('splitResults', i, true) as boolean;
	const options = this.getNodeParameter('options', i, {}) as IDataObject;

	const trimmed = query.trim();
	if (trimmed.length === 0 || trimmed.length > MAX_SEARCH_QUERY_CHARS) {
		throw new NodeOperationError(this.getNode(), "'Query' must be 1 to 400 characters", {
			itemIndex: i,
			description: 'Shorten the query or map a field that holds the search words',
		});
	}

	const body = buildSearchBody({
		query: trimmed,
		maxResults,
		timeRange: options.timeRange as string | undefined,
		language: options.language as string | undefined,
	});
	const response = (await ezkielynaRequest.call(
		this,
		'POST',
		'/search',
		{ body },
		i,
	)) as IDataObject;
	const results = mapSearchResults(response);

	if (!split) {
		return [
			{
				json: {
					query: trimmed,
					results,
					cached: response.cached ?? null,
					tookMs: response.took_ms ?? null,
				},
				pairedItem: { item: i },
			},
		];
	}
	return results.map((r) => ({ json: { query: trimmed, ...r }, pairedItem: { item: i } }));
}

async function generateSpeech(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const model = this.getNodeParameter('model', i) as string;
	const text = this.getNodeParameter('text', i) as string;
	const voice = this.getNodeParameter('voice', i) as string;
	const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i, 'data') as string;
	const options = this.getNodeParameter('options', i, {}) as IDataObject;
	const format = (options.format as string | undefined) || 'mp3';

	if (!text || text.trim() === '') {
		throw new NodeOperationError(this.getNode(), "'Text' is empty", {
			itemIndex: i,
			description: 'Type the text to read aloud or map a field into it',
		});
	}
	if (text.length > MAX_TTS_CHARS) {
		throw new NodeOperationError(
			this.getNode(),
			`'Text' is longer than ${MAX_TTS_CHARS} characters`,
			{
				itemIndex: i,
				description: 'Split the text into smaller parts, for example per paragraph',
			},
		);
	}

	const body = buildSpeechBody({
		model,
		text,
		voice,
		format,
		speed: options.speed as number | undefined,
	});
	const response = (await ezkielynaRequest.call(
		this,
		'POST',
		'/audio/speech',
		{ body, encoding: 'arraybuffer', json: false },
		i,
	)) as ArrayBuffer | Buffer;

	const data = Buffer.isBuffer(response) ? response : Buffer.from(response);
	if (data.length === 0) {
		throw new NodeOperationError(this.getNode(), 'The model returned an empty audio file', {
			itemIndex: i,
			description: 'Check the voice name for this model, or try another model',
		});
	}
	const baseName = ((options.fileName as string | undefined) || 'speech').replace(/[\\/]/g, '_');
	const binary = await this.helpers.prepareBinaryData(
		data,
		`${baseName}.${format}`,
		audioMimeType(format),
	);
	return [
		{
			json: { model, voice, format, characters: text.length, bytes: data.length },
			binary: { [binaryPropertyName]: binary },
			pairedItem: { item: i },
		},
	];
}

async function transcribe(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const model = this.getNodeParameter('model', i) as string;
	const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i, 'data') as string;
	const options = this.getNodeParameter('options', i, {}) as IDataObject;
	const format = (options.format as string | undefined) || 'json';

	const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
	const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
	if (buffer.length === 0) {
		throw new NodeOperationError(this.getNode(), `The file in '${binaryPropertyName}' is empty`, {
			itemIndex: i,
			description: 'Pass a real audio file from the previous node',
		});
	}
	if (buffer.length > MAX_AUDIO_BYTES) {
		throw new NodeOperationError(this.getNode(), 'The audio file is larger than 25 MB', {
			itemIndex: i,
			description: 'Compress the recording (for example to mp3 or m4a) or cut it into parts',
		});
	}

	const { body, contentType } = buildMultipart(
		{
			model,
			response_format: format,
			language: (options.language as string | undefined)?.trim(),
			prompt: options.prompt as string | undefined,
		},
		{
			fieldName: 'file',
			fileName: binaryData.fileName || `audio.${binaryData.fileExtension || 'mp3'}`,
			mimeType: binaryData.mimeType || 'application/octet-stream',
			data: buffer,
		},
	);

	const response = await ezkielynaRequest.call(
		this,
		'POST',
		'/audio/transcriptions',
		{
			body,
			headers: { 'Content-Type': contentType },
			json: false,
			timeout: 300_000,
		},
		i,
	);
	return [
		{
			json: { ...mapTranscription(response, format), model, format },
			pairedItem: { item: i },
		},
	];
}

async function generateImage(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const model = this.getNodeParameter('model', i) as string;
	const prompt = this.getNodeParameter('prompt', i) as string;
	const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i, 'data') as string;
	const options = this.getNodeParameter('options', i, {}) as IDataObject;
	const download = options.download !== false;

	if (!prompt || prompt.trim() === '') {
		throw new NodeOperationError(this.getNode(), "'Prompt' is empty", {
			itemIndex: i,
			description: 'Describe the image you want or map a field into the prompt',
		});
	}

	const body = buildImageBody({
		model,
		prompt,
		n: options.n as number | undefined,
		size: options.size as string | undefined,
		quality: options.quality as string | undefined,
		responseFormat: options.responseFormat as string | undefined,
	});
	const response = (await ezkielynaRequest.call(
		this,
		'POST',
		'/images/generations',
		{ body, timeout: 300_000 },
		i,
	)) as IDataObject;
	const images = mapImageResults(response);
	if (images.length === 0) {
		throw new NodeOperationError(this.getNode(), 'The model returned no image', {
			itemIndex: i,
			description:
				'Try another prompt or model. Prompts that break the model rules return nothing.',
		});
	}

	const out: INodeExecutionData[] = [];
	for (let index = 0; index < images.length; index++) {
		const image = images[index];
		const json: IDataObject = { model, prompt, index };
		if (image.url) json.url = image.url;
		if (image.revisedPrompt) json.revisedPrompt = image.revisedPrompt;

		let data: Buffer | undefined;
		if (image.b64) {
			data = Buffer.from(image.b64, 'base64');
		} else if (image.url && download) {
			const downloaded = (await this.helpers.httpRequest({
				method: 'GET',
				url: image.url,
				encoding: 'arraybuffer',
				json: false,
				timeout: 120_000,
			})) as ArrayBuffer | Buffer;
			data = Buffer.isBuffer(downloaded) ? downloaded : Buffer.from(downloaded);
			if (data.length > MAX_IMAGE_DOWNLOAD_BYTES) {
				throw new NodeOperationError(this.getNode(), 'The image file is larger than 20 MB', {
					itemIndex: i,
					description: "Turn off 'Download Image' and use the link in the 'url' field instead",
				});
			}
		}

		const entry: INodeExecutionData = { json, pairedItem: { item: i } };
		if (data && data.length > 0) {
			const { mimeType, extension } = sniffImageMime(data);
			const name = images.length > 1 ? `image-${index + 1}.${extension}` : `image.${extension}`;
			entry.binary = {
				[binaryPropertyName]: await this.helpers.prepareBinaryData(data, name, mimeType),
			};
			json.bytes = data.length;
		}
		out.push(entry);
	}
	return out;
}

async function listModels(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const kind = this.getNodeParameter('kind', i, 'all') as
		| 'all'
		| 'chat'
		| 'speech'
		| 'transcription'
		| 'image'
		| 'video'
		| 'embedding';
	const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
	let models = await loadModels.call(this, kind);
	if (!returnAll) {
		const limit = this.getNodeParameter('limit', i, 50) as number;
		models = models.slice(0, Math.max(1, limit));
	}
	return models.map((m) => ({ json: simplifyModel(m), pairedItem: { item: i } }));
}
