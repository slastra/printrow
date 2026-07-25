# printrow

A label template designer that prints against CSV data over Web Bluetooth — no drivers, no servers, no installs. Design a 50×30 mm label in a Canva-style editor, bind `{{variables}}` to CSV columns, and batch-print to a Y50P thermal printer straight from the browser.

## How it works

The Y50P speaks a proprietary framed binary protocol (reverse-engineered against hardware captures; independently confirmed on a sibling device by [Souukou/OpenBluetoothPrinter](https://github.com/Souukou/OpenBluetoothPrinter)). The printer has no fonts or barcode symbologies — it accepts nothing but a 400×240 1-bit bitmap, so **everything renders host-side and the editor preview is bit-identical to what prints**:

- A zod model is the single source of truth; Konva renders it — the same node builder drives the editor canvas and the print rasterizer.
- Text, images, and barcodes render at the printer's true 203 dpi with a hard 1-bit threshold (Atkinson dithering for photos), so the on-screen dot grid *is* the label.
- Barcodes (bwip-js) snap their module grid to whole printer dots at any element size — crisp on screen, scanner-accurate on paper.
- Transport: BLE GATT writes in 20-byte chunks with pacing, bidirectional status (cover open / out of paper) between batch labels.

## Stack

SvelteKit 2 · Svelte 5 runes · Tailwind 4 · shadcn-svelte · Konva · zod · bwip-js · bun

## Development

```bash
bun install
bun run dev        # http://localhost:5173
bun test src       # unit tests (protocol vectors, CSV, geometry, schema)
bun run check      # svelte-check
```

## Web Bluetooth notes

- Chrome on **Linux** needs `chrome://flags/#enable-web-bluetooth` (and optionally `#enable-web-bluetooth-new-permissions-backend` for scan-free reconnects). ChromeOS has it on by default.
- Requires a secure context — `localhost` or https.
- Discovery filters by device name, never by service UUID: a service-UUID filter crashes BlueZ 5.87 on desktop Linux.
