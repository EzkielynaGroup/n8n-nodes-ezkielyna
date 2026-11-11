'use strict';
// The AI Agent sub-node: config mapping and a real call through the n8n AI node SDK
// (dev dependency here, provided by n8n at runtime) against the local mock gateway.
const test = require('node:test');
const assert = require('node:assert/strict');

const { LmChatEzkielyna, buildModelConfig } = require('../dist/nodes/LmChatEzkielyna/LmChatEzkielyna.node.js');
const { EzkielynaApi } = require('../dist/credentials/EzkielynaApi.credentials.js');
const { FAKE_KEY, createContext, startMockGateway } = require('./helpers');

let gw;
test.before(async () => {
	gw = await startMockGateway();
});
test.after(async () => {
	await gw.close();
});

test('buildModelConfig maps credentials and options with safe defaults', () => {
	assert.deepEqual(buildModelConfig({ apiKey: 'k', baseUrl: 'https://api.ezkielyna.store/v1/' }, 'deepseek-v4.1-flash', {}), {
		type: 'openai',
		baseUrl: 'https://api.ezkielyna.store/v1',
		apiKey: 'k',
		model: 'deepseek-v4.1-flash',
		temperature: 0.7,
		maxRetries: 2,
		timeout: 120000,
		maxTokens: 1024,
	});
	const custom = buildModelConfig({ apiKey: 'k', baseUrl: 'x' }, 'm', {
		maxTokens: -1,
		temperature: 0,
		topP: 0.9,
		frequencyPenalty: 0.5,
		presencePenalty: -0.5,
		timeout: 5000,
		maxRetries: 0,
	});
	assert.equal('maxTokens' in custom, false);
	assert.equal(custom.temperature, 0);
	assert.equal(custom.topP, 0.9);
	assert.equal(custom.frequencyPenalty, 0.5);
	assert.equal(custom.presencePenalty, -0.5);
	assert.equal(custom.maxRetries, 0);
});

test('node description: AI language model output, no inputs, model dropdown', () => {
	const d = new LmChatEzkielyna().description;
	assert.deepEqual(d.inputs, []);
	assert.deepEqual(d.outputs, ['ai_languageModel']);
	assert.equal(d.credentials[0].name, 'ezkielynaApi');
	const model = d.properties.find((p) => p.name === 'model');
	assert.equal(model.default, 'deepseek-v4.1-flash');
	assert.equal(model.typeOptions.loadOptionsMethod, 'getChatModels');
});

test('supplyData returns a chat model that calls the gateway with the key', async () => {
	const node = new LmChatEzkielyna();
	const ctx = createContext({
		params: { model: 'deepseek-v4.1-flash', options: { maxTokens: 64, temperature: 0.1 } },
		credentials: { apiKey: FAKE_KEY, baseUrl: gw.baseUrl },
		credentialType: new EzkielynaApi(),
	});
	// the extra hooks the SDK's tracing/retry callbacks use
	// n8n passes its egress (SSRF) filter here; the pass-through one keeps the test on localhost.
	const egressPath = require.resolve('@n8n/backend-network/egress', {
		paths: [require.resolve('@n8n/ai-utilities', { paths: [require.resolve('@n8n/ai-node-sdk')] })],
	});
	ctx.helpers.getSecureEgressFilter = () => require(egressPath).passthroughEgressFilter;
	ctx.getNextRunIndex = () => 0;
	ctx.addInputData = () => ({ index: 0 });
	ctx.addOutputData = () => undefined;
	ctx.getExecutionCancelSignal = () => undefined;
	ctx.logger = { debug() {}, info() {}, warn() {}, error() {} };
	ctx.getParentNodes = () => [];
	ctx.getWorkflow = () => ({ id: 'w1', name: 'test' });
	ctx.getExecutionId = () => 'e1';
	ctx.sendMessageToUI = () => undefined;
	ctx.getMode = () => 'manual';

	const supplied = await node.supplyData.call(ctx, 0);
	const model = supplied.response;
	assert.ok(model, 'supplyData returned a model');
	const reply = await model.invoke([{ role: 'user', content: 'Halo agent' }]);
	const req = gw.requests.find((r) => r.path === '/v1/chat/completions' && r.body && r.body.messages.some((m) => m.content === 'Halo agent'));
	assert.ok(req, 'the model called /v1/chat/completions on the configured base URL');
	assert.equal(req.headers.authorization, `Bearer ${FAKE_KEY}`);
	assert.equal(req.body.model, 'deepseek-v4.1-flash');
	assert.equal(req.body.temperature, 0.1);
	assert.equal(req.body.max_tokens ?? req.body.max_completion_tokens, 64);
	assert.equal(reply.content, 'echo: Halo agent');
});

test('model dropdown on the sub-node hides blocked and non-chat models', async () => {
	const ctx = createContext({
		credentials: { apiKey: FAKE_KEY, baseUrl: gw.baseUrl },
		credentialType: new EzkielynaApi(),
	});
	const options = await new LmChatEzkielyna().methods.loadOptions.getChatModels.call(ctx);
	assert.deepEqual(options.map((o) => o.value), ['deepseek-v4.1-flash', 'glm-4.5']);
});
