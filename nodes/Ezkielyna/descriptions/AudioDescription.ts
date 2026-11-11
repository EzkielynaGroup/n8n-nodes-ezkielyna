import type { INodeProperties } from 'n8n-workflow';
import { DEFAULT_STT_MODEL, DEFAULT_TTS_MODEL, DEFAULT_TTS_VOICE } from '../GenericFunctions';

const speech = { resource: ['audio'], operation: ['textToSpeech'] };
const transcribe = { resource: ['audio'], operation: ['transcribe'] };

export const audioOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['audio'] } },
		options: [
			{
				name: 'Text to Speech',
				value: 'textToSpeech',
				description: 'Turn text into a spoken audio file',
				action: 'Convert text to speech',
			},
			{
				name: 'Transcribe',
				value: 'transcribe',
				description: 'Turn an audio file into text (speech to text)',
				action: 'Transcribe audio to text',
			},
		],
		default: 'textToSpeech',
	},
];

export const audioFields: INodeProperties[] = [
	// ------------------------------------------------ text to speech
	{
		displayName: 'Model Name or ID',
		name: 'model',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getSpeechModels' },
		required: true,
		default: DEFAULT_TTS_MODEL,
		displayOptions: { show: speech },
		description:
			'Text to speech model. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		placeholder: 'e.g. Halo, pesanan kamu sudah kami kirim hari ini.',
		displayOptions: { show: speech },
		description: 'The text to read aloud (up to 4,096 characters)',
	},
	{
		displayName: 'Voice',
		name: 'voice',
		type: 'string',
		required: true,
		default: DEFAULT_TTS_VOICE,
		displayOptions: { show: speech },
		description: 'Voice name. Each model has its own voices.',
		hint: 'edge-tts Indonesian voices: id-ID-GadisNeural (female), id-ID-ArdiNeural (male)',
	},
	{
		displayName: 'Put Output File in Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		displayOptions: { show: speech },
		hint: 'The name of the output binary field to put the audio file in',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: speech },
		options: [
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				default: '',
				placeholder: 'e.g. pengumuman',
				description: 'File name without extension. Defaults to speech.',
			},
			{
				displayName: 'Response Format',
				name: 'format',
				type: 'options',
				options: [
					{ name: 'AAC', value: 'aac' },
					{ name: 'FLAC', value: 'flac' },
					{ name: 'MP3', value: 'mp3' },
					{ name: 'Opus', value: 'opus' },
					{ name: 'WAV', value: 'wav' },
				],
				default: 'mp3',
				description: 'Audio file format. Not every model supports every format; MP3 is the safest.',
			},
			{
				displayName: 'Speed',
				name: 'speed',
				type: 'number',
				typeOptions: { minValue: 0.25, maxValue: 4, numberPrecision: 2 },
				default: 1,
				description: 'Speaking speed, 1 is normal. Ignored by models that do not support it.',
			},
		],
	},

	// ------------------------------------------------ transcription
	{
		displayName: 'Model Name or ID',
		name: 'model',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getTranscriptionModels' },
		required: true,
		default: DEFAULT_STT_MODEL,
		displayOptions: { show: transcribe },
		description:
			'Speech to text model. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Input Data Field Name',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		displayOptions: { show: transcribe },
		hint: 'The name of the input binary field that holds the audio file (mp3, m4a, wav, ogg, webm; max 25 MB)',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: transcribe },
		options: [
			{
				displayName: 'Language',
				name: 'language',
				type: 'string',
				default: '',
				placeholder: 'e.g. en',
				description:
					'Language of the recording as a two-letter ISO-639-1 code. Leave empty to auto-detect.',
				hint: 'Indonesian is id, Javanese is jv, English is en',
			},
			{
				displayName: 'Output Format',
				name: 'format',
				type: 'options',
				options: [
					{ name: 'Text', value: 'json', description: 'Plain transcript in the text field' },
					{ name: 'SRT Subtitles', value: 'srt' },
					{ name: 'VTT Subtitles', value: 'vtt' },
				],
				default: 'json',
				description: 'Format of the transcript. Subtitle formats are returned as text.',
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				default: '',
				placeholder: 'e.g. Nama produk: Kopi Gayo, Tokopedia, QRIS',
				description: 'Words or names that help the model spell things correctly',
			},
		],
	},
];
