# Changelog

## [Refactor] Phase 6.3 — App extraction: router.js
Date: 2026-04-25

src/app/router.js created (1474 lines): merges Script 0 (DOMContentLoaded
closure) and Script 1 (prepare-module) from index.html into a single ES module.
Contains all override state, wind/GPS handlers, calculate(), buildClubUI,
compass/drag, switchTab, wireMgNav, profile/course/restore IIFEs, and all
window.* bridge assignments. DOMContentLoaded wrapper removed — ES module
deferred execution makes it unnecessary.

index.html reduced from 2164 to 683 lines. Sole remaining script tag:
<script type="module" src="src/app/router.js"></script>
Zero function bodies remain in index.html.

## [Refactor] Phase 6.2 — App extraction: rounds.js
Date: 2026-04-25

src/app/rounds.js created (843 lines): showMgSub, showMgHub, refreshMgHub,
renderMgStatTiles, renderMgScoreBreakdown, renderMgBaseline,
renderMgAvgStrokesBreakdown, renderMgPuttsBreakdown, renderMgRoundsHistory,
renderMgRecentRounds, renderMgCarryBars, renderSavedRounds.
Imports from storage, engine, and intra-app import of renderCourseList
from courses.js (same layer, no circular dependency).

index.html Script 1: added import from rounds.js; removed 13 function bodies
and escHtml; added window.showMgSub exposure (Script 0 reads it at line 925);
removed loadBag, loadRounds, deleteRound, clubs, interpolate, decodeStrategy
imports (now owned by rounds.js).

index.html reduced from 3067 to 2164 lines.

## [Refactor] Phase 6.1 — App extraction: courses.js
Date: 2026-04-25

src/app/courses.js created (220 lines): computeHoleBaseline, blendedScore,
applyHoleToPlay, loadCourseIntoPlay, deleteCourse, renderCourseList, openEditor.
Imports from storage only. Cross-layer UI calls use window.* reads (transitional):
window.syncChipRow, window.renderPlayCourseBar, window.renderScoreEntry,
window.switchTab, window.calculate, window.updateCalcButtonVisibility,
window.renderSavedRounds.

index.html Script 1: added import from courses.js; removed 8 function bodies;
stripped unused storage imports (saveCourses, deleteAllRoundsForCourse,
saveActiveCourse, saveRound, saveScores, clearScores, getCommittedStrategies,
setCommittedStrategies, removeCommittedStrategies, clearActiveCourse, clearTeeState);
added window.syncChipRow and window.renderPlayCourseBar exposures.

index.html reduced from ~3291 to 3067 lines.

## [Refactor] Phase 5 — UI extraction
Date: 2026-04-24

src/ui/carousel.js: renderPlan (ctx pattern — all module-level state passed as ctx object),
updateWindSectionStatus, updateWindBreakdown, syncChipRow, wireChipRow, crosswindSide.
window._switchStrategyCard and window._carouselGoToCard fully retired (now local refs).

src/ui/scorecard.js: renderPlayCourseBar, renderScoreEntry, showRoundCompleteOverlay,
_dismissRoundComplete (private), hideScorefab, scoreCssClass (private).
window.applyHoleToPlay, window.renderSavedRounds, window.loadCourseIntoPlay,
window.renderScoreEntry, window.showRoundCompleteOverlay exposed from Script 1.

src/ui/sheets.js: openClubPicker, closeClubPicker, openCoursePicker, closeCoursePicker,
wireCoursePickerEvents. _cpDragCleanup moved from window.* to module-level let.
window._openClubPicker, window._closeClubPicker, window._cpDragCleanup fully retired.

Bug during extraction: wireCoursePickerEvents() was placed in Script 0 body (does not
import it) instead of Script 1 — course picker was silent. Fixed by moving call to Script 1.

index.html reduced from ~8300 lines to ~3290 lines across all phases.

## [Refactor] Phase 4 — Engine extraction
Date: 2026-04-24

src/engine/clubs.js: relCarry table, rollSoft/rollFirm, clubOrder, idx7,
idxPW, clubMap, getRollFactor(key, conditions) — pure, conditions passed as arg.

src/engine/calculations.js: WIND_ADJ, ALT_FACTORS, EXPECTED_STROKES,
windCategory, tempCarryFactor, applyWind, windAdjustedRoll, interpolate,
expectedStrokesRemaining (holeHcpAdj added as 7th param — was module-scoped var),
getValidTeeClubs, findBestContinuation (holeHcpAdj added as 9th param),
calcPar3, decodeStrategy, strategyDisplayName. Imports from clubs.js only.

Both scripts now import directly from engine. No window.clubs, window.decodeStrategy,
window.strategyDisplayName remain. getRollFactor callers pass conditions explicitly.

## [Refactor] Phase 3 — Platform extraction
Date: 2026-04-24

src/platform/gps.js created: exports teeMarked, completedShots (live bindings),
haversine, averagedPosition, clearGpsState, markTeePosition, recordShot,
restoreGpsState, getGpsSnapshot. Both script blocks import directly — no window.*
for GPS state. Object.defineProperty on window.lastParValue removed (Safari rule);
replaced with explicit window.lastParValue sync after each assignment.

src/platform/weather.js created: exports fetchWind (Open-Meteo) and
fetchLocationName (Nominatim). windRefresh handler simplified to Promise.all.

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
