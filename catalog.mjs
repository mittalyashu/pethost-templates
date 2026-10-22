// The templates of this repository, read and checked: what pethost.dev's build reads to draw a
// page per template and the catalog the Pethost panel's New project lists, and what every pull
// request is checked with.
//
//   node catalog.mjs          checks the templates, and says what is wrong
//
// A template is a directory named by its id: compose.yaml, logo.svg or logo.png, and
// template.json (README.md says what each holds). Beside them: languages.json, the languages
// every text is written in; fields.json, the fields a template may ask the person to fill in;
// categories.json, the kinds of apps a template is listed under; order.json, the templates listed
// first, in that order, before the rest by id.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** A template's id: also the project's, and the first name of its address. */
const idRule = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const idLength = 40;

/** A variable's name in the project's .env. */
const variableRule = /^[A-Z][A-Z0-9_]*$/;

/** Random bytes a secret may be made of, written in hex: twice as many characters. */
const secretBytes = { min: 8, max: 64 };

/** What a search result shows under a page's title, at most: a longer one is cut. */
const summaryLength = 155;

/** Pethost's plans, smallest first: a template's page says which one the app fits. */
const plans = ['starter', 'grow', 'scale'];

const templateKeys = ['name', 'emoji', 'category', 'alternatives', 'plan', 'route', 'variables', 'texts'];

/** The templates in their order, each with its compose.yaml's text and its logo's file name, and
 *  what they share: the languages, the fields and the categories. Throws with every problem
 *  found. */
export function readCatalog(dir) {
	const problems = [];
	const read = (file) => readJson(join(dir, file), file, problems);

	const languages = read('languages.json') ?? [];
	const fields = read('fields.json') ?? {};
	const categories = read('categories.json') ?? {};
	const order = read('order.json') ?? [];
	checkFields(fields, languages, problems);

	const ids = readdirSync(dir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
		.map((entry) => entry.name)
		.sort();
	checkOrder(order, ids, problems);
	checkCategories(categories, languages, ids, problems);

	const listed = [...order.filter((id) => ids.includes(id)), ...ids.filter((id) => !order.includes(id))];
	const templates = listed.map((id) => readTemplate(dir, id, { languages, fields, categories }, problems));

	if (problems.length > 0) throw new Error(`The templates have ${problems.length} problems:\n${problems.join('\n')}`);
	return { languages, fields, categories, templates };
}

function readTemplate(dir, id, shared, problems) {
	const own = (problem) => problems.push(`${id}: ${problem}`);
	if (!idRule.test(id) || id.length > idLength) own(`the id is lower-case letters and digits, with hyphens between them, ${idLength} at most`);

	const files = readdirSync(join(dir, id));
	const logos = files.filter((file) => file === 'logo.svg' || file === 'logo.png');
	const extra = files.filter((file) => !['compose.yaml', 'template.json', 'logo.svg', 'logo.png'].includes(file));
	if (logos.length !== 1) own('has logo.svg or logo.png, one of them');
	if (extra.length > 0) own(`has only compose.yaml, template.json and the logo, not ${extra.join(', ')}`);

	const compose = existsSync(join(dir, id, 'compose.yaml')) ? readFileSync(join(dir, id, 'compose.yaml'), 'utf8') : '';
	if (!compose) own('has no compose.yaml');

	const template = readJson(join(dir, id, 'template.json'), `${id}/template.json`, problems) ?? {};
	checkTemplate(template, compose, shared, own);

	return { id, ...template, compose, logo: logos[0] };
}

function checkTemplate(template, compose, { languages, fields, categories }, own) {
	for (const key of Object.keys(template)) {
		if (!templateKeys.includes(key)) own(`template.json has no ${key}: it has ${templateKeys.join(', ')}`);
	}
	if (!text(template.name)) own('name is the app’s own name');
	if (!text(template.emoji)) own('emoji is the project’s emoji');
	if (!(template.category in categories)) own(`category is one of categories.json: ${Object.keys(categories).join(', ')}`);
	if (!Array.isArray(template.alternatives) || !template.alternatives.every(text))
		own('alternatives is a list of the products the app stands in for, empty when it stands in for none');
	if (!plans.includes(template.plan)) own(`plan is the smallest plan the app runs well on: ${plans.join(', ')}`);
	if (template.route !== undefined) checkRoute(template.route, compose, own);

	if (!Array.isArray(template.variables)) own('variables is a list, empty when the app needs none');
	else checkVariables(template.variables, compose, fields, own);

	checkTexts(template.texts, languages, own);
}

function checkRoute(route, compose, own) {
	if (!text(route.service) || !Number.isInteger(route.port) || route.port < 1 || route.port > 65535)
		own('route is the service and the port its page is served at: {"service": "app", "port": 8080}');
	else if (!new RegExp(`^  ${route.service}:`, 'm').test(compose)) own(`route names ${route.service}, a service compose.yaml lacks`);
}

function checkVariables(variables, compose, fields, own) {
	// A service with env_file: .env reads every variable.
	const readsAll = /env_file:/.test(compose);
	const names = new Set();
	for (const variable of variables) {
		const { name, ...source } = variable;
		const where = `variable ${name}`;
		if (!variableRule.test(name ?? '')) own(`${where}: a name is capitals, digits and underscores`);
		if (names.has(name)) own(`${where} is listed twice`);
		names.add(name);

		if (!readsAll && !new RegExp(`\\$\\{?${name}\\b`).test(compose)) own(`${where} is read nowhere in compose.yaml`);
		checkSource(source, fields, (problem) => own(`${where}: ${problem}`));
	}
}

/** Where a variable's value comes from: the project's address, random bytes, or a field. */
function checkSource(source, fields, own) {
	const kinds = ['from', 'secret', 'ask'].filter((kind) => kind in source);
	if (kinds.length !== 1) return own('has one of from, secret and ask');

	const allowed = { from: ['from'], secret: ['secret'], ask: ['ask', 'optional'] }[kinds[0]];
	const extra = Object.keys(source).filter((key) => !allowed.includes(key));
	if (extra.length > 0) own(`has no ${extra.join(', ')}`);

	if ('from' in source && !['url', 'host'].includes(source.from)) own('from is "url" or "host"');
	if ('secret' in source && !(Number.isInteger(source.secret) && source.secret >= secretBytes.min && source.secret <= secretBytes.max))
		own(`secret is a number of random bytes, from ${secretBytes.min} to ${secretBytes.max}`);
	if ('ask' in source && !(source.ask in fields)) own(`ask is a field of fields.json: ${Object.keys(fields).join(', ')}`);
	if ('optional' in source && source.optional !== true) own('optional is true, or left out');
}

function checkTexts(texts, languages, own) {
	if (typeof texts !== 'object' || texts === null) return own('texts has the app’s texts in every language');

	for (const code of languages) {
		const { description, notes, sizing, summary, about, faq, ...extra } = texts[code] ?? {};
		const where = `texts.${code}`;
		if (!text(description)) own(`${where}.description is missing`);
		if (!text(notes)) own(`${where}.notes is missing`);
		if (/\{(?!host\})[^}]*\}/.test(notes ?? '')) own(`${where}.notes holds no {…} but {host}`);
		if (!text(sizing)) own(`${where}.sizing is missing`);
		checkSummary(summary, `${where}.summary`, own);
		if (!Array.isArray(about) || about.length < 2 || !about.every(text)) own(`${where}.about is a list of paragraphs, two at least`);
		if (!Array.isArray(faq) || faq.length < 3 || !faq.every((item) => text(item?.q) && text(item?.a) && Object.keys(item).length === 2))
			own(`${where}.faq is a list of questions and answers, three at least: [{"q": "…", "a": "…"}]`);
		if (Object.keys(extra).length > 0) own(`${where} has only description, notes, sizing, summary, about and faq`);
	}
	for (const code of Object.keys(texts)) {
		if (!languages.includes(code)) own(`texts.${code}: ${code} is not in languages.json`);
	}
}

