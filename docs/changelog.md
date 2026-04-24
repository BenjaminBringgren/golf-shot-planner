# Changelog

## [Refactor] Phase 2 — Storage extraction
Date: 2026-04-24

All localStorage/sessionStorage access extracted from index.html to src/storage/storage.js.
Both script blocks converted to type="module". Cross-script globals (gpsTeeSetState,
gpsBallSetState, renderScoreEntry, overrides) explicitly assigned to window.*. Zero
live storage calls remain in index.html; 38 in storage.js only.

## [Refactor] Five-layer modular restructure
Date: 2026-04-24

Single-file index.html split into five-layer ES module architecture. See REFACTOR.md for full specification.
