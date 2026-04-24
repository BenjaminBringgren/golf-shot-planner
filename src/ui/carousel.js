/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — strategy carousel rendering, wind breakdown, chip row sync.
// No business logic. Imports from engine and storage only.

import { clubMap, idx7 } from '../engine/clubs.js';
import {
  expectedStrokesRemaining, findBestContinuation, ALT_FACTORS, tempCarryFactor,
  windAdjustedRoll, interpolate, calcPar3,
} from '../engine/calculations.js';
import { loadActiveCourse, getCommittedStrategies, setCommittedStrategies } from '../storage/storage.js';

// ── Crosswind helper ────────────────────────────────────────────────────────
export function crosswindSide(windState) {
  if (!windState.active || !windState.enabled || windState.crosswind < 2) return 'none';
  const angleDeg = windState.dirDeg - windState.holeDeg;
  const angleRad = angleDeg * Math.PI / 180;
  const cross = windState.speedMs * Math.sin(angleRad);
  // cross > 0 → wind pushes ball right → wind coming from the left
  return cross > 0 ? 'left' : 'right';
}

// ── Chip row helpers ────────────────────────────────────────────────────────
export function wireChipRow(rowId, hiddenSelectId) {
  const row    = document.getElementById(rowId);
  const hidden = document.getElementById(hiddenSelectId);
  if (!row || !hidden) return;
  row.querySelectorAll('.chip-control-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      row.querySelectorAll('.chip-control-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      hidden.value = btn.dataset.value;
      hidden.dispatchEvent(new Event('change'));
    });
  });
}

export function syncChipRow(rowId, hiddenSelectId) {
  const row    = document.getElementById(rowId);
  const hidden = document.getElementById(hiddenSelectId);
  if (!row || !hidden) return;
  row.querySelectorAll('.chip-control-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === hidden.value);
  });
}

// ── Wind breakdown display ──────────────────────────────────────────────────
export function updateWindSectionStatus(windState, lockPhase) {
  const bar      = document.getElementById('windStatusBar');
  const speedEl  = document.getElementById('wsbSpeed');
  const detailEl = document.getElementById('wsbDetail');
  const badgeEl  = document.getElementById('wsbBadge');
  const locEl2   = document.getElementById('wsbLocation');

  if (!bar) return;

  if (!windState.active || !windState.enabled) {
    bar.classList.remove('visible');
    return;
  }

  const hw = windState.headwind;
  const cw = windState.crosswind;

  speedEl.textContent = `${windState.speedMs.toFixed(1)} m/s`;

  const hwSign = Math.abs(hw) < 0.5 ? 'Calm'
    : hw > 0 ? `↓ ${hw.toFixed(1)} headwind`
    : `↑ ${Math.abs(hw).toFixed(1)} tailwind`;
  const cwPart = cw >= 1 ? ` · ${cw.toFixed(1)} cross` : '';
  detailEl.textContent = hwSign + cwPart;

  if (windState.tempC !== undefined && windState.tempC !== null) {
    badgeEl.textContent = `${Math.round(windState.tempC)}°C`;
  } else {
    badgeEl.textContent = '';
  }

  const compassLocEl = document.getElementById('compassLocation');
  locEl2.textContent = compassLocEl?.textContent?.replace('📍 ', '') || '';

  bar.classList.add('visible');
  updateWindBreakdown(windState, lockPhase);
}

export function updateWindBreakdown(windState, lockPhase) {
  const statGrid    = document.getElementById('windStatGrid');
  const lockPrompt  = document.getElementById('windLockPrompt');
  const compassWrap = document.getElementById('windCompassWrap');
  if (!statGrid) return;

  const hasWind   = windState.active && windState.enabled && windState.speedMs !== null;
  const hasLock   = windState.holeDeg !== null;
  const isLocking = lockPhase === 'live';

  // Show stat grid once wind is fetched
  statGrid.style.display    = hasWind ? 'block' : 'none';
  // Show compass only while actively locking
  if (compassWrap) compassWrap.style.display = isLocking ? 'flex' : 'none';
  // Show lock prompt when wind is fetched but not yet locked and not locking
  if (lockPrompt) lockPrompt.style.display = (hasWind && !hasLock && !isLocking) ? 'flex' : 'none';

  if (!hasWind) return;

  // Direction-dependent stats — muted when no lock
  const headEl = document.getElementById('wbrHead');
  const crossEl = document.getElementById('wbrCross');
  const effectEl = document.getElementById('wbrEffect');

  if (hasLock) {
    const hw = windState.headwind;
    const cw = windState.crosswind;
    if (headEl) {
      if (Math.abs(hw) < 0.5) { headEl.textContent = 'Calm'; headEl.className = 'wbr-val'; }
      else if (hw > 0) { headEl.textContent = `↓ ${hw.toFixed(1)} m/s`; headEl.className = 'wbr-val head'; }
      else { headEl.textContent = `↑ ${Math.abs(hw).toFixed(1)} m/s`; headEl.className = 'wbr-val tail'; }
    }
    if (crossEl) {
      const side = crosswindSide(windState);
      const sideLabel = side === 'left' ? ' L→R' : side === 'right' ? ' R→L' : '';
      crossEl.textContent = cw < 0.5 ? 'None' : `${cw.toFixed(1)} m/s${sideLabel}`;
      crossEl.className = 'wbr-val cross';
    }
    if (effectEl) {
      const hwAlt = hw * (ALT_FACTORS?.['mid_iron'] ?? 1.12);
      const effect = Math.round(hwAlt * 2);
      if (Math.abs(effect) < 2) { effectEl.textContent = 'Minimal'; effectEl.className = 'wbr-val'; }
      else if (effect > 0) { effectEl.textContent = `−${effect}m avg`; effectEl.className = 'wbr-val head'; }
      else { effectEl.textContent = `+${Math.abs(effect)}m avg`; effectEl.className = 'wbr-val tail'; }
    }
  } else {
    if (headEl)  { headEl.textContent  = '— lock direction'; headEl.className  = 'wbr-val'; headEl.style.color  = '#bbb'; }
    if (crossEl) { crossEl.textContent = '— lock direction'; crossEl.className = 'wbr-val'; crossEl.style.color = '#bbb'; }
    if (effectEl){ effectEl.textContent= '— lock direction'; effectEl.className= 'wbr-val'; effectEl.style.color= '#bbb'; }
  }
  // Reset color when locked
  if (hasLock && headEl)   headEl.style.color = '';
  if (hasLock && crossEl)  crossEl.style.color = '';
  if (hasLock && effectEl) effectEl.style.color = '';

  // Always-available stats
  const gustEl = document.getElementById('wbrGusts');
  if (gustEl) {
    if (windState.gustMs && windState.gustMs > windState.speedMs * 1.1) {
      const gustPct = Math.round((windState.gustMs / windState.speedMs - 1) * 100);
      gustEl.textContent = `${windState.gustMs.toFixed(1)} m/s (+${gustPct}%)`;
      gustEl.className = gustPct > 80 ? 'wbr-val head' : 'wbr-val';
    } else {
      gustEl.textContent = 'Steady'; gustEl.className = 'wbr-val';
    }
  }
  const feelsEl = document.getElementById('wbrFeelsLike');
  if (feelsEl) {
    const displayTemp = windState.tempC != null ? Math.round(windState.tempC) : null;
    if (displayTemp != null) {
      const factor = tempCarryFactor(windState);
      const carryDelta = Math.round((factor - 1) * 230); // effect on a 230m driver
      const deltaStr = carryDelta === 0 ? '' : (carryDelta > 0 ? ` · +${carryDelta}m` : ` · ${carryDelta}m`);
      feelsEl.textContent = `${displayTemp}°C${deltaStr}`;
      feelsEl.className = 'wbr-val';
      feelsEl.style.color = carryDelta > 0 ? '#1e7a45' : carryDelta < 0 ? '#185fa5' : '';
    } else {
      feelsEl.textContent = '—';
      feelsEl.className = 'wbr-val';
      feelsEl.style.color = '';
    }
  }
  const rainEl = document.getElementById('wbrRain');
  if (rainEl) {
    rainEl.textContent = windState.rainPct != null ? `${Math.round(windState.rainPct)}%` : '—';
    rainEl.className = 'wbr-val';
    rainEl.style.color = windState.rainPct > 50 ? '#185fa5' : '';
  }
}

