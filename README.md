# مبدل قیمت · Price Converter

A single-page currency converter that turns any foreign-currency amount into **تومان** (Iranian toman), with an adjustable markup percentage. Fully client-side — plain HTML, CSS and JavaScript, no build step and no dependencies.

🔗 **Live demo:** https://whoisneon.github.io/price-converter/

---

## Features

- **86 currencies**, fetched live from the [Chand API](https://chand.pages.dev) — labels (Persian + English), prices and flag icons all come from the API, nothing is hardcoded.
- **Live conversion** — type an amount, get the toman value instantly.
- **Adjustable markup** — add any percentage on top of the market rate (default 20%).
- **Persian UI** — right-to-left layout, Persian digits in every input and in the result.
- **Searchable currency picker** — filter by code, Persian name or English name.
- **Number roll animation** on the result whenever the value changes.
- **Copy result** to clipboard, with a toast notification.
- **Remembers your preferences** (currency, amount, percentage) via `localStorage`.
- **Resilient fetching** — 15s timeout, abort handling, and distinct offline / server-error / CORS messages instead of a silent failure.

---

## Credits

Rates are provided by **[Chand API](https://chand.pages.dev)** — *Chand.API v1.1.0*.
Primary upstream source: **bonbast**.
This project is an independent client and is not affiliated with Chand.

---

## Tech

| Layer    | Choice                                   |
| -------- | ---------------------------------------- |
| Markup   | HTML5                                    |
| Styles   | Plain CSS (custom properties, no framework) |
| Logic    | Vanilla JavaScript (ES2020)              |
| Fonts    | Vazirmatn + Lalezar (Google Fonts)       |
| Data     | [chand.clf.dpdns.org/api](https://chand.clf.dpdns.org/api) |
| Hosting  | GitHub Pages                             |

No frameworks, no bundler, no `package.json` — clone the repo and it runs.

---

## Project structure

```
.
├── index.html        # markup shell
├── src/
│   ├── style.css     # all styling
│   └── script.js     # app logic + API integration
├── check.mjs         # lightweight sanity check (see below)
└── README.md
```

---

## Local development

It's a static site — serve the folder with any static server and open it:

```bash
# Python
python -m http.server 8080
#   → http://localhost:8080

# Node
npx serve .
#   → http://localhost:3000
```

Open `index.html` directly and it works too, though a local server is recommended.

### Sanity check

```bash
node check.mjs
```

Verifies that the currency maps stay deleted, exercises the HTML-escaping helper against hostile input, and hits the live API to confirm every currency still carries the fields the UI reads. Fails loudly if the API shape regresses.

---

## Deployment

Deployed automatically via **GitHub Pages** from the `main` branch:

1. **Settings → Pages → Build and deployment → Source:** *Deploy from a branch*
2. **Branch:** `main` / *(root)*

The live site is then served at https://whoisneon.github.io/price-converter/ .

---

## License

Released under the [MIT License](LICENSE).
