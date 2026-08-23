Master Cellular Tower Registry - Work Branch

Derived from the current full v91 frontend.

Removed from this branch:
- CellMapper Lookup UI
- CellMapper background/verified autofill UI
- Backup tab
- Backup page UI
- Direct CellMapper/Backup entry points are disabled

Preserved:
- Lookup
- Scan and OCR
- Registry
- Map
- Add/Edit
- Current signal grading/experience behavior
- Existing registry data/assets

The full v91 frontend remains the authoritative full build.
Backend remains v67.

Added: Add/Edit now has a Back button that returns to the tab the user came from.

Added: Save Tower now locks after the first tap, shows ✓ Saving… then ✓ Saved, and prevents accidental double-save taps from triggering the duplicate warning.

Added: Scan page now has editable Tower/Site Name plus Save All. Save All writes scan edits to the matched registry record and shows ✓ Saved after success.

CURRENT 51 OFFLINE OCR / SYNC FIX
- Fixed Current 50 cache self-deletion caused by a stale BUILD='Current 49' marker.
- Service worker now preserves its own Current 51 cache and removes only older cache generations during activation.
- OCR dependencies are version-pinned and proactively cached after the first successful online load:
  - Tesseract.js 5.1.1 browser runtime
  - Tesseract.js 5.1.1 worker
  - Tesseract core 5.1.1 non-SIMD LSTM WASM wrapper (broad Safari compatibility)
  - English best_int trained data from @tesseract.js-data
- Deprecated Project Naptha language-data URL removed.
- Screenshot OCR uses the same URLs the service worker caches, allowing the service worker to satisfy those requests offline.
- Scanner status now reports the real OCR cache count and shows “Offline scanner ready ✓ (4/4)” when complete.
- Cloud sync logic is preserved: startup sync, visibility sync, reconnect sync, 60-second foreground sync, local durable upload queue, and merged local/cloud registry.
- First-time setup still requires one successful online load so a web/PWA service worker can acquire its app and OCR assets. After “Offline scanner ready ✓ (4/4)” appears, OCR no longer requires network access for those cached assets.
