import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	SupplyData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	CREDENTIAL_NAME,
	DEFAULT_CHAT_MODEL,
	loadModels,
	normalizeBaseUrl,
	toModelOptions,
} from '../Ezkielyna/GenericFunctions';

type ModelOptions = {
	maxTokens?: number;
	temperature?: number;
	topP?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
	timeout?: number;
	maxRetries?: number;
};

/** Builds the config handed to the n8n AI node SDK. Exported for tests. */
export function buildModelConfig(
	credentials: IDataObject,
	model: string,
	options: ModelOptions,
): IDataObject {
	const config: IDataObject = {
		type: 'openai',
		baseUrl: normalizeBaseUrl(credentials.baseUrl),
		apiKey: String(credentials.apiKey ?? ''),
		model,
		temperature: options.temperature ?? 0.7,
		maxRetries: options.maxRetries ?? 2,
		timeout: options.timeout ?? 120_000,
	};
	const maxTokens = options.maxTokens ?? 1024;
	if (maxTokens > 0) config.maxTokens = maxTokens;
	if (options.topP !== undefined) config.topP = options.topP;
	if (options.frequencyPenalty !== undefined) config.frequencyPenalty = options.frequencyPenalty;
	if (options.presencePenalty !== undefined) config.presencePenalty = options.presencePenalty;
	return config;
}

export class LmChatEzkielyna implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Ezkielyna Chat Model',
		name: 'lmChatEzkielyna',
		icon: { light: 'file:../../icons/ezkielyna.svg', dark: 'file:../../icons/ezkielyna.dark.svg' },
		group: ['transform'],
		version: [1],
		subtitle: '={{$parameter["model"]}}',
		description: 'Chat model from the Ezkielyna AI API gateway for the AI Agent and chain nodes',
		defaults: {
			name: 'Ezkielyna Chat Model',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Root Nodes'],
				'Language Models': ['Chat Models (Recommended)'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://github.com/EzkielynaGroup/n8n-nodes-ezkielyna?tab=readme-ov-file#ezkielyna-chat-model-ai-agent',
					},
				],
			},
		},
		inputs: [],
		outputs: [NodeConnectionTypes.AiLanguageModel],
		outputNames: ['Model'],
		credentials: [
			{
				name: 'ezkielynaApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Model Name or ID',
				name: 'model',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getChatModels' },
				required: true,
				default: DEFAULT_CHAT_MODEL,
				description:
					'Chat model that answers for the agent. Pick one that supports tool calling for agents with tools. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Frequency Penalty',
						name: 'frequencyPenalty',
						type: 'number',
						typeOptions: { minValue: -2, maxValue: 2, numberPrecision: 1 },
						default: 0,
						description: 'Positive values make the model less likely to repeat the same lines',
					},
					{
						displayName: 'Max Retries',
						name: 'maxRetries',
						type: 'number',
						typeOptions: { minValue: 0, maxValue: 5 },
						default: 2,
						description: 'How many times to retry a failed request',
					},
					{
						displayName: 'Maximum Number of Tokens',
						name: 'maxTokens',
						type: 'number',
						typeOptions: { minValue: -1, maxValue: 32768 },
						default: 1024,
						description:
							'Upper limit for each reply. Keeps cost predictable. Use -1 for the model default.',
					},
					{
						displayName: 'Presence Penalty',
						name: 'presencePenalty',
						type: 'number',
						typeOptions: { minValue: -2, maxValue: 2, numberPrecision: 1 },
						default: 0,
						description: 'Positive values make the model more likely to bring up new topics',
					},
					{
						displayName: 'Sampling Temperature',
						name: 'temperature',
						type: 'number',
						typeOptions: { minValue: 0, maxValue: 2, numberPrecision: 1 },
						default: 0.7,
						description:
							'Controls randomness. Lower values give more focused and repeatable answers.',
					},
					{
						displayName: 'Timeout',
						name: 'timeout',
						type: 'number',
						typeOptions: { minValue: 1000 },
						default: 120000,
						description: 'Maximum time for one request, in milliseconds',
					},
					{
						displayName: 'Top P',
						name: 'topP',
						type: 'number',
						typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 2 },
						default: 1,
						description: 'Nucleus sampling. Change this or the temperature, not both.',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getChatModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return toModelOptions(await loadModels.call(this, 'chat'));
			},
		},
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		// Loaded lazily so the main Ezkielyna node still works on n8n versions without the AI node SDK.
		let sdk: typeof import('@n8n/ai-node-sdk');
		try {
			sdk = await import('@n8n/ai-node-sdk');
		} catch {
			throw new NodeOperationError(
				this.getNode(),
				'This n8n version does not include the AI node SDK',
				{
					itemIndex,
					description:
						'Update n8n to a 2026 release, or use the OpenAI Chat Model node with Base URL https://api.ezkielyna.store/v1',
				},
			);
		}
		const credentials = await this.getCredentials(CREDENTIAL_NAME);
		const model = this.getNodeParameter('model', itemIndex) as string;
		const options = this.getNodeParameter('options', itemIndex, {}) as ModelOptions;
		const config = buildModelConfig(credentials, model, options);
		return sdk.supplyModel(this, config as unknown as Parameters<typeof sdk.supplyModel>[1]);
	}
}
