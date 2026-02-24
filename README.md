# JS Beautify for Chrome (Manifest V3)

## Folder structure

```
.
├── manifest.json
├── background.js
├── content.js
├── lib/
│   └── js-beautify.js
├── modules/
│   ├── defaults.js
│   ├── highlight.js
│   ├── storage.js
│   └── utils.js
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/
│   ├── options.html
│   ├── options.css
│   └── options.js
└── src/assets/
    ├── icon_48.png
    └── icon_128.png
```

## Install / run
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this project folder (`jsbeautify-for-chrome`)

## Usage
- Open any JavaScript file URL, e.g. `https://code.jquery.com/jquery-3.7.1.min.js`.
- Extension auto-beautifies when enabled.
- Click extension popup → **Beautify this tab** for manual mode.
- If host access is needed for a manual fetch, Chrome prompts for origin permission.
- Open Options page for formatting preferences.

## Example test URLs
- https://code.jquery.com/jquery-3.7.1.min.js
- https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js
- view-source:https://code.jquery.com/jquery-3.7.1.min.js

## Production build
This project ships pre-bundled with local files, no external CDN dependency.

To package:
1. Ensure project root contains only required extension files.
2. Zip the folder contents.
3. Upload zip in Chrome Web Store Developer Dashboard.
