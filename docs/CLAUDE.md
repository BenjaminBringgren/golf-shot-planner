# Golf Shot Planner — Project Context for Claude Code

## What this app is
A golf shot planning tool for use on the course. Calculates
optimal shot strategies based on club distances, wind, altitude,
and course conditions. Built by Benjamin Bringgren.

## Copyright
All files must carry this header:
/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */

## Architecture — Five-Layer Rule
Dependencies flow downward only. No layer imports from a layer
above it. Ever.

  src/ui/        — DOM rendering only, no business logic
      ↓ imports down only
  src/app/       — business logic, state, navigation
      ↓ imports down only
  src/engine/    — pure functions, zero side effects,
                   no DOM, no storage, no network
      ↓ imports down only
  src/storage/   — all localStorage/sessionStorage, nothing else
      ↓ imports down only
  src/platform/  — GPS, weather fetch, raw browser APIs only

If you find yourself writing document. or localStorage. inside
src/engine/ — stop. That code belongs in a higher layer.

## Critical rules
- window.* is fully retired — no global assignments anywhere
- Never use Object.defineProperty on window (Safari bug)
- All imports use explicit .js extensions
- All localStorage key strings are named constants in
  src/storage/storage.js — never hardcoded elsewhere
- Do not alter calculation logic in src/engine/ — values are
  validated against Trackman data

## Product roadmap
Phase 1 (now): Modular web app on GitHub Pages — this codebase
Phase 2 (when ready): Capacitor wrapper → App Store
Phase 3 (if it grows): Expo / React Native native rebuild

## Key files
- REFACTOR.md — full architectural specification and history
- docs/architecture.md — layer diagram and dependency rules
- docs/localStorage.md — storage key schema
- docs/changelog.md — what changed and why

## Safari compatibility
Hard requirement. Tested on Brave and Safari on iPhone.
Never use Object.defineProperty on window.
Always test GPS reset on hole switch specifically on Safari —
this has been a recurring bug in this codebase.
