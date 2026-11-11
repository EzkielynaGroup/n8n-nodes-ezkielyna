import type { INodeProperties } from 'n8n-workflow';
import { DEFAULT_CHAT_MODEL } from '../GenericFunctions';

const show = { resource: ['text'], operation: ['message'] };

export const textOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['text'] } },
		options: [
			{
				name: 'Message a Model',
				value: 'message',
				description: 'Send a prompt to a chat model and get its reply',
				action: 'Message a model',
			},
		],
		default: 'message',
	},
];

export const textFields: INodeProperties[] = [
	{
		displayName: 'Model Name or ID',
		name: 'model',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getChatModels' },
		required: true,
		default: DEFAULT_CHAT_MODEL,
		displayOptions: { show },
		description:
			'Chat model to use. The list shows the models your key can see. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		placeholder: 'e.g. Tulis caption Instagram untuk kopi susu gula aren',
		displayOptions: { show },
		description: 'The user message sent to the model',
	},
	{
		displayName: 'Simplify Output',
		name: 'simplify',
		type: 'boolean',
		default: true,
		displayOptions: { show },
		description: 'Whether to return a simplified version of the response instead of the raw data',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show },
		options: [
			{
				displayName: 'JSON Output',
				name: 'jsonOutput',
				type: 'boolean',
				default: false,
				description:
					"Whether to ask the model to reply with a JSON object. Mention JSON in the prompt too. The parsed object is returned in the 'parsed' field.",
			},
			{
				displayName: 'Maximum Number of Tokens',
				name: 'maxTokens',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 32768 },
				default: 1024,
				description:
					'Upper limit for the reply length. Keeps cost predictable; raise it for long answers.',
			},
			{
				displayName: 'Sampling Temperature',
				name: 'temperature',
				type: 'number',
				typeOptions: { minValue: 0, maxValue: 2, numberPrecision: 1 },
				default: 0.7,
				description: 'Controls randomness. Lower values give more focused and repeatable answers.',
			},
			{
				displayName: 'System Message',
				name: 'systemMessage',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				placeholder:
					'e.g. Kamu adalah CS toko online yang ramah. Jawab singkat dalam Bahasa Indonesia.',
				description: 'Instructions that set the role and style of the model',
			},
		],
	},
];
