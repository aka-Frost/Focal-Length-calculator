# FocalCalc

A minimal, offline-capable camera focal length converter. Plain HTML, CSS and JavaScript — no frameworks, no backend, no build step.

## What it does

| Mode | Input | Output |
| --- | --- | --- |
| **Single** | Actual focal length | Full-frame equivalent and zoom multiplier |
| **Range** | Shortest and longest focal length (e.g. 16–50mm) | Full-frame range and zoom range |
| **Reverse** | Desired zoom multiplier (e.g. 3×) | Full-frame equivalent and the actual focal length you need on your sensor |

**Formulas**

```
Full-frame equivalent = actual focal length × crop factor
Zoom multiplier       = full-frame equivalent ÷ 1× reference focal length
Actual focal length   = (zoom × reference) ÷ crop factor        (reverse mode)
```

Example: a 17mm lens on a 1.5× APS-C body, with 24mm as 1× → 17 × 1.5 = 25.5mm equivalent → 25.5 ÷ 24 = **1.06×**.

**Sensor presets:** Full Frame (1×), Sony/Nikon APS-C (1.5×), Canon APS-C (1.6×), Micro Four Thirds (2×), or a custom crop factor. The 1× reference defaults to 24mm and can be changed. Decimals work (a comma is also accepted as a decimal separator). Settings are remembered between visits.

## Project structure

```
focalcalc/
├── index.html          Page markup
├── style.css           Dark theme, responsive layout
├── script.js           Calculations, validation, copy/reset, PWA install
├── manifest.json       PWA metadata (name, icons, colours)
├── service-worker.js   Offline caching
└── assets/
    ├── icon.svg
    ├── icon-192.png
    ├── icon-512.png
    ├── icon-maskable-512.png
    └── apple-touch-icon.png
```

## Run it locally

Service workers only run on `http://localhost` or HTTPS, so don't open `index.html` by double-clicking. Start a tiny local server instead. From inside the `focalcalc` folder, use any one of:

```bash
python3 -m http.server 8080      # Python
npx serve -l 8080                # Node
```

Then open <http://localhost:8080> in your browser.

To check offline mode: load the page once, open DevTools → **Application** → **Service Workers**, tick **Offline**, and reload.

## Install on Android

Chrome on Android only offers installation over **HTTPS**, so pick one of these routes.

### Option A — Host it (recommended)

1. Upload the `focalcalc` folder to any static host with HTTPS, such as GitHub Pages, Netlify, Cloudflare Pages or Vercel. It can live in a sub-folder; all paths are relative.
2. Open the site in **Chrome** on your Android phone.
3. Tap the **Install** button in the app header, or open Chrome's **⋮** menu and choose **Install app** (or **Add to Home screen**).
4. FocalCalc appears in your app drawer and launches full-screen. After the first load it works with no connection.

### Option B — Test straight from your computer over USB

1. On the phone, enable **Developer options** and **USB debugging**, then connect it to your computer.
2. Start the local server (see above) on port 8080.
3. In a terminal, run `adb reverse tcp:8080 tcp:8080`.
4. Open `http://localhost:8080` in Chrome on the phone. `localhost` counts as secure, so the install option appears.

## Updating the app

Installed copies keep serving cached files. After you change anything, open `service-worker.js` and increase `CACHE_VERSION` (for example `'v1'` → `'v2'`). The new version is picked up the next time the app is opened.

## Customising

- **Default sensor, reference focal length or starting tab:** edit `DEFAULTS` at the top of `script.js`.
- **Add a sensor preset** (for example 1-inch, 2.7×): add a line to `PRESETS` in `script.js`. It shows up in the dropdown automatically.
- **Colours:** change the variables in `:root` at the top of `style.css`.
