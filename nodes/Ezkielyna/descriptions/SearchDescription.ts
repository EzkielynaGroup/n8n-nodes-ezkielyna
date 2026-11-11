import type { INodeProperties } from 'n8n-workflow';

const show = { resource: ['webSearch'], operation: ['search'] };

export const searchOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['webSearch'] } },
		options: [
			{
				name: 'Search',
				value: 'search',
				description: 'Search the web and get titles, links and snippets',
				action: 'Search the web',
			},
		],
		default: 'search',
	},
];

export const searchFields: INodeProperties[] = [
	{
		displayName: 'Query',
		name: 'query',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. harga cabai rawit hari ini Jakarta',
		displayOptions: { show },
		description: 'What to search for (1 to 400 characters)',
	},
	{
		displayName: 'Max Results',
		name: 'maxResults',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 10 },
		default: 5,
		displayOptions: { show },
		description: 'Max number of results to return',
	},
	{
		displayName: 'Split Into Items',
		name: 'splitResults',
		type: 'boolean',
		default: true,
		displayOptions: { show },
		description:
			'Whether to output one item per result. When off, one item holds all results in a list.',
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
				displayName: 'Language',
				name: 'language',
				type: 'string',
				default: '',
				placeholder: 'e.g. en',
				description:
					'Preferred result language as a two-letter code. Leave empty for any language.',
				hint: 'Indonesian is id, English is en',
			},
			{
				displayName: 'Time Range',
				name: 'timeRange',
				type: 'options',
				options: [
					{ name: 'Any Time', value: '' },
					{ name: 'Past Day', value: 'day' },
					{ name: 'Past Month', value: 'month' },
					{ name: 'Past Week', value: 'week' },
					{ name: 'Past Year', value: 'year' },
				],
				default: '',
				description: 'Only return pages published in this period',
			},
		],
	},
];