// ── Strategy carousel ───────────────────────────────────────────────────────
// ctx = { windState, _holeHcpAdj, _overrideCourseId, _overrideHoleIdx,
//         par3ClubOverrides, teeOverrides, shot2Overrides, approachOverrides, gpsShot2Overrides,
//         par3Override (fn), _hk (fn),
//         blendedScore (fn), computeHoleBaseline (fn),
//         calculate (fn), openClubPicker (fn), updateCalcButtonVisibility (fn) }
export function renderPlan(_result, ctx) {
  if (_result.isError) {
    document.getElementById('output').innerHTML = '<span class="error">' + _result.msg + '</span>';
    return;
  }
  const { parValue, hole, driver, conditions, isFirm,
          clubsList, driverClub, driverCarry, driverTotal,
          teeMarked, completedShots, inRough, handicap,
          ordered, activePlanType,
          _blCourseId, _blHoleIdx } = _result;
  const { windState, _holeHcpAdj, _overrideCourseId, _overrideHoleIdx,
          par3ClubOverrides, teeOverrides, shot2Overrides, approachOverrides, gpsShot2Overrides,
          par3Override, _hk,
          blendedScore, computeHoleBaseline,
          calculate, openClubPicker, updateCalcButtonVisibility } = ctx;
  const MAX_RUNUP = isFirm ? 20 : 15;
  const output = document.getElementById('output');

  if (_result.isPar3) {
    const { par3DefaultClub, par3ActiveClub, s, scoreVal3, diff3, gpsActive3 } = _result.par3;
    const carouselOuter3 = document.createElement('div');
    carouselOuter3.className = 'carousel-outer';
    const track3 = document.createElement('div');
    track3.className = 'carousel-track';

    const par3Card = (() => {
      const card = document.createElement('div');
      card.className = 'carousel-card type-custom';

      const lbl = clubMap[s.key]?.label ?? s.key;
      const windStr = windSummaryStr();

      // ── Header — matches par 4/5 layout ────────────────────────────
      const header = document.createElement('div');
      header.className = 'cc-header';

      const badge = document.createElement('div');
      badge.className = 'cc-badge';
      badge.textContent = 'Par 3';
      header.appendChild(badge);

      // Expected strokes score row (scoreVal3, diff3, gpsActive3 come from _result.par3 via closure)
      const diffStr3 = diff3 === 0 ? 'E' : (diff3 > 0 ? '+' + diff3.toFixed(1) : diff3.toFixed(1));

      const scoreRow = document.createElement('div');
      scoreRow.className = 'cc-score-row';
      const scoreNum = document.createElement('span');
      scoreNum.className = 'cc-score-num';
      scoreNum.textContent = scoreVal3.toFixed(1);
      const scoreVs = document.createElement('span');
      scoreVs.className = 'cc-score-vs';
      scoreVs.textContent = `exp. strokes · ${diffStr3} vs par`;
      scoreRow.appendChild(scoreNum);
      scoreRow.appendChild(scoreVs);
      header.appendChild(scoreRow);

      if (windStr) {
        const windPill = document.createElement('div');
        windPill.className = 'cc-wind-pill';
        windPill.textContent = '↙ ' + windStr;
        header.appendChild(windPill);
      }
      card.appendChild(header);

      const body = document.createElement('div');
      body.className = 'cc-body';

      const shotsCompleted = teeMarked ? 1 : 0;

      // ── Club chip row ────────────────────────────────────────────────
      if (!teeMarked) {
        const chipRow = document.createElement('div');
        chipRow.className = 'tee-chip-row';
        const chipLabel = document.createElement('div');
        chipLabel.className = 'tee-chip-label';
        chipLabel.textContent = 'Club';
        chipRow.appendChild(chipLabel);

        const chipsWrap = document.createElement('div');
        chipsWrap.className = 'tee-chips';

        const recChip = document.createElement('div');
        recChip.className = 'tee-chip tee-chip-sm' + (!par3Override() ? ' active' : '');
        recChip.textContent = clubMap[par3DefaultClub.key]?.label ?? par3DefaultClub.key;
        recChip.addEventListener('click', () => {
          par3ClubOverrides[_overrideCourseId + "|" + _overrideHoleIdx] = null;
          calculate();
        });
        chipsWrap.appendChild(recChip);

        // Bag chip
        const bagChip = document.createElement('div');
        bagChip.className = 'tee-chip tee-chip-sm bag-chip' + (par3Override() ? ' active' : '');
        const bagInner = document.createElement('div');
        bagInner.className = 'tee-chip-bag';
        const bagSvg = document.createElementNS('http://www.w3.org/2000/svg','svg');
        bagSvg.setAttribute('width','18'); bagSvg.setAttribute('height','27');
        bagSvg.setAttribute('viewBox','0 0 349 518'); bagSvg.setAttribute('fill','none');
        bagSvg.style.color = par3Override() ? '#1a1a1a' : '#888';
        bagSvg.innerHTML = `<path d="M319.865 425.637C314.058 433.485 298.865 430.637 298.865 430.637V189.637C298.865 189.637 316.842 186.765 321.865 195.137C324.879 200.16 323.865 210.137 323.865 210.137V412.137C323.865 412.137 324.163 419.829 319.865 425.637Z" fill="currentColor"/><path d="M84.8653 448.637H267.365V189.637L48.8653 287.137V347.637V438.137C48.8653 448.637 84.8653 448.637 84.8653 448.637Z" fill="currentColor"/><path d="M267.365 150.137L198.365 183.637H84.8653V129.637H133.283L129.865 85.6371C129.865 85.6371 64.7881 120.204 28.3653 103.137C20.4185 99.4134 14.8441 97.9927 9.36529 91.1371C3.58296 83.9017 3.45838 77.7611 1.86529 68.6371C0.018102 58.0577 0.0719012 51.7257 1.86529 41.1371C3.44295 31.8222 3.3754 25.4431 9.36529 18.1371C17.3653 8.37935 27.8653 6.63706 35.3653 3.13704C42.8653 -0.362974 80.5689 -1.43121 112.365 6.63708C120.924 8.80888 126.141 9.35914 133.865 13.6371C141.149 17.6706 149.865 23.137 150.365 27.1371C152.425 43.6149 159.915 107.608 162.489 129.637H177.34L243.865 18.1371C243.865 18.1371 252.242 9.10153 259.365 6.63708C267.116 3.95559 272.444 4.5145 280.365 6.63708C287.365 8.51272 338.865 37.137 344.865 49.6371C350.196 60.7433 348.018 69.2824 344.996 81.1235L344.865 81.6371C341.05 96.5988 336.931 106.91 323.865 115.137C315.286 120.539 308.964 123.035 298.865 122.137C291.171 121.453 287.193 118.75 280.365 115.137C261.546 105.179 243.865 74.6371 243.865 74.6371L213.945 129.637H259.365C262.49 129.637 267.365 129.013 267.365 132.137V150.137Z" fill="currentColor"/><path d="M267.365 507.762V489.012C267.365 489.012 268.437 483.743 265.865 481.137C263.259 478.496 257.865 479.637 257.865 479.637H93.3653C93.3653 479.637 89.3245 479.407 86.8653 481.637C84.153 484.096 84.8653 489.012 84.8653 489.012V507.762C84.8653 507.762 84.153 513.178 86.8653 515.637C89.3245 517.867 93.3653 517.137 93.3653 517.137H257.865C257.865 517.137 263.259 518.278 265.865 515.637C268.437 513.031 267.365 507.762 267.365 507.762Z" fill="currentColor"/>`;
        const bagLbl = document.createElement('span');
        bagLbl.className = 'tee-chip-bag-label'; bagLbl.textContent = 'Bag';
        bagInner.appendChild(bagSvg); bagInner.appendChild(bagLbl);
        bagChip.appendChild(bagInner);
        bagChip.addEventListener('click', () => {
          openClubPicker(
              par3Override() || par3DefaultClub.key,
              (selectedKey) => {
                par3ClubOverrides[_overrideCourseId + "|" + _overrideHoleIdx] = selectedKey !== par3DefaultClub.key ? selectedKey : null;
                calculate();
              },
              { type: 'window', defaultKey: par3DefaultClub.key, clubsList, n: 2 }
            );
        });
        chipsWrap.appendChild(bagChip);
        chipRow.appendChild(chipsWrap);
        body.appendChild(chipRow);
      }

      // ── Tee section divider ──────────────────────────────────────────
      const teeDivider = document.createElement('div');
      teeDivider.className = 'cc-section-divider';
      teeDivider.innerHTML = '<div class="cc-section-divider-line"></div><div class="cc-section-divider-label">Tee</div><div class="cc-section-divider-line"></div>';
      body.appendChild(teeDivider);

      // ── Tee shot row ────────────────────────────────────────────────
      if (shotsCompleted > 0) {
        const measured = completedShots[0];
        const distLabel = measured ? `${measured.dist}m GPS` : `~${s.total.toFixed(0)}m`;
        const row = document.createElement('div');
        row.className = 'cc-shot-done';
        row.innerHTML =
          `<div>
            <div class="cc-shot-lbl">Shot 1 — tee</div>
            <span class="cc-shot-done-club">${lbl}</span>
            <span class="cc-shot-done-badge">✓ ${distLabel}</span>
          </div>`;
        body.appendChild(row);
      } else {
        const windDelta = (windState.active && windState.enabled && s.baseCarry != null)
          ? Math.round(s.carry - s.baseCarry) : 0;
        const windHtml = windDelta !== 0
          ? `<div class="cc-shot-wind ${windDelta < 0 ? 'head' : 'tail'}">${windDelta > 0 ? '+' : ''}${windDelta}m wind</div>` : '';
        const rollAmt = (s.total - s.carry).toFixed(0);
        const rollHtml = s.roll > 1.00
          ? `<div class="cc-shot-carry">${s.carry.toFixed(0)}m carry + ${rollAmt}m roll</div>`
          : '';
        const row = document.createElement('div');
        row.className = 'cc-shot-row tee-shot';
        row.innerHTML =
          `<div class="cc-shot-num">1</div>
          <div style="flex:1;min-width:0;">
            <div class="cc-shot-club">${lbl}</div>
            ${windHtml}
            ${rollHtml}
          </div>
          <div class="cc-shot-right">
            <div class="cc-shot-dist">${s.total.toFixed(0)}<span class="cc-shot-unit">m</span></div>
          </div>`;
        body.appendChild(row);
      }

      // ── GPS remaining ────────────────────────────────────────────────
      if (teeMarked && completedShots.length > 0) {
        const lastShot = completedShots[completedShots.length - 1];
        if (lastShot.remaining != null) {
          const gpsBlock = document.createElement('div');
          gpsBlock.className = 'cc-gps-remaining';
          gpsBlock.innerHTML =
            `<div class="cc-gps-label">GPS · remaining to pin</div>` +
            `<div class="cc-gps-dist">${lastShot.remaining}<span style="font-size:15px;color:#aaa;margin-left:2px;">m</span></div>`;
          body.appendChild(gpsBlock);
        }
      }

      // ── Approach block ───────────────────────────────────────────────
      const remaining = Math.max(0, hole - s.total);
      const appDiv = document.createElement('div');
      appDiv.className = 'cc-approach';
      const rollStr = s.roll > 1.00
        ? `${s.carry.toFixed(0)}m carry + ${(s.total - s.carry).toFixed(0)}m roll`
        : `${s.total.toFixed(0)}m carry`;
      const signedRemaining = hole - s.total;
      const distDisplay = signedRemaining < 0
        ? `${Math.round(signedRemaining)}`
        : `${Math.round(remaining)}`;
      const distColor = signedRemaining < 0 ? 'color:#854f0b;' : '';
      const distNote = signedRemaining < 0
        ? 'Overshoots — spin back or use less club'
        : 'Aim for the pin';
      appDiv.innerHTML =
        `<div class="cc-app-label">${completedShots.length > 0 ? 'Approach · adjusted' : 'Distance to pin'}</div>` +
        `<div class="cc-app-dist" style="${distColor}">${distDisplay}<span class="cc-app-dist-unit">m</span></div>` +
        `<div class="cc-app-club">${lbl} — ${rollStr}</div>` +
        `<div class="cc-app-note">${distNote}</div>`;
      body.appendChild(appDiv);

      // ── Crosswind ────────────────────────────────────────────────────
      const cwSide3 = crosswindSide(windState);
      if (cwSide3 !== 'none') {
        const aimSide3 = cwSide3 === 'left' ? 'right' : 'left';
        const cwDiv = document.createElement('div');
        cwDiv.className = 'cc-crosswind';
        cwDiv.innerHTML =
          `<div class="cc-crosswind-title">${windState.crosswind.toFixed(1)} m/s crosswind from the ${cwSide3}</div>` +
          `<div class="cc-crosswind-note">Aim ${aimSide3} into the wind</div>`;
        body.appendChild(cwDiv);
      }

      card.appendChild(body);
      return card;
    })();

    par3Card.classList.add('active-card');
    track3.appendChild(par3Card);
    carouselOuter3.appendChild(track3);
    output.innerHTML = '';
    output.appendChild(carouselOuter3);
    return;
  }
  function approachClub(approachDist) {
    const approachList = clubsList.filter(c => c.key !== 'driver');
    // Zone 1: clubs whose carry lands within MAX_RUNUP of the pin
    const reachable = approachList.filter(c => c.carry <= approachDist && approachDist - c.carry <= MAX_RUNUP);
    if (reachable.length > 0) {
      return reachable.reduce((best, c) => c.carry > best.carry ? c : best);
    }
    // Zone 2: approach shorter than any full-carry club — use most lofted club at partial swing
    const overShoot = approachList.filter(c => c.carry > approachDist);
    if (overShoot.length > 0) {
      const shortest = overShoot.reduce((s, c) => c.carry < s.carry ? c : s);
      return { ...shortest, partial: true };
    }
    return null;
  }

  function approachRecHtml(approachDist) {
    const rec = approachClub(approachDist);
    if (!rec) return null;
    const lbl = clubMap[rec.key]?.label ?? rec.key;
    let windNote = '';
    if (!rec.partial && windState.active && windState.enabled && rec.baseCarry != null) {
      const delta = Math.round(rec.carry - rec.baseCarry);
      if (delta !== 0) windNote = ` (${delta > 0 ? '+' : ''}${delta}m wind)`;
    }
    let carryStr, aimNote;
    if (rec.partial) {
      carryStr = approachDist.toFixed(0);
      aimNote  = `Partial swing — flight it to ${approachDist.toFixed(0)}m`;
    } else {
      const runUp = Math.round(approachDist - rec.carry);
      carryStr = rec.carry.toFixed(0);
      aimNote  = runUp <= 2 ? 'Carry it all the way — minimal roll'
               : runUp <= 8 ? `Land ${runUp}m short and let it release`
               :              `Land ${runUp}m short — play a bump and run`;
    }
    return { lbl, carry: carryStr, windNote, aimNote };
  }

  // ── Render a single strategy card ─────────────────────────────────────
  function windSummaryStr() {
    if (!windState.active || !windState.enabled) return '';
    const hw = windState.headwind;
    const cw = windState.crosswind;
    const hwLabel = Math.abs(hw) < 0.5 ? 'calm'
      : hw > 0 ? `↓ ${hw.toFixed(1)} m/s head`
      : `↑ ${Math.abs(hw).toFixed(1)} m/s tail`;
    return cw >= 2 ? `${hwLabel} · ${cw.toFixed(1)} m/s cross` : hwLabel;
  }

  function encodeStrategy(type, teeClubKey) {
    const clubLabel = clubMap[teeClubKey]?.label ?? teeClubKey;
    return `${type} · ${clubLabel}`;
  }

  function strategyShortName(type) {
    if (type === 'Max distance') return 'Max';
    if (type === 'Controlled')   return 'Ctrl';
    if (type === 'Conservative') return 'Consv';
    if (type === 'Custom')       return 'Custom';
    return type;
  }

  // ── Bag chip override ─────────────────────────────────────────────────
  function solveForced(forcedTeeKey) {
    const teeClub = clubsList.find(c => c.key === forcedTeeKey);
    if (!teeClub) return null;
    if (parValue === 4 && teeClub.idx > idx7) return null;
    if (parValue === 5) {
      const longClubs = ['driver','fw3','fw5','fw7','u2','u3','u4'];
      if (!longClubs.includes(teeClub.key)) return null;
    }
    const driverCarry = driverClub ? driverClub.carry : driver;
    return findBestContinuation(teeClub, hole, driverTotal, clubsList, driverCarry, handicap, inRough, windState, _holeHcpAdj);
  }

  // Build a modified plan using a user-forced second club.
  // Preserves the tee shot; replaces the 2nd shot and recalculates approach/score.
  function buildPlanWithShot2Override(basePlan, activePlan, forced2Key) {
    if (!activePlan.shots || activePlan.shots.length < 2) return null;
    const teeShot  = activePlan.shots[0];
    const forced2  = clubsList.find(c => c.key === forced2Key);
    if (!forced2) return null;
    const approach = hole - teeShot.total - forced2.total;
    if (approach < 0) return null; // overshoots green
    const driverCarry2 = driverClub ? driverClub.carry : driver;
    const rawScore = 2 + expectedStrokesRemaining(approach, driverCarry2, handicap, inRough, windState, undefined, _holeHcpAdj);
    // Apply personal baseline blend for consistency with main plan scores
    const bl = (_blCourseId && _blHoleIdx !== null)
      ? blendedScore(rawScore, _blCourseId, _blHoleIdx)
      : { score: rawScore, blended: false };
    return { shots: [teeShot, forced2], approach, score: bl.score, blended: bl.blended };
  }

  function buildStrategyCard(basePlan, cardIndex, totalCards, detailOpen) {
    const override    = teeOverrides[_hk(basePlan.type)];
    const shot2Key    = shot2Overrides[_hk(basePlan.type)];
    const basePlanResolved = override ? (solveForced(override) || basePlan) : basePlan;
    const activePlan  = (shot2Key && basePlanResolved.shots?.length >= 2)
      ? (buildPlanWithShot2Override(basePlan, basePlanResolved, shot2Key) || basePlanResolved)
      : basePlanResolved;

    const isCustom = !!override; // shot2 override does NOT trigger custom badge

    const card = document.createElement('div');
    card.className = 'carousel-card';
    card.dataset.type = basePlan.type;

    // Type class on card root — all colour-themed descendants inherit from here
    const typeClass = isCustom ? 'type-custom'
      : basePlan.type === 'Max distance'  ? 'type-max-distance'
      : basePlan.type === 'Controlled'    ? 'type-controlled'
      : 'type-conservative';
    card.classList.add(typeClass);

    // Header
    const header = document.createElement('div');
    header.className = 'cc-header';
    const windStr        = windSummaryStr();
    const activeTeeLabel = clubMap[activePlan.shots[0].key]?.label ?? activePlan.shots[0].key;
    // Score: use GPS-actual if tee shot is done, otherwise pre-shot model
    const gpsLastShot = (completedShots?.length > 0)
      ? completedShots[completedShots.length - 1]
      : null;
    const gpsRemaining = gpsLastShot?.remaining ?? null;
    const gpsActive    = teeMarked && gpsRemaining != null;

    let scoreVal, scoreSuffix;
    if (gpsActive) {
      // Shots taken so far + expected strokes from actual GPS position
      const shotsTaken = completedShots.length;
      scoreVal   = shotsTaken + expectedStrokesRemaining(gpsRemaining, driverCarry, handicap, inRough, windState, undefined, _holeHcpAdj);
      scoreSuffix = ' GPS';
    } else {
      scoreVal   = activePlan.score;
      scoreSuffix = '';
    }

    const scoreDiff    = scoreVal - parValue;
    const scoreDiffStr = scoreDiff === 0 ? 'E' : (scoreDiff > 0 ? '+' + scoreDiff.toFixed(1) : scoreDiff.toFixed(1));
    const subLine = gpsActive
      ? `${activeTeeLabel} · ${gpsRemaining}m GPS remaining · tap for details`
      : `${activeTeeLabel} off the tee · ${activePlan.approach.toFixed(0)}m approach · tap for details`;

    // Strategy name badge (coloured by type)
    const badgeDiv = document.createElement('div');
    badgeDiv.className = 'cc-badge';
    badgeDiv.textContent = isCustom ? 'Custom' : basePlan.type;
    // Personal baseline indicator
    if (activePlan.blended && activePlan.blendRounds) {
      const ind = document.createElement('div');
      ind.style.cssText = 'font-size:11px;color:#888;font-weight:500;';
      ind.textContent = 'Personal · ' + activePlan.blendRounds + ' rounds';
      badgeDiv.appendChild(ind);
    } else {
      try {
        const _bSess = loadActiveCourse();
        if (_bSess.id) {
          const { id: _bid, holeIdx: _bhi } = _bSess;
          const _bl = computeHoleBaseline(_bid, _bhi ?? 0);
          if (_bl) {
            const ind = document.createElement('div');
            ind.style.cssText = 'font-size:11px;color:#888;font-weight:500;';
            ind.textContent = 'Personal · ' + _bl.rounds + ' rounds';
            badgeDiv.appendChild(ind);
          }
        }
      } catch(e) {}
    }
    header.appendChild(badgeDiv);

    // Score row: big number + label + vs par
    const scoreRow = document.createElement('div');
    scoreRow.className = 'cc-score-row';
    const scoreNum = document.createElement('span');
    scoreNum.className = 'cc-score-num';
    scoreNum.textContent = scoreVal.toFixed(1);
    const scoreVs = document.createElement('span');
    scoreVs.className = 'cc-score-vs';
    scoreVs.textContent = `exp. strokes · ${scoreDiffStr} vs par${scoreSuffix}`;
    scoreRow.appendChild(scoreNum);
    scoreRow.appendChild(scoreVs);
    header.appendChild(scoreRow);

    // Sub line: GPS remaining only (approach is in shot rows — no need to repeat)
    if (gpsActive) {
      const subDiv = document.createElement('div');
      subDiv.className = 'cc-sub';
      subDiv.textContent = `${gpsRemaining}m remaining (GPS)`;
      header.appendChild(subDiv);
    }

    if (windStr) {
      const windPill = document.createElement('div');
      windPill.className = 'cc-wind-pill';
      windPill.textContent = '↙ ' + windStr;
      header.appendChild(windPill);
    }
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'cc-body';

    const shotsCompleted = teeMarked ? Math.max(1, completedShots.length) : 0;

    // When GPS ball is marked: build fresh plan from actual remaining distance
    let gpsContinuation = null;
    if (gpsActive && gpsRemaining != null) {
      const gpsOverrideKey = gpsShot2Overrides[_hk(basePlan.type)] || null;
      if (gpsOverrideKey) {
        const forcedClub = clubsList.find(c => c.key === gpsOverrideKey);
        if (forcedClub) {
          const approach = gpsRemaining - forcedClub.total;
          gpsContinuation = approach >= 0
            ? { shots: [forcedClub], approach, score: 1 + expectedStrokesRemaining(approach, driverCarry, handicap, inRough, windState, undefined, _holeHcpAdj) }
            : findBestContinuation(forcedClub, gpsRemaining, driverTotal, clubsList, driverCarry, handicap, inRough, windState, _holeHcpAdj);
        }
      }
      if (!gpsContinuation) {
        gpsContinuation = findBestContinuation(
          clubsList.reduce((best, c) => {
            const app = gpsRemaining - c.total;
            if (c.key === 'driver') return best;
            const score = 1 + expectedStrokesRemaining(Math.max(0, app), driverCarry, handicap, inRough, windState, undefined, _holeHcpAdj);
            return (!best || score < best.score) ? { club: c, score } : best;
          }, null)?.club || clubsList.find(c => c.key !== 'driver') || clubsList[0],
          gpsRemaining, driverTotal, clubsList, driverCarry, handicap, inRough, windState, _holeHcpAdj
        );
      }
    }

    // Shot rows

    activePlan.shots.forEach((s, i) => {
      const lbl    = clubMap[s.key]?.label ?? s.key;
      const isDone = i < shotsCompleted;

      // Skip planned (not-yet-played) shots when GPS active — continuation replaces them
      if (!isDone && gpsActive) return;

      if (isDone) {
        const measured  = completedShots[i];
        const distLabel = measured ? `${measured.dist}m GPS` : `~${s.total.toFixed(0)}m`;
        const row       = document.createElement('div');
        row.className   = 'cc-shot-done';
        row.innerHTML   =
          `<div>
            <div class="cc-shot-lbl">Shot ${i + 1}${i === 0 ? ' — tee' : ''}</div>
            <span class="cc-shot-done-club">${lbl}</span>
            <span class="cc-shot-done-badge">✓ ${distLabel}</span>
          </div>
          <div class="cc-shot-done-dist">${measured ? measured.dist + 'm' : ''}</div>`;
        body.appendChild(row);
      } else if (i === 0) {
        // Tee divider
        const teeDivider = document.createElement('div');
        teeDivider.className = 'cc-section-divider';
        teeDivider.innerHTML = '<div class="cc-section-divider-line"></div><div class="cc-section-divider-label">Tee</div><div class="cc-section-divider-line"></div>';
        body.appendChild(teeDivider);

        const row = document.createElement('div');
        row.className = 'cc-shot-row tee-shot';
        const windDelta = (windState.active && windState.enabled && s.baseCarry != null)
          ? Math.round(s.carry - s.baseCarry) : 0;
        const windHtml = windDelta !== 0
          ? `<div class="cc-shot-wind ${windDelta < 0 ? 'head' : 'tail'}">${windDelta > 0 ? '+' : ''}${windDelta}m wind</div>` : '';
        const rollAmt = (s.total - s.carry).toFixed(0);
        const rollHtml = s.roll > 1.00 ? `<div class="cc-shot-carry">${s.carry.toFixed(0)}m carry + ${rollAmt}m roll</div>` : '';
        row.innerHTML =
          `<div class="cc-shot-num">${i + 1}</div>
          <div style="flex:1;min-width:0;">
            <div class="cc-shot-club">${lbl}${isCustom ? ' <span class="cc-custom-badge">Custom</span>' : ''}</div>
            ${windHtml}
            ${rollHtml}
            ${isCustom ? '<div class="cc-custom-clear">Tap to reset</div>' : ''}
          </div>
          <div class="cc-shot-right">
            <div class="cc-shot-dist">${s.total.toFixed(0)}<span class="cc-shot-unit">m</span></div>
          </div>`;
        if (isCustom) {
          row.querySelector('.cc-custom-clear').addEventListener('click', (e) => {
            e.stopPropagation();
            teeOverrides[_hk(basePlan.type)] = null;
            const newCard = buildStrategyCard(basePlan, cardIndex, totalCards, detailOpen);
            newCard.id = 'activeStrategyCard';
            newCard.classList.add('active-card'); card.replaceWith(newCard); syncOuterHeight();
            updateCompareTable();
          });
        }
        body.appendChild(row);
      } else {
        // Approach / layup divider
        const isLast = i === activePlan.shots.length - 1;
        const divLabel = activePlan.shots.length > 2 && !isLast ? 'Layup' : 'Approach';
        const dividerEl = document.createElement('div');
        dividerEl.className = 'cc-section-divider';
        dividerEl.innerHTML = `<div class="cc-section-divider-line"></div><div class="cc-section-divider-label">${divLabel}</div><div class="cc-section-divider-line"></div>`;
        body.appendChild(dividerEl);

        const row = document.createElement('div');
        row.className = 'cc-shot-row';
        const windDelta = (windState.active && windState.enabled && s.baseCarry != null)
          ? Math.round(s.carry - s.baseCarry) : 0;
        const windHtml = windDelta !== 0
          ? `<div class="cc-shot-wind ${windDelta < 0 ? 'head' : 'tail'}">${windDelta > 0 ? '+' : ''}${windDelta}m wind</div>` : '';
        const apRollAmt = (s.total - s.carry).toFixed(0);
        const apRollHtml = s.roll > 1.00 ? `<div class="cc-shot-carry">${s.carry.toFixed(0)}m carry + ${apRollAmt}m roll</div>` : `<div class="cc-shot-carry">${s.carry.toFixed(0)}m carry</div>`;
        row.innerHTML =
          `<div class="cc-shot-num">${i + 1}</div>
          <div style="flex:1;min-width:0;">
            <div class="cc-shot-club">${lbl}</div>
            ${windHtml}
            ${apRollHtml}
          </div>
          <div class="cc-shot-right">
            <div class="cc-shot-dist">${s.total.toFixed(0)}<span class="cc-shot-unit">m</span></div>
          </div>`;
        body.appendChild(row);

        // Second-shot club picker (i===1 only, not GPS-done)
        if (i === 1 && !isDone) {
          const shot2AllCandidates = clubsList.filter(c =>
            c.key !== 'driver' && c.total < activePlan.shots[0].total
            && (hole - activePlan.shots[0].total - c.total) >= 0
          );
          // Always anchor to basePlan recommended club so chips are fixed
          const recS2Key = basePlan.shots[1]?.key;
          const recS2Idx = recS2Key ? shot2AllCandidates.findIndex(c => c.key === recS2Key) : -1;
          const shot2Candidates = recS2Idx >= 0
            ? shot2AllCandidates.slice(recS2Idx, recS2Idx + 3)
            : shot2AllCandidates.slice(0, 3);
          if (shot2Candidates.length > 0) {
            const s2Row = document.createElement('div');
            s2Row.className = 'tee-chip-row';
            const s2Label = document.createElement('div');
            s2Label.className = 'tee-chip-label';
            s2Label.textContent = '2nd club';
            s2Row.appendChild(s2Label);

            const s2Chips = document.createElement('div');
            s2Chips.className = 'tee-chips';

            const currentS2Key = shot2Key || activePlan.shots[1].key;

            shot2Candidates.forEach(cand => {
              const chip = document.createElement('div');
              chip.className = 'tee-chip tee-chip-sm' + (cand.key === currentS2Key ? ' active' : '');
              chip.textContent = clubMap[cand.key]?.label ?? cand.key;

              // Show if this club would overshoot (approach < 0)
              const testApproach = hole - activePlan.shots[0].total - cand.total;
              if (testApproach < 0) {
                chip.classList.add('locked');
                chip.title = 'Overshoots the green';
              } else {
                chip.addEventListener('click', () => {
                  if (cand.key === (shot2Key || activePlan.shots[1].key)) {
                    // Already active — do nothing to prevent accidental reset
                    return;
                  } else if (cand.key === recS2Key) {
                    // Tapping back to recommended — remove override so blended score is used
                    delete shot2Overrides[_hk(basePlan.type)];
                  } else {
                    shot2Overrides[_hk(basePlan.type)] = cand.key;
                  }
                  const newCard = buildStrategyCard(basePlan, cardIndex, totalCards, detailOpen);
                  newCard.id = card.id || 'activeStrategyCard';
                  newCard.classList.add('active-card'); card.replaceWith(newCard); syncOuterHeight();
                  updateCompareTable();
                });
              }
              s2Chips.appendChild(chip);
            });

            // Bag chip — opens full picker for 2nd club
            const s2BagChip = document.createElement('div');
            s2BagChip.className = 'tee-chip bag-chip tee-chip-sm';
            const s2BagInner = document.createElement('div');
            s2BagInner.className = 'tee-chip-bag';
            const s2BagSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            s2BagSvg.setAttribute('width', '18'); s2BagSvg.setAttribute('height', '27');
            s2BagSvg.setAttribute('viewBox', '0 0 349 518'); s2BagSvg.setAttribute('fill', 'none');
            s2BagSvg.style.color = '#888';
            s2BagSvg.innerHTML = '<path d="M319.865 425.637C314.058 433.485 298.865 430.637 298.865 430.637V189.637C298.865 189.637 316.842 186.765 321.865 195.137C324.879 200.16 323.865 210.137 323.865 210.137V412.137C323.865 412.137 324.163 419.829 319.865 425.637Z" fill="currentColor"/><path d="M84.8653 448.637H267.365V189.637L48.8653 287.137V347.637V438.137C48.8653 448.637 84.8653 448.637 84.8653 448.637Z" fill="currentColor"/><path d="M84.8653 237.137V216.637H133.865L84.8653 237.137Z" fill="currentColor"/><path d="M267.365 150.137L198.365 183.637H84.8653V129.637H133.283L129.865 85.6371C129.865 85.6371 64.7881 120.204 28.3653 103.137C20.4185 99.4134 14.8441 97.9927 9.36529 91.1371C3.58296 83.9017 3.45838 77.7611 1.86529 68.6371C0.018102 58.0577 0.0719012 51.7257 1.86529 41.1371C3.44295 31.8222 3.3754 25.4431 9.36529 18.1371C17.3653 8.37935 27.8653 6.63706 35.3653 3.13704C42.8653 -0.362974 80.5689 -1.43121 112.365 6.63708C120.924 8.80888 126.141 9.35914 133.865 13.6371C141.149 17.6706 149.865 23.137 150.365 27.1371C152.425 43.6149 159.915 107.608 162.489 129.637H177.34L243.865 18.1371C243.865 18.1371 252.242 9.10153 259.365 6.63708C267.116 3.95559 272.444 4.5145 280.365 6.63708C287.365 8.51272 338.865 37.137 344.865 49.6371C350.196 60.7433 348.018 69.2824 344.996 81.1235L344.865 81.6371C341.05 96.5988 336.931 106.91 323.865 115.137C315.286 120.539 308.964 123.035 298.865 122.137C291.171 121.453 287.193 118.75 280.365 115.137C261.546 105.179 243.865 74.6371 243.865 74.6371L213.945 129.637H259.365C262.49 129.637 267.365 129.013 267.365 132.137V150.137Z" fill="currentColor"/><path d="M267.365 507.762V498.387V489.012C267.365 489.012 268.437 483.743 265.865 481.137C263.259 478.496 257.865 479.637 257.865 479.637H93.3653C93.3653 479.637 89.3245 479.407 86.8653 481.637C84.153 484.096 84.8653 489.012 84.8653 489.012V498.387V507.762C84.8653 507.762 84.153 513.178 86.8653 515.637C89.3245 517.867 93.3653 517.137 93.3653 517.137H257.865C257.865 517.137 263.259 518.278 265.865 515.637C268.437 513.031 267.365 507.762 267.365 507.762Z" fill="currentColor"/>';
            const s2BagLbl = document.createElement('span');
            s2BagLbl.className = 'tee-chip-bag-label'; s2BagLbl.textContent = 'Bag';
            s2BagInner.appendChild(s2BagSvg); s2BagInner.appendChild(s2BagLbl);
            s2BagChip.appendChild(s2BagInner);
            s2BagChip.addEventListener('click', () => {
              const curS2Key = shot2Overrides[_hk(basePlan.type)] || activePlan.shots[1]?.key;
              openClubPicker(curS2Key, (selectedKey) => {
                  const forced = clubsList.find(c => c.key === selectedKey);
                  const testApp = forced ? hole - activePlan.shots[0].total - forced.total : -1;
                  if (testApp >= 0) {
                    if (selectedKey === activePlan.shots[1]?.key) {
                      delete shot2Overrides[_hk(basePlan.type)];
                    } else {
                      shot2Overrides[_hk(basePlan.type)] = selectedKey;
                    }
                  }
                  const newCard = buildStrategyCard(basePlan, cardIndex, totalCards, detailOpen);
                  newCard.id = card.id || 'activeStrategyCard';
                  newCard.classList.add('active-card'); card.replaceWith(newCard); syncOuterHeight(); updateCompareTable();
                }, { type: 'no-driver' });
            });
            s2Chips.appendChild(s2BagChip);

            s2Row.appendChild(s2Chips);
            body.appendChild(s2Row);
          }
        }
      }
    });

    // Ghost placeholder for 2nd shot + chip row — keeps card height equal to 2-shot plans
    if (activePlan.shots.length === 1 && !teeMarked) {
      const ghostDivider = document.createElement('div');
      ghostDivider.className = 'cc-section-divider';
      ghostDivider.innerHTML = '<div class="cc-section-divider-line"></div><div class="cc-section-divider-label">Approach</div><div class="cc-section-divider-line"></div>';
      ghostDivider.style.cssText = 'opacity:0;pointer-events:none;';
      body.appendChild(ghostDivider);
      // Ghost shot row
      const ghostRow = document.createElement('div');
      ghostRow.className = 'cc-shot-row';
      ghostRow.style.cssText = 'opacity:0;pointer-events:none;';
      ghostRow.innerHTML =
        '<div class="cc-shot-num">2</div>' +
        '<div style="flex:1"><div class="cc-shot-club">—</div><div class="cc-shot-carry">—</div></div>' +
        '<div class="cc-shot-right"><div class="cc-shot-dist">—<span class="cc-shot-unit">m</span></div></div>';
      body.appendChild(ghostRow);
      // Real approach club chip row for 1-shot plans
      const appOverrideKey = approachOverrides[_hk(basePlan.type)] || null;
      const recAppClub = approachClub(activePlan.approach);
      // Only show clubs that can actually reach within the runup cap
      // Include clubs reachable within MAX_RUNUP, plus partial-swing zone (carry > approach)
      const allAppCandidates = clubsList.filter(c =>
        c.key !== 'driver' &&
        activePlan.approach - c.carry <= MAX_RUNUP
      );
      const recAppIdx = recAppClub ? allAppCandidates.findIndex(c => c.key === recAppClub.key) : -1;
      // Show rec club + 1 longer + 2 shorter (centred on rec so short approaches show wedges)
      const appCandidates = recAppIdx >= 0
        ? allAppCandidates.slice(Math.max(0, recAppIdx - 1), recAppIdx + 3)
        : allAppCandidates.slice(0, 4);
      if (appCandidates.length > 0) {
        const appChipRow = document.createElement('div');
        appChipRow.className = 'tee-chip-row';
        const appLabel = document.createElement('div');
        appLabel.className = 'tee-chip-label';
        appLabel.textContent = 'Approach';
        appChipRow.appendChild(appLabel);
        const appChips = document.createElement('div');
        appChips.className = 'tee-chips';
        // Rec chip
        const recChip = document.createElement('div');
        recChip.className = 'tee-chip tee-chip-sm' + (!appOverrideKey ? ' active' : '');
        recChip.textContent = clubMap[recAppClub?.key]?.label ?? '—';
        recChip.addEventListener('click', () => {
          delete approachOverrides[_hk(basePlan.type)];
          const newCard = buildStrategyCard(basePlan, cardIndex, totalCards, detailOpen);
          newCard.id = card.id || 'activeStrategyCard';
          newCard.classList.add('active-card'); card.replaceWith(newCard); syncOuterHeight(); updateCompareTable();
        });
        appChips.appendChild(recChip);
        // 2 more candidates around rec
        // Alternate candidates — appCandidates already centred on rec, just exclude rec itself
        const candidates = appCandidates.filter(c => c.key !== recAppClub?.key);
        candidates.forEach(c => {
          const chip = document.createElement('div');
          chip.className = 'tee-chip tee-chip-sm' + (appOverrideKey === c.key ? ' active' : '');
          chip.textContent = clubMap[c.key]?.label ?? c.key;
          chip.addEventListener('click', () => {
            approachOverrides[_hk(basePlan.type)] = c.key;
            const newCard = buildStrategyCard(basePlan, cardIndex, totalCards, detailOpen);
            newCard.id = card.id || 'activeStrategyCard';
            newCard.classList.add('active-card'); card.replaceWith(newCard); syncOuterHeight(); updateCompareTable();
          });
          appChips.appendChild(chip);
        });
        // Bag chip
        const appBagChip = document.createElement('div');
        appBagChip.className = 'tee-chip bag-chip tee-chip-sm';
        const appBagInner = document.createElement('div');
        appBagInner.className = 'tee-chip-bag';
        const appBagSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        appBagSvg.setAttribute('width', '18'); appBagSvg.setAttribute('height', '27');
        appBagSvg.setAttribute('viewBox', '0 0 349 518'); appBagSvg.setAttribute('fill', 'none');
        appBagSvg.style.color = '#888';
        appBagSvg.innerHTML = '<path d="M319.865 425.637C314.058 433.485 298.865 430.637 298.865 430.637V189.637C298.865 189.637 316.842 186.765 321.865 195.137C324.879 200.16 323.865 210.137 323.865 210.137V412.137C323.865 412.137 324.163 419.829 319.865 425.637Z" fill="currentColor"/><path d="M84.8653 448.637H267.365V189.637L48.8653 287.137V347.637V438.137C48.8653 448.637 84.8653 448.637 84.8653 448.637Z" fill="currentColor"/><path d="M267.365 150.137L198.365 183.637H84.8653V129.637H133.283L129.865 85.6371C129.865 85.6371 64.7881 120.204 28.3653 103.137C20.4185 99.4134 14.8441 97.9927 9.36529 91.1371C3.58296 83.9017 3.45838 77.7611 1.86529 68.6371C0.018102 58.0577 0.0719012 51.7257 1.86529 41.1371C3.44295 31.8222 3.3754 25.4431 9.36529 18.1371C17.3653 8.37935 27.8653 6.63706 35.3653 3.13704C42.8653 -0.362974 80.5689 -1.43121 112.365 6.63708C120.924 8.80888 126.141 9.35914 133.865 13.6371C141.149 17.6706 149.865 23.137 150.365 27.1371C152.425 43.6149 159.915 107.608 162.489 129.637H177.34L243.865 18.1371C243.865 18.1371 252.242 9.10153 259.365 6.63708C267.116 3.95559 272.444 4.5145 280.365 6.63708C287.365 8.51272 338.865 37.137 344.865 49.6371C350.196 60.7433 348.018 69.2824 344.996 81.1235L344.865 81.6371C341.05 96.5988 336.931 106.91 323.865 115.137C315.286 120.539 308.964 123.035 298.865 122.137C291.171 121.453 287.193 118.75 280.365 115.137C261.546 105.179 243.865 74.6371 243.865 74.6371L213.945 129.637H259.365C262.49 129.637 267.365 129.013 267.365 132.137V150.137Z" fill="currentColor"/><path d="M267.365 507.762V498.387V489.012C267.365 489.012 268.437 483.743 265.865 481.137C263.259 478.496 257.865 479.637 257.865 479.637H93.3653C93.3653 479.637 89.3245 479.407 86.8653 481.637C84.153 484.096 84.8653 489.012 84.8653 489.012V498.387V507.762C84.8653 507.762 84.153 513.178 86.8653 515.637C89.3245 517.867 93.3653 517.137 93.3653 517.137H257.865C257.865 517.137 263.259 518.278 265.865 515.637C268.437 513.031 267.365 507.762 267.365 507.762Z" fill="currentColor"/>';
        const appBagLbl = document.createElement('span');
        appBagLbl.className = 'tee-chip-bag-label'; appBagLbl.textContent = 'Bag';
        appBagInner.appendChild(appBagSvg); appBagInner.appendChild(appBagLbl);
        appBagChip.appendChild(appBagInner);
        appBagChip.addEventListener('click', () => {
          openClubPicker(appOverrideKey || recAppClub?.key, (selectedKey) => {
              approachOverrides[_hk(basePlan.type)] = selectedKey === recAppClub?.key ? null : selectedKey;
              const newCard = buildStrategyCard(basePlan, cardIndex, totalCards, detailOpen);
              newCard.id = card.id || 'activeStrategyCard';
              newCard.classList.add('active-card'); card.replaceWith(newCard); syncOuterHeight(); updateCompareTable();
            }, { type: 'no-driver' });
        });
        appChips.appendChild(appBagChip);
        appChipRow.appendChild(appChips);
        body.appendChild(appChipRow);
      }
    }

    // GPS continuation — pill + recalculated next shot(s) + approach
    if (gpsActive && gpsContinuation) {
      // GPS pill
      const gpsPill = document.createElement('div');
      gpsPill.style.cssText = 'display:flex;align-items:center;gap:8px;margin:0 14px 2px;background:#f0faf4;border-radius:8px;padding:8px 12px;';
      gpsPill.innerHTML =
        '<div style="width:7px;height:7px;border-radius:50%;background:#1e7a45;flex-shrink:0;"></div>' +
        '<span style="font-size:12px;font-weight:600;color:#1e7a45;">Ball position marked</span>' +
        '<span style="font-size:12px;color:#888;margin-left:auto;">' + gpsRemaining + 'm to pin</span>';
      body.appendChild(gpsPill);

      // Render GPS continuation shots
      gpsContinuation.shots.forEach((s, i) => {
        const lbl = clubMap[s.key]?.label ?? s.key;
        const isLast = i === gpsContinuation.shots.length - 1;
        const divLbl = i === 0 ? 'Next shot · recalculated' : 'Final approach';
        const divEl = document.createElement('div');
        divEl.className = 'cc-section-divider';
        divEl.innerHTML = `<div class="cc-section-divider-line"></div><div class="cc-section-divider-label">${divLbl}</div><div class="cc-section-divider-line"></div>`;
        body.appendChild(divEl);
        const windDelta = (windState.active && windState.enabled && s.baseCarry != null) ? Math.round(s.carry - s.baseCarry) : 0;
        const windHtml = windDelta !== 0 ? `<div class="cc-shot-wind ${windDelta < 0 ? 'head' : 'tail'}">${windDelta > 0 ? '+' : ''}${windDelta}m wind</div>` : '';
        const rollAmt = (s.total - s.carry).toFixed(0);
        const rollHtml = `<div class="cc-shot-carry">${s.carry.toFixed(0)}m carry${s.roll > 1.00 ? ' + ' + rollAmt + 'm roll' : ''}</div>`;
        const row = document.createElement('div');
        row.className = 'cc-shot-row';
        row.innerHTML =
          `<div class="cc-shot-num">${completedShots.length + i + 1}</div>
          <div style="flex:1;min-width:0;">
            <div class="cc-shot-club">${lbl}</div>
            ${windHtml}${rollHtml}
          </div>
          <div class="cc-shot-right">
            <div class="cc-shot-dist">${s.total.toFixed(0)}<span class="cc-shot-unit">m</span></div>
          </div>`;
        body.appendChild(row);

        // Club chip row for first GPS continuation shot
        if (i === 0) {
          const gpsOverrideKey = gpsShot2Overrides[_hk(basePlan.type)] || null;
          const allCands = clubsList.filter(c => c.key !== 'driver' && (gpsRemaining - c.total) >= 0);
          const recIdx = allCands.findIndex(c => c.key === s.key);
          const chipCands = recIdx >= 0 ? allCands.slice(recIdx, recIdx + 3) : allCands.slice(0, 3);
          if (chipCands.length > 0) {
            const chipRow = document.createElement('div');
            chipRow.className = 'tee-chip-row';
            const chipLabel = document.createElement('div');
            chipLabel.className = 'tee-chip-label';
            chipLabel.textContent = 'Club';
            chipRow.appendChild(chipLabel);
            const chips = document.createElement('div');
            chips.className = 'tee-chips';
            chipCands.forEach(c => {
              const isActive = gpsOverrideKey ? c.key === gpsOverrideKey : c.key === s.key;
              const chip = document.createElement('div');
              chip.className = 'tee-chip tee-chip-sm' + (isActive ? ' active' : '');
              chip.textContent = clubMap[c.key]?.label ?? c.key;
              chip.addEventListener('click', () => {
                gpsShot2Overrides[_hk(basePlan.type)] = c.key === s.key ? null : c.key;
                const newCard = buildStrategyCard(basePlan, cardIndex, totalCards, detailOpen);
                newCard.id = card.id || 'activeStrategyCard';
                newCard.classList.add('active-card'); card.replaceWith(newCard); syncOuterHeight(); updateCompareTable();
              });
              chips.appendChild(chip);
            });
            // Bag chip
            const bagChip = document.createElement('div');
            bagChip.className = 'tee-chip bag-chip tee-chip-sm';
            const bagInner = document.createElement('div'); bagInner.className = 'tee-chip-bag';
            const bagSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            bagSvg.setAttribute('width', '18'); bagSvg.setAttribute('height', '27'); bagSvg.setAttribute('viewBox', '0 0 349 518'); bagSvg.setAttribute('fill', 'none'); bagSvg.style.color = '#888';
            bagSvg.innerHTML = '<path d="M319.865 425.637C314.058 433.485 298.865 430.637 298.865 430.637V189.637C298.865 189.637 316.842 186.765 321.865 195.137C324.879 200.16 323.865 210.137 323.865 210.137V412.137C323.865 412.137 324.163 419.829 319.865 425.637Z" fill="currentColor"/><path d="M84.8653 448.637H267.365V189.637L48.8653 287.137V347.637V438.137C48.8653 448.637 84.8653 448.637 84.8653 448.637Z" fill="currentColor"/><path d="M267.365 150.137L198.365 183.637H84.8653V129.637H133.283L129.865 85.6371C129.865 85.6371 64.7881 120.204 28.3653 103.137C20.4185 99.4134 14.8441 97.9927 9.36529 91.1371C3.58296 83.9017 3.45838 77.7611 1.86529 68.6371C0.018102 58.0577 0.0719012 51.7257 1.86529 41.1371C3.44295 31.8222 3.3754 25.4431 9.36529 18.1371C17.3653 8.37935 27.8653 6.63706 35.3653 3.13704C42.8653 -0.362974 80.5689 -1.43121 112.365 6.63708C120.924 8.80888 126.141 9.35914 133.865 13.6371C141.149 17.6706 149.865 23.137 150.365 27.1371C152.425 43.6149 159.915 107.608 162.489 129.637H177.34L243.865 18.1371C243.865 18.1371 252.242 9.10153 259.365 6.63708C267.116 3.95559 272.444 4.5145 280.365 6.63708C287.365 8.51272 338.865 37.137 344.865 49.6371C350.196 60.7433 348.018 69.2824 344.996 81.1235L344.865 81.6371C341.05 96.5988 336.931 106.91 323.865 115.137C315.286 120.539 308.964 123.035 298.865 122.137C291.171 121.453 287.193 118.75 280.365 115.137C261.546 105.179 243.865 74.6371 243.865 74.6371L213.945 129.637H259.365C262.49 129.637 267.365 129.013 267.365 132.137V150.137Z" fill="currentColor"/><path d="M267.365 507.762V498.387V489.012C267.365 489.012 268.437 483.743 265.865 481.137C263.259 478.496 257.865 479.637 257.865 479.637H93.3653C93.3653 479.637 89.3245 479.407 86.8653 481.637C84.153 484.096 84.8653 489.012 84.8653 489.012V498.387V507.762C84.8653 507.762 84.153 513.178 86.8653 515.637C89.3245 517.867 93.3653 517.137 93.3653 517.137H257.865C257.865 517.137 263.259 518.278 265.865 515.637C268.437 513.031 267.365 507.762 267.365 507.762Z" fill="currentColor"/>';
            const bagLbl = document.createElement('span'); bagLbl.className = 'tee-chip-bag-label'; bagLbl.textContent = 'Bag';
            bagInner.appendChild(bagSvg); bagInner.appendChild(bagLbl); bagChip.appendChild(bagInner);
            bagChip.addEventListener('click', () => {
              openClubPicker(gpsShot2Overrides[_hk(basePlan.type)] || s.key, (selectedKey) => {
                  gpsShot2Overrides[_hk(basePlan.type)] = selectedKey === s.key ? null : selectedKey;
                  const newCard = buildStrategyCard(basePlan, cardIndex, totalCards, detailOpen);
                  newCard.id = card.id || 'activeStrategyCard';
                  newCard.classList.add('active-card'); card.replaceWith(newCard); syncOuterHeight(); updateCompareTable();
                }, { type: 'no-driver' });
            });
            chips.appendChild(bagChip);
            chipRow.appendChild(chips);
            body.appendChild(chipRow);
          }
        }
      });

      // Approach rec from GPS continuation
      const gpsRec = approachRecHtml(gpsContinuation.approach);
      if (gpsRec) {
        const appDiv = document.createElement('div');
        appDiv.className = 'cc-approach';
        appDiv.innerHTML =
          '<div class="cc-app-label">Final approach · adjusted</div>' +
          `<div class="cc-app-dist">${gpsContinuation.approach.toFixed(0)}<span class="cc-app-dist-unit">m</span></div>` +
          `<div class="cc-app-club">${gpsRec.lbl} — ${gpsRec.carry}m carry${gpsRec.windNote}</div>` +
          `<div class="cc-app-note">${gpsRec.aimNote}</div>`;
        body.appendChild(appDiv);
      }
    }

    // Wind effect summary row (suppress when GPS active)
    if (!gpsActive && windState.active && windState.enabled) {
      const anyDelta = activePlan.shots.reduce((acc, s) => {
        if (s.baseCarry != null) acc += Math.round(s.carry - s.baseCarry);
        return acc;
      }, 0);
      if (anyDelta !== 0) {
        const wRow = document.createElement('div');
        wRow.className = 'cc-wind-effect';
        const hw = windState.headwind?.toFixed(1) ?? '—';
        const dir = anyDelta < 0 ? 'head' : 'tail';
        wRow.innerHTML =
          `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#bbb" stroke-width="2" stroke-linecap="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2"/><path d="M8 11.03A2.5 2.5 0 1 1 9.5 16H2"/></svg>` +
          `<span class="cc-wind-effect-text">${hw} m/s ${dir}wind</span>` +
          `<span class="cc-wind-effect-val${anyDelta > 0 ? ' help' : ''}">${anyDelta > 0 ? '+' : ''}${anyDelta}m total</span>`;
        body.appendChild(wRow);
      }
    }

    // Approach rec + crosswind (suppress when GPS active — continuation has its own)
    if (!gpsActive) {
    const _appOverKey = activePlan.shots.length === 1 ? (approachOverrides[_hk(basePlan.type)] || null) : null;
    const _appDistForRec = _appOverKey
      ? (() => { const oc = clubsList.find(c => c.key === _appOverKey); return oc ? activePlan.approach : activePlan.approach; })()
      : activePlan.approach;
    const rec = _appOverKey
      ? (() => {
          const oc = clubsList.find(c => c.key === _appOverKey);
          if (!oc) return approachRecHtml(activePlan.approach);
          const runUp = Math.round(activePlan.approach - oc.carry);
          const lbl2 = clubMap[oc.key]?.label ?? oc.key;
          let windNote2 = '';
          if (windState.active && windState.enabled && oc.baseCarry != null) {
            const d = Math.round(oc.carry - oc.baseCarry);
            if (d !== 0) windNote2 = ` (${d > 0 ? '+' : ''}${d}m wind)`;
          }
          const aimNote2 = runUp <= 2 ? 'Carry it all the way — minimal roll'
            : runUp <= 8 ? `Land ${runUp}m short and let it release`
            : `Land ${runUp}m short — play a bump and run`;
          return { lbl: lbl2, carry: oc.carry.toFixed(0), windNote: windNote2, aimNote: aimNote2 };
        })()
      : approachRecHtml(activePlan.approach);
    if (rec) {
      const appDiv = document.createElement('div');
      appDiv.className = 'cc-approach';
      appDiv.innerHTML =
        `<div class="cc-app-label">${completedShots.length > 0 ? 'Approach · adjusted' : 'Approach'}</div>` +
        `<div class="cc-app-dist">${activePlan.approach.toFixed(0)}<span class="cc-app-dist-unit">m</span></div>` +
        `<div class="cc-app-club">${rec.lbl} — ${rec.carry}m carry${rec.windNote}</div>` +
        `<div class="cc-app-note">${rec.aimNote}</div>`;
      body.appendChild(appDiv);
    }

    // Crosswind
    const cwSide = crosswindSide(windState);
    if (cwSide !== 'none') {
      const aimSide = cwSide === 'left' ? 'right' : 'left';
      const cwDiv   = document.createElement('div');
      cwDiv.className = 'cc-crosswind';
      cwDiv.innerHTML =
        `<div class="cc-crosswind-title">${windState.crosswind.toFixed(1)} m/s crosswind from the ${cwSide}</div>` +
        `<div class="cc-crosswind-note">Aim ${aimSide} into the wind</div>`;
      body.appendChild(cwDiv);
    }
    } // end !gpsActive

    card.appendChild(body);

    // ── Strategy footer strip
    const stratFooter = document.createElement('div');
    stratFooter.className = 'cc-strat-footer';
    if (!teeMarked) {
      ordered.forEach(plan => {
        const res = teeOverrides[_hk(plan.type)] ? (solveForced(teeOverrides[_hk(plan.type)]) || plan) : plan;
        const withS2 = (shot2Overrides[_hk(plan.type)] && res.shots?.length >= 2)
          ? (buildPlanWithShot2Override(plan, res, shot2Overrides[_hk(plan.type)]) || res) : res;
        const teeKey = teeOverrides[_hk(plan.type)] || plan.shots[0].key;
        const teeLabel = clubMap[teeKey]?.label ?? teeKey;
        const diff = withS2.score - parValue;
        const diffStr = diff === 0 ? 'E' : (diff > 0 ? '+' + diff.toFixed(1) : diff.toFixed(1));
        const btn = document.createElement('div');
        btn.className = 'cc-strat-btn' + (plan.type === basePlan.type && !override ? ' active' : '');
        const clubEl = document.createElement('div'); clubEl.className = 'cc-strat-btn-club'; clubEl.textContent = teeLabel;
        const scoreEl = document.createElement('div'); scoreEl.className = 'cc-strat-btn-score'; scoreEl.textContent = withS2.score.toFixed(1) + ' · ' + diffStr;
        btn.appendChild(clubEl); btn.appendChild(scoreEl);
        btn.addEventListener('click', () => {
          if (teeOverrides[_hk(plan.type)]) teeOverrides[_hk(plan.type)] = null;
          switchStrategyCard(plan.type);
        });
        stratFooter.appendChild(btn);
      });
      // Bag button — custom tee club
      const bagBtn = document.createElement('div');
      bagBtn.className = 'cc-strat-btn' + (override ? ' active' : '');
      const bagBtnInner = document.createElement('div');
      bagBtnInner.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;';
      const bagBtnSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      bagBtnSvg.setAttribute('width', '18'); bagBtnSvg.setAttribute('height', '27');
      bagBtnSvg.setAttribute('viewBox', '0 0 349 518'); bagBtnSvg.setAttribute('fill', 'none');
      bagBtnSvg.style.color = override ? 'inherit' : '#888';
      bagBtnSvg.innerHTML = '<path d="M319.865 425.637C314.058 433.485 298.865 430.637 298.865 430.637V189.637C298.865 189.637 316.842 186.765 321.865 195.137C324.879 200.16 323.865 210.137 323.865 210.137V412.137C323.865 412.137 324.163 419.829 319.865 425.637Z" fill="currentColor"/><path d="M84.8653 448.637H267.365V189.637L48.8653 287.137V347.637V438.137C48.8653 448.637 84.8653 448.637 84.8653 448.637Z" fill="currentColor"/><path d="M84.8653 237.137V216.637H133.865L84.8653 237.137Z" fill="currentColor"/><path d="M267.365 150.137L198.365 183.637H84.8653V129.637H133.283L129.865 85.6371C129.865 85.6371 64.7881 120.204 28.3653 103.137C20.4185 99.4134 14.8441 97.9927 9.36529 91.1371C3.58296 83.9017 3.45838 77.7611 1.86529 68.6371C0.018102 58.0577 0.0719012 51.7257 1.86529 41.1371C3.44295 31.8222 3.3754 25.4431 9.36529 18.1371C17.3653 8.37935 27.8653 6.63706 35.3653 3.13704C42.8653 -0.362974 80.5689 -1.43121 112.365 6.63708C120.924 8.80888 126.141 9.35914 133.865 13.6371C141.149 17.6706 149.865 23.137 150.365 27.1371C152.425 43.6149 159.915 107.608 162.489 129.637H177.34L243.865 18.1371C243.865 18.1371 252.242 9.10153 259.365 6.63708C267.116 3.95559 272.444 4.5145 280.365 6.63708C287.365 8.51272 338.865 37.137 344.865 49.6371C350.196 60.7433 348.018 69.2824 344.996 81.1235L344.865 81.6371C341.05 96.5988 336.931 106.91 323.865 115.137C315.286 120.539 308.964 123.035 298.865 122.137C291.171 121.453 287.193 118.75 280.365 115.137C261.546 105.179 243.865 74.6371 243.865 74.6371L213.945 129.637H259.365C262.49 129.637 267.365 129.013 267.365 132.137V150.137Z" fill="currentColor"/><path d="M267.365 507.762V498.387V489.012C267.365 489.012 268.437 483.743 265.865 481.137C263.259 478.496 257.865 479.637 257.865 479.637H93.3653C93.3653 479.637 89.3245 479.407 86.8653 481.637C84.153 484.096 84.8653 489.012 84.8653 489.012V498.387V507.762C84.8653 507.762 84.153 513.178 86.8653 515.637C89.3245 517.867 93.3653 517.137 93.3653 517.137H257.865C257.865 517.137 263.259 518.278 265.865 515.637C268.437 513.031 267.365 507.762 267.365 507.762Z" fill="currentColor"/>';
      const bagBtnLbl = document.createElement('span');
      bagBtnLbl.className = 'cc-strat-btn-club'; bagBtnLbl.style.color = override ? 'inherit' : '#ccc'; bagBtnLbl.textContent = 'Bag';
      bagBtnInner.appendChild(bagBtnSvg); bagBtnInner.appendChild(bagBtnLbl);
      bagBtn.appendChild(bagBtnInner);
      bagBtn.addEventListener('click', () => {
        const currentKey = teeOverrides[_hk(basePlan.type)] || basePlan.shots[0].key;
        openClubPicker(currentKey, (selectedKey) => {
            teeOverrides[_hk(basePlan.type)] = selectedKey !== basePlan.shots[0].key ? selectedKey : null;
            const newCard = buildStrategyCard(basePlan, cardIndex, totalCards, detailOpen);
            newCard.id = 'activeStrategyCard'; newCard.classList.add('active-card'); card.replaceWith(newCard); syncOuterHeight(); updateCompareTable();
          }, { type: 'par', parValue });
      });
      stratFooter.appendChild(bagBtn);
    }

    // Detail section — appended BEFORE stratFooter so it shows above
    const detail     = document.createElement('div');
    detail.className = 'cc-detail' + (detailOpen ? ' open' : '');
    const detailLbl  = document.createElement('div');
    detailLbl.className = 'cc-detail-lbl';
    detailLbl.textContent = 'Shot detail';
    detail.appendChild(detailLbl);

    activePlan.shots.forEach((s, i) => {
      const lbl     = clubMap[s.key]?.label ?? s.key;
      const rollAmt = (s.total - s.carry).toFixed(0);
      const rollStr = s.roll > 1.00
        ? `carry ${s.carry.toFixed(0)}m + ${rollAmt}m roll`
        : 'carry = total';
      const row = document.createElement('div');
      row.className = 'cc-detail-row';
      row.innerHTML =
        `<span class="cc-detail-key">Shot ${i + 1}: ${lbl}</span>` +
        `<span class="cc-detail-val">${rollStr}</span>`;
      detail.appendChild(row);
    });

    card.appendChild(detail);
    header.addEventListener('click', () => detail.classList.toggle('open'));

    if (!teeMarked) card.appendChild(stratFooter);

    return card;
  }

  // ── Build compare card ────────────────────────────────────────────────
  function buildCompareCard() {
    const card = document.createElement('div');
    card.className = 'carousel-card compare-card';
    card.id = 'compareCard';

    const deltaSection = document.createElement('div');
    deltaSection.className = 'cc-delta-section';
    deltaSection.id = 'compareDeltaSection';
    card.appendChild(deltaSection);

    const tableWrap = document.createElement('div');
    tableWrap.id = 'compareTableWrap';
    card.appendChild(tableWrap);

    const footer = document.createElement('div');
    footer.className = 'cc-compare-footer';
    footer.textContent = 'Tap a column to switch strategy · swipe right to play';
    card.appendChild(footer);

    buildDeltaSection(deltaSection);
    buildCompareTable(tableWrap);
    return card;
  }

  function buildDeltaSection(wrap) {
    if (!ordered.length) { wrap.style.display = 'none'; return; }
    const currentType = getCurrentCarouselType();
    const plans = ordered.map(p => {
      const ov = teeOverrides[_hk(p.type)];
      const resolved = ov ? (solveForced(ov) || p) : p;
      const s2Key = shot2Overrides[_hk(p.type)];
      if (s2Key && resolved.shots?.length >= 2) {
        const override = buildPlanWithShot2Override(p, resolved, s2Key);
        return override ? { ...override, type: p.type } : resolved;
      }
      return resolved;
    });
    const scores = plans.map(p => p.score);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const range = maxScore - minScore;
    const barColors = { 'Max distance': '#a05a5a', 'Controlled': '#986840', 'Conservative': '#347a50' };
    const shortNames = { 'Max distance': 'Max dist', 'Controlled': 'Controlled', 'Conservative': 'Conserv' };

    let rowsHtml = plans.map((p, i) => {
      const score = scores[i];
      const diff  = score - parValue;
      const diffStr = diff === 0 ? 'E' : (diff > 0 ? '+' + diff.toFixed(1) : diff.toFixed(1));
      const isBest = score === minScore;
      const barPct = range > 0.01
        ? 30 + Math.round(((score - minScore) / range) * 55)
        : 55;
      const color = barColors[p.type] || '#888';
      const name  = shortNames[p.type] || p.type;
      return `<div class="cc-delta-row">
        <div class="cc-delta-name">${name}</div>
        <div class="cc-delta-bar-wrap">
          <div class="cc-delta-bar" style="width:${barPct}%;background:${color};"></div>
          <span class="cc-delta-val${isBest ? ' best' : ''}">${score.toFixed(1)} (${diffStr})</span>
        </div>
      </div>`;
    }).join('');

    // Insight line: savings between best and worst strategy
    let insightHtml = '';
    if (range > 0.05) {
      const bestPlan  = plans[scores.indexOf(minScore)];
      const worstPlan = plans[scores.indexOf(maxScore)];
      const bestShort  = shortNames[bestPlan.type]  || bestPlan.type;
      const worstShort = shortNames[worstPlan.type] || worstPlan.type;
      insightHtml = `<div class="cc-delta-insight">${bestShort} saves ${range.toFixed(1)} strokes vs ${worstShort} on this hole</div>`;
    }

    wrap.innerHTML =
      `<div class="cc-delta-label">Expected strokes</div>${rowsHtml}${insightHtml}`;
  }

  function buildCompareTable(wrap) {
    const types = ordered.map(p => p.type);
    const currentType = getCurrentCarouselType();

    // Resolve the active plan per type (apply tee and shot2 overrides if set)
    function getActivePlan(t) {
      const base = ordered.find(p => p.type === t);
      if (!base) return null;
      const ov = teeOverrides[_hk(t)];
      const resolved = ov ? (solveForced(ov) || base) : base;
      const s2Key = shot2Overrides[_hk(t)];
      if (s2Key && resolved.shots?.length >= 2) {
        const override = buildPlanWithShot2Override(base, resolved, s2Key);
        return override ? { ...override, type: t } : resolved;
      }
      return resolved;
    }

    let thead = `<thead><tr><th></th>`;
    types.forEach(t => {
      const active = t === currentType;
      thead += `<th class="${active ? 'active-col' : ''}">${strategyShortName(t)}</th>`;
    });
    thead += `</tr></thead>`;

    let approachRow = `<tr><td>Approach</td>`;
    types.forEach(t => {
      const p = getActivePlan(t);
      const active = t === currentType;
      const cls = t === 'Controlled' ? 'balanced' : t === 'Conservative' ? 'safe' : '';
      approachRow += `<td class="${active ? 'active-col' : ''}"><span class="cv-primary ${cls}">${p ? p.approach.toFixed(0) + 'm' : '—'}</span></td>`;
    });
    approachRow += `</tr>`;

    const maxShotsInPlan = Math.max(...ordered.map(p => p.shots.length));
    let shotRows = '';
    for (let i = 0; i < maxShotsInPlan; i++) {
      shotRows += `<tr><td>Shot ${i + 1}</td>`;
      types.forEach(t => {
        const p = getActivePlan(t);
        const active = t === currentType;
        const s = p?.shots[i];
        if (s) {
          const lbl = clubMap[s.key]?.label ?? s.key;
          let windDelta = '';
          if (windState.active && windState.enabled && s.baseCarry != null) {
            const delta = Math.round(s.carry - s.baseCarry);
            if (delta !== 0) windDelta = `<span class="cv-wind">${delta > 0 ? '+' : ''}${delta}m wind</span>`;
          }
          shotRows += `<td class="${active ? 'active-col' : ''}"><span class="cv-club">${lbl}</span><span class="cv-dist">${s.total.toFixed(0)}m</span>${windDelta}</td>`;
        } else {
          shotRows += `<td class="${active ? 'active-col' : ''}"><span style="color:#ccc">—</span></td>`;
        }
      });
      shotRows += `</tr>`;
    }

    let greenRow = `<tr><td>Into green</td>`;
    types.forEach(t => {
      const p = getActivePlan(t);
      const active = t === currentType;
      const rec = p ? approachClub(p.approach) : null;
      if (rec) {
        const lbl = clubMap[rec.key]?.label ?? rec.key;
        let windDelta = '';
        if (windState.active && windState.enabled && rec.baseCarry != null) {
          const delta = Math.round(rec.carry - rec.baseCarry);
          if (delta !== 0) windDelta = `<span class="cv-wind">${delta > 0 ? '+' : ''}${delta}m wind</span>`;
        }
        greenRow += `<td class="${active ? 'active-col' : ''}"><span class="cv-club">${lbl}</span><span class="cv-dist">${rec.carry.toFixed(0)}m carry</span>${windDelta}</td>`;
      } else {
        greenRow += `<td class="${active ? 'active-col' : ''}">—</td>`;
      }
    });
    greenRow += `</tr>`;

    wrap.innerHTML = `<table class="cc-compare-table">${thead}<tbody>${approachRow}${shotRows}${greenRow}</tbody></table>`;

    // Tap a column header to switch strategy and return to strategy card
    wrap.querySelectorAll('thead th:not(:first-child)').forEach((th, i) => {
      const t = types[i];
      if (!t) return;
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => {
        switchStrategyCard(t);
        goToCard(0);
      });
    });
  }

  function updateCompareTable() {
    const wrap = document.getElementById('compareTableWrap');
    if (wrap) buildCompareTable(wrap);
    const delta = document.getElementById('compareDeltaSection');
    if (delta) buildDeltaSection(delta);
  }

  // ── Carousel state ────────────────────────────────────────────────────
  let currentCardIndex = 0;
  let lastStrategyCardIndex = 0; // tracks last non-compare card viewed

  function getCurrentCarouselType() {
    const card = document.getElementById('activeStrategyCard');
    return card?.dataset.type || ordered[0]?.type || null;
  }

  // ── Build carousel ────────────────────────────────────────────────────
  const carouselOuter = document.createElement('div');
  carouselOuter.className = 'carousel-outer';
  const track = document.createElement('div');
  track.className = 'carousel-track';
  track.id = 'carouselTrack';
  carouselOuter.appendChild(track);
  output.innerHTML = '';
  output.appendChild(carouselOuter);

  // Update action row
  if (updateCalcButtonVisibility) updateCalcButtonVisibility();


  currentCardIndex = 0;
  const shownPlan    = ordered.find(p => p.type === activePlanType) || ordered[0];
  const strategyCard = buildStrategyCard(shownPlan, 0, 2, false);
  strategyCard.id    = 'activeStrategyCard';
  track.appendChild(strategyCard);

  // Commit initial plan with tee club
  try {
    const _sess2 = loadActiveCourse();
    if (_sess2.id && shownPlan) {
      const { holeIdx: _hi2 } = _sess2;
      const _committed2 = getCommittedStrategies();
      const _teeKey2 = teeOverrides[_hk(shownPlan.type)] || (shownPlan.shots[0]?.key ?? null);
      _committed2[_hi2] = _teeKey2
        ? encodeStrategy(shownPlan.type, _teeKey2)
        : shownPlan.type;
      setCommittedStrategies(null, _committed2);
    }
  } catch(e) {}

  // Build compare card
  const compareCard = buildCompareCard();
  track.appendChild(compareCard);

  // ── Swipe logic ───────────────────────────────────────────────────────
  // ── Dot indicator ─────────────────────────────────────────────────
  const dotsWrap = document.createElement('div');
  dotsWrap.className = 'carousel-dots';
  const dot0 = document.createElement('div');
  dot0.className = 'carousel-dot active';
  const dot1 = document.createElement('div');
  dot1.className = 'carousel-dot';
  dot0.addEventListener('click', () => goToCard(0));
  dot1.addEventListener('click', () => goToCard(1));
  dotsWrap.appendChild(dot0);
  dotsWrap.appendChild(dot1);
  output.appendChild(dotsWrap);

  function updateDots(idx) {
    dot0.className = 'carousel-dot' + (idx === 0 ? ' active' : '');
    dot1.className = 'carousel-dot' + (idx === 1 ? ' active' : '');
  }

  function getCardWidth() {
    const firstCard = track.querySelector('.carousel-card');
    return firstCard ? firstCard.offsetWidth : 0;
  }

  function syncOuterHeight() { /* no-op: height managed by active-card display */ }

  function goToCard(idx, animate = true) {
    const totalCards = 2; // strategy card + compare card
    idx = Math.max(0, Math.min(idx, totalCards - 1));
    currentCardIndex = idx;
    if (typeof updateDots === 'function') updateDots(currentCardIndex);
    if (typeof updateDots === 'function') updateDots(currentCardIndex);
    // Track last strategy card (not compare card) for column highlighting
    if (ordered[idx]?.type) lastStrategyCardIndex = idx;
    // Show only active card
    track.querySelectorAll('.carousel-card').forEach((c, i) => {
      c.classList.toggle('active-card', i === idx);
    });

    // Only persist strategy when on the strategy card (idx 0), not compare card
    if (idx === 0) {
      try {
        const committed = getCommittedStrategies();
        const sess = loadActiveCourse();
        if (sess.id) {
          const { holeIdx } = sess;
          const _goType = getCurrentCarouselType();
          if (_goType) {
            const _goPlan = ordered.find(p => p.type === _goType);
            const _goTeeKey = teeOverrides[_hk(_goType)] || (_goPlan?.shots[0]?.key ?? null);
            committed[holeIdx] = _goTeeKey
              ? encodeStrategy(_goType, _goTeeKey)
              : _goType;
          }
          setCommittedStrategies(null, committed);
        }
      } catch(e) {}
    }

    updateCompareTable();
  }

  goToCard(currentCardIndex, false);
  syncOuterHeight();

  // Touch swipe
  let touchStartX = null;
  let touchStartY = null;
  let isSwiping   = false;

  carouselOuter.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isSwiping = false;
  }, { passive: true });

  carouselOuter.addEventListener('touchmove', e => {
    if (touchStartX === null) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    if (!isSwiping && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
      isSwiping = true;
    }
    if (isSwiping) e.preventDefault();
  }, { passive: false });

  carouselOuter.addEventListener('touchend', e => {
    if (!isSwiping || touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) {
      goToCard(dx < 0 ? currentCardIndex + 1 : currentCardIndex - 1);
    }
    touchStartX = null;
    isSwiping = false;
  }, { passive: true });

  // ── Chip-driven strategy switching ───────────────────────────────────
  function switchStrategyCard(planType) {
    const plan = ordered.find(p => p.type === planType);
    if (!plan) return;
    const oldCard = document.getElementById('activeStrategyCard');
    if (!oldCard) return;
    const newCard = buildStrategyCard(plan, 0, 2, false);
    newCard.id = 'activeStrategyCard';
    newCard.classList.add('active-card');
    oldCard.replaceWith(newCard);
    updateCompareTable();
    // Card heights are equalised by ghost row — no scroll needed on strategy switch
    // Persist committed strategy
    try {
      const committed = getCommittedStrategies();
      const sess = loadActiveCourse();
      if (sess.id) {
        const { holeIdx } = sess;
        const _activePlan = ordered.find(p => p.type === planType);
        const _teeKey = teeOverrides[_hk(planType)] || (_activePlan?.shots[0]?.key ?? null);
        committed[holeIdx] = _teeKey ? encodeStrategy(planType, _teeKey) : planType;
        setCommittedStrategies(null, committed);
      }
    } catch(e) {}
  };

}
