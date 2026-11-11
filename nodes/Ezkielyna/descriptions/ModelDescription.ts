import type { INodeProperties } from 'n8n-workflow';

const show = { resource: ['model'], operation: ['getAll'] };

export const modelOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['model'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the models your API key can use',
				action: 'Get many models',
			},
		],
		default: 'getAll',
	},
];

export const modelFields: INodeProperties[] = [
	{
		displayName: 'Type',
		name: 'kind',
		type: 'options',
		options: [
			{ name: 'All', value: 'all' },
			{ name: 'Chat', value: 'chat' },
			{ name: 'Embedding', value: 'embedding' },
			{ name: 'Image', value: 'image' },
			{ name: 'Speech to Text', value: 'transcription' },
			{ name: 'Text to Speech', value: 'speech' },
			{ name: 'Video', value: 'video' },
		],
		default: 'all',
		displayOptions: { show },
		description: 'Only return models of this type',
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: { show },
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		displayOptions: { show: { ...show, returnAll: [false] } },
		description: 'Max number of results to return',
	},
];
