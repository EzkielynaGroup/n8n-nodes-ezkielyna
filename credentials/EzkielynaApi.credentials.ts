import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

export class EzkielynaApi implements ICredentialType {
	name = 'ezkielynaApi';

	displayName = 'Ezkielyna API';

	icon: Icon = { light: 'file:../icons/ezkielyna.svg', dark: 'file:../icons/ezkielyna.dark.svg' };

	documentationUrl =
		'https://github.com/EzkielynaGroup/n8n-nodes-ezkielyna?tab=readme-ov-file#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'Key from api.ezkielyna.store → API Keys (starts with sk-). The key group decides which models it can use.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			required: true,
			default: 'https://api.ezkielyna.store/v1',
			description: 'OpenAI-compatible base URL, including /v1. Change it only for testing.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}',
			url: '/models',
			method: 'GET',
		},
	};
}
