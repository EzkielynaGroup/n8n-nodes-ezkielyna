'use strict';
// Package rules for n8n community nodes and for this repository.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('package.json follows the community node rules', () => {
	assert.match(pkg.name, /^n8n-nodes-/);
	assert.ok(pkg.keywords.includes('n8n-community-node-package'));
	assert.equal(pkg.dependencies, undefined, 'verified community nodes must not have runtime dependencies');
	assert.deepEqual(Object.keys(pkg.peerDependencies).sort(), ['@n8n/ai-node-sdk', 'n8n-workflow']);
	assert.deepEqual(pkg.files, ['dist', '!dist/tsconfig.tsbuildinfo']);
	assert.equal(pkg.license, 'MIT');
	assert.equal(pkg.n8n.strict, true);
	for (const file of [...pkg.n8n.nodes, ...pkg.n8n.credentials]) {
		assert.ok(fs.existsSync(path.join(root, file)), `${file} is built`);
	}
});

test('every node and credential class loads and is registered', () => {
	const { Ezkielyna } = require('../dist/nodes/Ezkielyna/Ezkielyna.node.js');
	const d = new Ezkielyna().description;
	assert.equal(d.name, 'ezkielyna');
	assert.equal(d.credentials[0].name, 'ezkielynaApi');
	const resources = d.properties.find((p) => p.name === 'resource').options.map((o) => o.value);
	assert.deepEqual(resources.sort(), ['audio', 'image', 'model', 'text', 'webSearch']);
	assert.ok(fs.existsSync(path.join(root, 'dist/icons/ezkielyna.svg')));
	assert.ok(fs.existsSync(path.join(root, 'dist/icons/ezkielyna.dark.svg')));
});

test('defaults match the documented ones', () => {
	const { Ezkielyna } = require('../dist/nodes/Ezkielyna/Ezkielyna.node.js');
	const props = new Ezkielyna().description.properties;
	const find = (name, op) => props.find((p) => p.name === name && p.displayOptions?.show?.operation?.includes(op));
	assert.equal(find('model', 'message').default, 'deepseek-v4.1-flash');
	assert.equal(find('model', 'textToSpeech').default, 'edge-tts');
	assert.equal(find('voice', 'textToSpeech').default, 'id-ID-GadisNeural');
	assert.equal(find('model', 'transcribe').default, 'whisper-large-v3');
});

test('example workflows are valid JSON and use only this package plus core nodes', () => {
	const dir = path.join(root, 'examples');
	const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
	assert.ok(files.length >= 2);
	for (const f of files) {
		const wf = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
		assert.ok(Array.isArray(wf.nodes) && wf.nodes.length > 0, f);
		assert.equal(typeof wf.connections, 'object', f);
		const names = new Set(wf.nodes.map((n) => n.name));
		for (const [from, outputs] of Object.entries(wf.connections)) {
			assert.ok(names.has(from), `${f}: connection from unknown node ${from}`);
			for (const list of Object.values(outputs)) {
				for (const branch of list) for (const c of branch) assert.ok(names.has(c.node), `${f}: unknown target ${c.node}`);
			}
		}
		for (const n of wf.nodes) {
			assert.match(n.type, /^(n8n-nodes-base\.|n8n-nodes-ezkielyna\.|@n8n\/n8n-nodes-langchain\.)/, `${f}: ${n.type}`);
			for (const cred of Object.values(n.credentials || {})) {
				assert.ok(typeof cred.name === 'string', `${f}: credential has a name`);
				assert.ok(Object.keys(cred).every((k) => k === 'id' || k === 'name'), `${f}: credentials hold only a reference`);
			}
		}
		const text = JSON.stringify(wf);
		assert.doesNotMatch(text, /sk-[A-Za-z0-9]{16,}/, `${f}: no key`);
		assert.doesNotMatch(text, /uncensored|abliterated|nsfw/i, `${f}: no blocked models`);
	}
});
