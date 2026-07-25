# printrow

**[printrow.lastra.us](https://printrow.lastra.us)** is a label designer that prints against CSV data over Web Bluetooth. No drivers, no installs, no print server: design a label in the browser, bind `{{variables}}` to CSV columns, and batch-print to a Y50P thermal printer directly from the page.

![The printrow editor: a yellow label with an icon, product name, SKU, and a Code 128 barcode, alongside the CSV column panel](docs/screenshot.jpg)

## What it does

- **Canva-style editor**: multi-select, marquee, align and distribute, groups, layer reordering by drag, free rotation, undo/redo, and middle-drag panning.
- **Elements**: text (9 bundled fonts), barcodes and QR (7 symbologies via bwip-js), images, boxes, and any of lucide's ~1,750 icons through a searchable picker.
- **CSV binding**: `{{column}}` resolves straight to a CSV column; no mapping step. Per-column formatting for text, numbers, currency (8 codes), and dates (7 patterns), stored on the template so it survives re-importing next week's file.
- **Batch printing**: print one row or all of them, with a progress bar, cancel, and a printer status check between labels so a jam or open cover stops the run instead of spooling into the void.

## How it works

The Y50P speaks a proprietary framed binary protocol, reverse-engineered against hardware captures and independently confirmed on a sibling device by [Souukou/OpenBluetoothPrinter](https://github.com/Souukou/OpenBluetoothPrinter). The printer has no fonts and no barcode symbologies. It accepts nothing but a 400×240 1-bit bitmap. Everything is rendered host-side, which is what makes the preview trustworthy:

- **A zod model is the single source of truth**; Konva is a view of it. The same node builder feeds the editor canvas and the print rasterizer, so they cannot drift.
- **The preview renders at the printer's real resolution**: 203 dpi, hard 1-bit threshold, Atkinson dithering for photos. The dot grid on screen _is_ the label, stair-steps and all.
- **Barcodes snap their module grid to whole printer dots** at any element size. Fractional modules are what make scaled barcodes both blurry and marginal under a scanner.
- **Stock colour and die-cut shape are preview-only.** The head burns black onto whatever stock is loaded; a coloured background reaching the thresholder would print the label solid black.
- **Transport**: BLE GATT writes in 20-byte chunks with pacing, with bidirectional status (ready / cover open / out of paper) polled between labels.

The wire format is unforgiving in a specific way worth knowing if you fork this: raster rows carry no length field, so a row that isn't exactly the media width shifts every following row marker and can hang the firmware. `buildStream` refuses to encode one, and the preamble is pinned byte-for-byte against a hardware capture in `protocol.spec.ts`.

## Stack

SvelteKit 2 · Svelte 5 runes · Tailwind 4 · shadcn-svelte · Konva · zod · bwip-js · lucide · bun

## Development

```bash
bun install
bun run dev        # http://localhost:5173
bun test src       # protocol vectors, CSV parsing, geometry, formatting, icon search
bun run check      # svelte-check
```

## Deploying

`nixpacks.toml` builds with Bun and starts the adapter-node server, so Coolify needs no extra configuration:

```
bun install --frozen-lockfile  →  bun run build  →  node build
```

There is no database and nothing to persist server-side (templates live in the browser's localStorage, and the printer is reached from the browser), so the server only serves assets and the SSR shell. It listens on `PORT` (the adapter defaults to 3000 on 0.0.0.0). Pushes to `main` redeploy automatically.

**Serve it over HTTPS.** Web Bluetooth only works in a secure context, so on a plain-http origin the Connect button cannot do anything at all.

## Browser support

Web Bluetooth is Chromium-only. Chrome on **Linux** additionally needs `chrome://flags/#enable-web-bluetooth` and a relaunch; `#enable-web-bluetooth-new-permissions-backend` is optional but lets a known printer reconnect with no scan. ChromeOS has it on by default. Everything except printing works in any modern browser.

Discovery deliberately filters by device name, never by service UUID: a service-UUID filter makes Chrome push a `SetDiscoveryFilter` UUID list to BlueZ, which segfaults `bluetoothd` 5.87 on desktop Linux.

## Hardware

Verified on a **Y50P** (FlashLabel), 50 × 30 mm stock at 8 dots/mm. Other media heights are safe, because the protocol never transmits height: the printer simply takes rows until the raster ends. Widths other than 50 mm follow the captured frame format but have not been tested on real stock.

## Licence

MIT
