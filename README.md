# ADMX Policy Viewer

A lightweight, browser-based viewer for ADMX policy definitions.

## Features

- Tree-based navigation like Group Policy Editor
- Search with fuzzy matching (powered by Fuse.js)
- Policy details with registry path, value names, and descriptions
- Copy-to-clipboard support
- JSON view for advanced users
- No backend required

## Usage

1. Place your `policies.json` file in the same folder as `index.html`.
2. From that directory, start a local HTTP server (for example, run `python -m http.server`).
3. Open `http://localhost:8000/index.html` and explore the extracted policies.

> ⚠️ This project does not include any official ADMX/ADML files.
> Please generate your own `policies.json` using your own extraction process.

## License

Licensed under the MIT License. See [LICENSE](./LICENSE) for details.
