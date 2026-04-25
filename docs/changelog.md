# Changelog

## [Refactor] window.* fully retired — Category A cleanup
Date: 2026-04-25

All remaining window.* assignments and reads removed from the codebase.
Final count: 0 assignments, 0 reads (excluding native browser APIs like window.scrollTo).

A3 — Override objects: exported clearAllOverrides / clearRoundOverrides / clearGpsOverrides
from router.js. Passed as callbacks to renderPlayCourseBar, renderScoreEntry,
showRoundCompleteOverlay / _dismissRoundComplete. scorecard.js uses callbacks.clearXxx?.()
instead of mutating override objects via window.*.

A4 — window._lastClubsList: removed. openClubPicker gains a 4th clubsList param.
router.js renderPlan ctx binds plan.clubsList in the openClubPicker wrapper.

A2 — window.loadCourseIntoPlay in sheets.js: removed. wireCoursePickerEvents now
accepts an onCourseSelect callback (loadCourseIntoPlay passed from router.js).

A1 — All remaining bridge items (12 callbacks):
- courses.js: initServices(svc) injected from router.js. _svc.syncChipRow,
  _svc.switchTab, _svc.renderPlayCourseBar, _svc.renderScoreEntry,
  _svc.updateCalcButtonVisibility, _svc.calculate, _svc.renderSavedRounds
  replace window.* reads.
- scorecard.js: all window.gpsTeeSetState, window.gpsBallSetState,
  window.calculate, window.renderSavedRounds, window.updateHoleCardMode,
  window.updateLoadCourseBtn, window.updateCalcButtonVisibility,
  window.applyHoleToPlay, window.renderScoreEntry reads replaced with
  callbacks.*?.() using the extended callbacks object.
- window.switchTab converted from window assignment to named function.
- buildCallbacks() factory function in router.js provides a consistent
  callbacks object to all UI function call sites.

## [Refactor] Category C window.* cleanup
Date: 2026-04-25

Removed 9 self-referential window.* assignments from router.js that had no
external readers (all callers were within router.js itself):

- window.getScoringMode — removed; getScoringMode called directly
- window.lastParValue — removed (init + 2 update sites); lastParValue local var used directly
- window.blendedScore, window.computeHoleBaseline — removed; renderPlan ctx now
  passes the functions directly instead of via window
- window.showRoundCompleteOverlay — removed; called directly in wireActionRow
- window.showMgSub — removed; bagCompleteHintBtn listener calls showMgSub directly
- window.updateBagCompleteHint — removed; unused externally
- window.toggleWindPanel — converted from window assignment + inline onclick to a
  named function wired with addEventListener. onclick="window.toggleWindPanel(event)"
  removed from index.html windToggle element.

window.* assignments: 40 → 16. Zero window.* in onclick attributes.
Verified on iPhone Safari: wind panel, bag hint, round complete overlay, calculate.

## [Audit] Phase 6 completion audit
Date: 2026-04-25

Layer integrity verified post-refactor:
- src/engine/: zero DOM, zero storage, zero network — PASS
- src/storage/: zero imports — PASS
- src/platform/: zero imports — PASS
- Object.defineProperty: zero — PASS
- Raw storage key strings outside storage.js: zero — PASS
- Import statements missing .js extensions: zero — PASS
- window.* assignments: router.js only (40, intentional bridge) — PASS
  Exception: scorecard.js lines 733/740 write window._inRough — known debt

Deviations from REFACTOR.md discovered during refactor:
1. window.* not fully retired. router.js uses 40 window.* assignments as a
   bridge layer (UI modules read window.calculate, window.switchTab etc. since
   they cannot import upward from app layer). scorecard.js has 2 remaining
   window._inRough writes. Documented as known debt; REFACTOR.md target of
   full retirement is a future milestone.
2. roundScores_<courseId> uses localStorage (not sessionStorage). The prior
   docs/localStorage.md described it as sessionStorage — corrected.
3. Splash input type="number" with min/max is not safe on iOS. iOS clears the
   value for intermediate inputs below min (e.g. "2" while typing "230"),
   breaking the input event. Changed to type="text" inputmode="numeric".
4. ES module files must not contain </script> tags even if extracted from
   inline script blocks — two stray tags caused a SyntaxError at parse time.

All checks verified on iPhone Safari: tab switching, calculate, carousel,
wind fetch/apply, GPS mark/reset on hole switch, score drawer, course load,
hole navigation, saved rounds.

## [Refactor] Phase 6.3 — App extraction: router.js
Date: 2026-04-25

src/app/router.js created (1475 lines): merges Script 0 (DOMContentLoaded
closure) and Script 1 (prepare-module) from index.html into a single ES module.
Contains all override state, wind/GPS handlers, calculate(), buildClubUI,
compass/drag, switchTab, wireMgNav, profile/course/restore IIFEs, and all
window.* bridge assignments. DOMContentLoaded wrapper removed — ES module
deferred execution makes it unnecessary.

index.html reduced from 2164 to 683 lines. Sole remaining script tag:
<script type="module" src="src/app/router.js"></script>
Zero function bodies remain in index.html.

Two bugs fixed during extraction:
1. Two stray </script> tags from the original inline script blocks were left
   in router.js, causing a JavaScript SyntaxError that prevented the module
   from loading entirely.
2. Splash input was type="number" min="50" max="350" — iOS Safari clears the
   value for intermediate inputs below min (e.g. "2" while typing "230"),
   making parseInt return NaN and the enable-button listener never fire.
   Fixed by changing to type="text" inputmode="numeric" pattern="[0-9]*" and
   adding a change event listener alongside input.

Verified on iPhone Safari: tab switching, calculate, carousel, wind fetch,
GPS mark/reset, score drawer, course load, hole navigation, saved rounds.

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
