/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — result bar: slim / milestone_slim / celebration variants.

import { resultName, scoreLabel } from '../../engine/resultTier.js';

const ARROW_SVG = `<svg viewBox="-2.000 -74.459 94.570 80.459" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M51.3672-5.95703C52.3926-5.95703 53.3691-6.34766 54.248-7.17773L79.4434-32.3242C80.3223-33.1543 80.8105-34.1797 80.8105-35.2539C80.8105-36.3281 80.3223-37.3535 79.4434-38.1836L54.248-63.3301C53.3691-64.1602 52.3926-64.5508 51.3672-64.5508C49.2188-64.5508 47.5586-62.9395 47.5586-60.7422C47.5586-59.7168 47.9004-58.6914 48.6328-58.0078L55.3711-51.0254L72.8516-35.2539L55.3711-19.4824L48.6328-12.5C47.9004-11.8164 47.5586-10.791 47.5586-9.76562C47.5586-7.56836 49.2188-5.95703 51.3672-5.95703ZM13.6719-31.2988L59.7656-31.2988L72.7539-32.2266C74.5605-32.373 75.7812-33.4473 75.7812-35.2539C75.7812-37.0605 74.5605-38.1348 72.7539-38.2812L59.7656-39.209L13.6719-39.209C11.377-39.209 9.76562-37.5488 9.76562-35.2539C9.76562-32.959 11.377-31.2988 13.6719-31.2988Z"/></svg>`;

const TIER_EMOJI = {
  celebration_hio:        '⛳',
  celebration_albatross:  '🦆',
  celebration_eagle:      '🦅',
  celebration_birdie:     '🐦',
};
const TIER_NAME = {
  celebration_hio:        'Hole in one',
  celebration_albatross:  'Albatross',
  celebration_eagle:      'Eagle',
  celebration_birdie:     'Birdie',
};
const TIER_CSS = {
  celebration_hio:        'hio',
  celebration_albatross:  'albatross',
  celebration_eagle:      'eagle',
  celebration_birdie:     'birdie',
};

function _autoGir(shots, par) {
  return shots.length <= (par - 2);
}
function _autoFw(shots, par) {
  if (par <= 3 || shots.length < 2) return false;
  const ROUGH = new Set(['rough', 'sand', 'penalty']);
  return !ROUGH.has(shots[1]);
}

/**
 * @param {object} opts
 * @param {'slim'|'milestone_slim'|'celebration_birdie'|'celebration_eagle'|'celebration_hio'} opts.tier
 * @param {string[]}  opts.shots
 * @param {number}    opts.putts
 * @param {number}    opts.par
 * @param {number}    opts.holeIdx    0-based
 * @param {string[]}  opts.milestones
 * @param {boolean}   opts.isFirstOfType
 * @param {boolean}   opts.isLastHole
 * @param {Function}  opts.onNext
 */
export function renderResultBar({ tier, shots, putts, par, holeIdx, milestones, isFirstOfType, isLastHole, onNext, penaltyStrokes }) {
  const totalShots = shots.length + putts + (penaltyStrokes ?? 0);
  const gir = _autoGir(shots, par);
  const fw  = _autoFw(shots, par);
  const nextLabel = isLastHole ? 'Finish round' : `Hole ${holeIdx + 2}`;

  if (tier === 'slim' || tier === 'milestone_slim') {
    return _renderSlim({ tier, shots, putts, par, totalShots, gir, fw, milestones, nextLabel, onNext });
  }
  return _renderCelebration({ tier, shots, putts, par, totalShots, gir, fw, isFirstOfType, holeIdx, nextLabel });
}

function _renderSlim({ tier, shots, putts, par, totalShots, gir, fw, milestones, nextLabel, onNext }) {
  const el = document.createElement('div');
  el.className = `sh-result-slim${tier === 'milestone_slim' ? ' milestone' : ''}`;

  const left = document.createElement('div');
  left.className = 'sh-result-slim-left';

  const pill = document.createElement('div');
  pill.className = 'sh-score-pill';
  const diff = totalShots - par;
  if (diff > 0) pill.classList.add('over');
  else if (diff < 0) pill.classList.add('under');
  pill.textContent = totalShots;
  left.appendChild(pill);

  const meta = document.createElement('div');
  meta.className = 'sh-result-meta';

  let topLine = resultName(totalShots, par);
  if (tier === 'milestone_slim' && milestones.length > 0) {
    const msLabel = _milestoneLabel(milestones[0]);
    topLine += ` · <span class="gold">★ ${msLabel}</span>`;
  }
  const dimLine = `<span class="dim">${totalShots} shot${totalShots !== 1 ? 's' : ''} · ${putts} putt${putts !== 1 ? 's' : ''}</span>`;
  meta.innerHTML = `${topLine}<br>${dimLine}`;
  left.appendChild(meta);
  el.appendChild(left);

  // Inline next-hole button (slim only) — omitted when ConfirmRow handles navigation
  if (onNext) {
    const nextBtn = document.createElement('button');
    nextBtn.className = 'sh-result-next';
    nextBtn.type = 'button';
    nextBtn.innerHTML = `${nextLabel} ${ARROW_SVG}`;
    nextBtn.addEventListener('click', onNext);
    el.appendChild(nextBtn);
  }

  return el;
}

function _renderCelebration({ tier, shots, putts, par, totalShots, gir, fw, isFirstOfType, holeIdx }) {
  const el = document.createElement('div');
  el.className = `sh-celebrate ${TIER_CSS[tier]}`;

  const diff = totalShots - par;
  const diffStr = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;

  const kindEl = document.createElement('div');
  kindEl.className = 'sh-celebrate-kind';
  kindEl.textContent = `${TIER_NAME[tier]} · Hole ${holeIdx + 1}`;
  el.appendChild(kindEl);

  const bigEl = document.createElement('div');
  bigEl.className = 'sh-celebrate-big';
  bigEl.innerHTML = `<span class="em">${TIER_EMOJI[tier]}</span>${diffStr}`;
  el.appendChild(bigEl);

  const metaEl = document.createElement('div');
  metaEl.className = 'sh-celebrate-meta';
  const holedStr = shots[shots.length - 1] === 'tee' ? 'from the tee' : `from the ${shots[shots.length - 1]}`;
  metaEl.textContent = putts > 0
    ? `${totalShots} shot${totalShots !== 1 ? 's' : ''} · ${putts} putt${putts !== 1 ? 's' : ''}`
    : `${shots.length} shot${shots.length !== 1 ? 's' : ''} · holed ${holedStr}`;
  el.appendChild(metaEl);

  const badges = document.createElement('div');
  badges.className = 'sh-celebrate-badges';

  if (isFirstOfType) {
    const starBadge = document.createElement('span');
    starBadge.className = 'sh-badge star';
    starBadge.textContent = `FIRST ${TIER_NAME[tier].toUpperCase()}`;
    badges.appendChild(starBadge);
  }
  if (gir) {
    const girBadge = document.createElement('span');
    girBadge.className = 'sh-badge';
    girBadge.textContent = 'GIR';
    badges.appendChild(girBadge);
  }
  if (fw) {
    const fwBadge = document.createElement('span');
    fwBadge.className = 'sh-badge';
    fwBadge.textContent = 'FAIRWAY';
    badges.appendChild(fwBadge);
  }

  if (badges.children.length > 0) el.appendChild(badges);
  return el;
}

function _milestoneLabel(id) {
  if (id === 'first_gir')      return 'First GIR';
  if (id === 'first_fw')       return 'First FW hit';
  if (id === 'first_one_putt') return 'First one-putt';
  return id;
}
