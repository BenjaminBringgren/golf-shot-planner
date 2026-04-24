# Changelog

## [Fix] Post-Phase-2 module isolation bugs
Date: 2026-04-24

Bug 2: blendedScore and computeHoleBaseline defined in Script 1 module scope
were called bare from Script 0's computePlan/renderPlan. ES module isolation
means they are not globally accessible — caused silent ReferenceError preventing
strategy cards from rendering after course load. Fix: window.blendedScore and
window.computeHoleBaseline exposed from Script 1.

Bug 9: endDrag fired on tap-without-drag (touchstart+touchend, no touchmove),
saving windState.holeDeg=null via saveWindPrefs. JSON.stringify serialises null
as null, overwriting any previously persisted compass direction. Fix: saveWindPrefs
guards against null/non-finite holeDeg and skips the write.

## [Refactor] Phase 2 — Storage extraction
Date: 2026-04-24

All localStorage/sessionStorage access extracted from index.html to src/storage/storage.js.
Both script blocks converted to type="module". Cross-script globals (gpsTeeSetState,
gpsBallSetState, renderScoreEntry, overrides) explicitly assigned to window.*. Zero
live storage calls remain in index.html; 38 in storage.js only.

## [Refactor] Five-layer modular restructure
Date: 2026-04-24

Single-file index.html split into five-layer ES module architecture. See REFACTOR.md for full specification.
