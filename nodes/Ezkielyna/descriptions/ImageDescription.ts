import type { INodeProperties } from 'n8n-workflow';
import { DEFAULT_IMAGE_MODEL } from '../GenericFunctions';

const show = { resource: ['image'], operation: ['generate'] };

export const imageOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['image'] } },
		options: [
			{
				name: 'Generate',
				value: 'generate',
				description: 'Create an image from a text prompt',
				action: 'Generate an image',
			},
		],
		default: 'generate',
	},
];

export const imageFields: INodeProperties[] = [
	{
		displayName: 'Model Name or ID',
		name: 'model',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getImageModels' },
		required: true,
		default: DEFAULT_IMAGE_MODEL,
		displayOptions: { show },
		description:
			'Image model. Needs a Media or Auto key. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		placeholder: 'e.g. Foto produk kopi susu di meja kayu, cahaya pagi, gaya minimalis',
		displayOptions: { show },
		description: 'Description of the image to create',
	},
	{
		displayName: 'Put Output File in Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		displayOptions: { show },
		hint: 'The name of the output binary field to put the image in',
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
				displayName: 'Download Image',
				name: 'download',
				type: 'boolean',
				default: true,
				description:
					'Whether to download the image as a binary file when the model returns a link instead of the file itself',
			},
			{
				displayName: 'Number of Images',
				name: 'n',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 4 },
				default: 1,
				description: 'How many images to create. Each image is billed.',
			},
			{
				displayName: 'Quality',
				name: 'quality',
				type: 'options',
				options: [
					{ name: 'Auto', value: 'auto' },
					{ name: 'High', value: 'high' },
					{ name: 'Low', value: 'low' },
					{ name: 'Medium', value: 'medium' },
				],
				default: 'auto',
				description: 'Image quality, for models that support it',
			},
			{
				displayName: 'Response Format',
				name: 'responseFormat',
				type: 'options',
				options: [
					{ name: 'Model Default', value: '' },
					{ name: 'File (Base64)', value: 'b64_json' },
					{ name: 'Link (URL)', value: 'url' },
				],
				default: '',
				description:
					'Ask the model for the file itself or for a link. Some models only support one of them.',
			},
			{
				displayName: 'Size',
				name: 'size',
				type: 'string',
				default: 'auto',
				placeholder: 'e.g. 1024x1024',
				description:
					'Image size as WIDTHxHEIGHT, for example 1024x1024 or 1024x1536. Auto lets the model choose.',
			},
		],
	},
];