/** The kinds of apps: a page each, beside the templates' own pages, so a slug is no template's
 *  id. */
function checkCategories(categories, languages, ids, problems) {
	for (const [slug, category] of Object.entries(categories)) {
		const own = (problem) => problems.push(`categories.json: ${slug}: ${problem}`);
		if (!idRule.test(slug) || ids.includes(slug)) own('a slug is lower-case words with hyphens between them, and no template’s id');
		for (const code of languages) {
			if (!text(category.name?.[code])) own(`name.${code} is missing`);
			if (!text(category.title?.[code])) own(`title.${code} is missing`);
			checkSummary(category.summary?.[code], `summary.${code}`, own);
			const intro = category.intro?.[code];
			if (!Array.isArray(intro) || intro.length === 0 || !intro.every(text)) own(`intro.${code} is a list of paragraphs`);
		}
	}
}

function checkSummary(summary, where, own) {
	if (!text(summary)) own(`${where} is missing`);
	else if (summary.length > summaryLength) own(`${where} is ${summary.length} characters: a search result shows ${summaryLength}`);
}

function checkFields(fields, languages, problems) {
	for (const [name, field] of Object.entries(fields)) {
		const own = (problem) => problems.push(`fields.json: ${name}: ${problem}`);
		if (field.type !== undefined && !['password', 'key'].includes(field.type)) own('type is "password" or "key", or left out');
		if (field.placeholder !== undefined && !text(field.placeholder)) own('placeholder is a text');
		for (const code of languages) {
			if (!text(field.label?.[code])) own(`label.${code} is missing`);
		}
	}
}

function checkOrder(order, ids, problems) {
	if (!Array.isArray(order)) return problems.push('order.json is a list of ids');
	for (const id of order) {
		if (!ids.includes(id)) problems.push(`order.json: ${id} is no template here`);
	}
	if (new Set(order).size !== order.length) problems.push('order.json lists an id twice');
}

function readJson(path, name, problems) {
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch (error) {
		problems.push(`${name}: ${error.code === 'ENOENT' ? 'is missing' : error.message}`);
		return undefined;
	}
}

const text = (value) => typeof value === 'string' && value.trim() !== '';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	try {
		const { templates } = readCatalog(fileURLToPath(new URL('.', import.meta.url)));
		console.log(`${templates.length} templates, every one well.`);
	} catch (error) {
		console.error(error.message);
		process.exit(1);
	}
}
