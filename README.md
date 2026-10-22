# Pethost templates

The one-click apps of [Pethost](https://pethost.dev), a small cloud for personal projects. Each
template is an app's Docker Compose file, written for Pethost, and the few values it needs.

[pethost.dev/templates](https://pethost.dev/templates/) has a page for each, with a button that
deploys it, and the panel lists them all in New project, under “From a template”. A template
merged here is on both within about 15 minutes.

## What a template is

A directory named by the template's id, which is also the project's id and the start of its
address: lower-case letters and digits, with hyphens between them (`uptime-kuma`). It holds three
files:

- `compose.yaml`: the app's services, as Pethost runs them;
- `logo.svg`: the app's own logo, or `logo.png`, 128 pixels wide, where the app's project draws
  none in vector;
- `template.json`: its name, its emoji, its page, its variables, and its texts.

### template.json

```json
{
	"name": "Vikunja",
	"emoji": "✅",
	"category": "productivity",
	"alternatives": ["Todoist", "Trello"],
	"plan": "starter",
	"route": { "service": "vikunja", "port": 3456 },
	"variables": [
		{ "name": "URL", "from": "url" },
		{ "name": "JWT_SECRET", "secret": 32 }
	],
	"texts": {
		"en": {
			"description": "To-do lists and projects, with kanban and Gantt views",
			"notes": "Open the address and register your account. …",
			"sizing": "Light: it takes little memory, and its database grows slowly.",
			"summary": "Self-host Vikunja, an open-source to-do and project app, …",
			"about": ["Vikunja is …", "…"],
			"faq": [{ "q": "Is Vikunja free?", "a": "Yes. …" }]
		}
	}
}
```

- `name`: the app's own name.
- `emoji`: the project's emoji in the panel.
- `category`: one of `categories.json`.
- `alternatives`: the products people run the app instead of, as their makers write them; the
  page says “A self-hosted alternative to …”. Empty when it stands in for none.
- `plan`: the smallest of Pethost's plans the app runs well on, with room to be used:
  `starter`, `grow` or `scale`.
- `route`: the service and the port whose page the project's address shows, with HTTPS. Left
  out when the app has no page.
- `variables`: what the project's `.env` holds. Each takes its value from one of:
  - `"from": "url"`: the project's address, `https://vikunja.yourname.pethost.app`; `"from":
    "host"`: the same without `https://`;
  - `"secret": 32`: so many random bytes, written in hex, so twice as many characters;
  - `"ask": "adminPassword"`: what the person types into one of the fields of `fields.json`.
    `"optional": true` lets them leave it empty, where the app runs without it.
- `texts`: in every language of `languages.json`:
  - `description`: what the app is, in a line. It stands under the app's name in the list, and
    becomes the project's description.
  - `notes`: what to do first once the app is up. The project's notes start with it, and
    `{host}` in it stands for the project's address.
  - `sizing`: how much memory the app takes and how fast its data grows, roughly, in a short
    sentence. With `plan`, it answers the page's question of what the app needs.
  - `summary`: what a search engine shows of the app's page, 155 characters at most.
  - `about`: what the app is, who uses it, what it does and what this template runs, in a few
    paragraphs of plain text, for the page's “What is …?”.
  - `faq`: the questions people ask about the app, three at least, each answer standing on its
    own.

  `sizing`, `summary`, `about` and `faq` are the page's on pethost.dev only: the panel reads
  none of them.

  The app's name, the names of its pages, buttons and settings, its commands and its variables
  are written as the app writes them, in every language.

### compose.yaml

- An image is named by the line the app's project publishes (a major or a minor version), and by
  an exact release where it publishes no line.
- The app's data is kept in named volumes: Pethost backs them up every night.
- No port is published for the app's page: the route serves it. A port that is no web page, such
  as a game's or a mail server's, is published as the app needs it.
- A variable is read as `${NAME}`, or by `env_file: .env`.

Pethost runs the file as it is written, or refuses it and says what to write instead.

### Beside the templates

- `languages.json`: the languages every text is written in, the ones pethost.dev and the panel
  speak.
- `fields.json`: what a template may ask the person for: each field's label in every language,
  and its `type` (`password` is one the person makes up, `key` is one a service gave them; both
  are typed unseen) and `placeholder`. A new kind of field is a new entry.
- `categories.json`: the kinds of apps, each with a page that lists its templates: its `name`,
  its `title`, its `summary` and its `intro` in every language. A slug is no template's id.
- `order.json`: the templates listed first, in this order. The rest follow by id.
- `catalog.mjs`: reads all of it for pethost.dev's build, and checks it: `node catalog.mjs`.

## Adding a template

1. Write the three files. Write the texts in English: we add the other languages before the
   merge, so the check asks for them until then.
2. Run `node catalog.mjs` (Node 22 or newer). It says what is wrong, if anything.
3. Deploy it: on a Pethost machine, as a project from compose.yaml with the `.env` its variables
   make, or with `docker compose up`. Open its page, sign in if the app has accounts, restart it,
   and see that its data is still there. `docker stats` says roughly what memory it takes, for
   its `plan`.
4. Open a pull request, and say what you checked.

A change to a template is checked the same way. A pull request that brings an app no one can
use without paying for something else, or that holds what the app's license does not let us
publish, is closed.

## License

MIT. The apps' names and logos are their owners' trademarks.
