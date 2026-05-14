/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — secondary actions row: Penalty + Holed Out.

import { tap as hapticTap } from '../../platform/haptics.js';

/**
 * @param {object} opts
 * @param {Function} opts.onPenalty        () => void  — first tap: record penalty lie
 * @param {Function} opts.onPenaltyRelief  () => void  — second tap: add +1 relief stroke
 * @param {Function} opts.onHoledOut       () => void
 * @param {Function} [opts.onPickUp]       () => void  — stableford only
 * @param {boolean}  [opts.showPickUp]
 * @param {boolean}  [opts.penaltyPending] — true = show "OB / Drop +1" instead of "Penalty"
 * @returns {HTMLElement}
 */
export function renderSecondaryActions({ onPenalty, onPenaltyRelief, onHoledOut, onPickUp, showPickUp, penaltyPending }) {
  const row = document.createElement('div');
  row.className = 'sh-secondary';

  const penBtn = document.createElement('button');
  penBtn.className = 'sh-sec-btn penalty';
  penBtn.type = 'button';
  const _dropSvg = `<svg viewBox="-2.000 -74.459 71.570 80.459" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M33.7891 3.85742C49.9512 3.85742 60.7422-6.68945 60.7422-22.4609C60.7422-30.4688 57.6172-38.1836 55.6641-42.6758C51.5625-52.0508 44.9707-62.4023 39.3555-70.9961C37.8906-73.1934 36.1816-74.4629 33.7891-74.4629C31.3477-74.4629 29.6875-73.1934 28.2715-70.9961C22.6562-62.4023 16.0156-52.0508 11.9141-42.6758C9.96094-38.1836 6.83594-30.4688 6.83594-22.4609C6.83594-6.68945 17.627 3.85742 33.7891 3.85742ZM33.7891-3.27148C21.875-3.27148 13.9648-10.9375 13.9648-22.4609C13.9648-28.9062 16.4062-34.8145 18.2617-39.2578C22.6562-49.6094 28.3203-57.7148 33.6426-65.6738C33.7402-65.8691 33.8867-65.8691 33.9844-65.6738C39.2578-57.7148 45.0195-49.6094 49.2676-39.2578C51.123-34.8145 53.6133-28.9062 53.6133-22.4609C53.6133-10.9375 45.7031-3.27148 33.7891-3.27148Z"/></svg>`;
  penBtn.innerHTML = penaltyPending
    ? `${_dropSvg} OB / Drop +1`
    : `${_dropSvg} Penalty`;
  penBtn.addEventListener('click', () => {
    hapticTap();
    if (penaltyPending) onPenaltyRelief?.();
    else onPenalty();
  });

  const holedBtn = document.createElement('button');
  holedBtn.className = 'sh-sec-btn holed';
  holedBtn.type = 'button';
  holedBtn.innerHTML = `
    <svg viewBox="-2.000 -74.459 93.250 80.459" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M15.0879 2.92969C16.8945 2.92969 18.3594 1.46484 18.3594-0.341797L18.3594-20.9961C19.2383-21.4844 22.8516-22.8027 28.2227-22.8027C42.5781-22.8027 51.6602-15.8203 65.1367-15.8203C71.2891-15.8203 73.4375-16.4551 76.4648-17.8223C79.248-19.043 81.0547-21.2402 81.0547-25.0977L81.0547-64.4531C81.0547-66.6504 79.1016-67.9688 76.6113-67.9688C74.707-67.9688 71.1914-66.4062 64.6484-66.4062C51.1719-66.4062 42.0898-73.3887 27.7344-73.3887C21.582-73.3887 19.4336-72.7539 16.4062-71.3867C13.623-70.166 11.7676-67.9688 11.7676-64.0625L11.7676-0.341797C11.7676 1.41602 13.2812 2.92969 15.0879 2.92969ZM65.1367-22.4121C52.5391-22.4121 43.2617-29.3457 28.2227-29.3457C23.877-29.3457 19.9707-28.8086 18.3594-28.0762L18.3594-63.8184C18.8477-64.9902 21.7773-66.7969 27.7344-66.7969C41.2109-66.7969 50.4883-59.8145 64.6484-59.8145C68.9941-59.8145 72.4121-60.3516 74.5117-60.9375L74.5117-25.3906C73.9746-24.1699 71.0938-22.4121 65.1367-22.4121Z"/></svg>
    Holed out`;
  holedBtn.addEventListener('click', () => { hapticTap(); onHoledOut(); });

  row.appendChild(penBtn);
  row.appendChild(holedBtn);

  if (showPickUp && onPickUp) {
    const pickBtn = document.createElement('button');
    pickBtn.className = 'sh-sec-btn pickup';
    pickBtn.type = 'button';
    pickBtn.innerHTML = `
      <svg viewBox="-2.000 -74.459 96.530 80.459" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M46.2402 4.15039C68.0176 4.15039 85.6934-13.4766 85.6934-35.2539C85.6934-57.0312 68.0176-74.6582 46.2402-74.6582C24.5117-74.6582 6.83594-57.0312 6.83594-35.2539C6.83594-13.4766 24.5117 4.15039 46.2402 4.15039ZM46.2402-3.27148C28.5645-3.27148 14.3066-17.5781 14.3066-35.2539C14.3066-52.9297 28.5645-67.2363 46.2402-67.2363C63.916-67.2363 78.2227-52.9297 78.2227-35.2539C78.2227-17.5781 63.916-3.27148 46.2402-3.27148ZM42.041-17.0898C43.457-17.0898 44.6777-17.7734 45.5566-19.1406L62.3535-45.7031C62.8906-46.582 63.4277-47.5586 63.4277-48.5352C63.4277-50.4883 61.7188-51.709 59.8633-51.709C58.7402-51.709 57.666-51.0742 56.8359-49.7559L41.8457-25.4395L35.1074-34.5215C34.0332-35.9375 33.0566-36.2793 31.8848-36.2793C29.9805-36.2793 28.5156-34.7656 28.5156-32.8125C28.5156-31.8848 28.9062-30.957 29.4922-30.127L38.2812-19.1406C39.4043-17.6758 40.5762-17.0898 42.041-17.0898Z"/></svg>
      Pick up`;
    pickBtn.addEventListener('click', () => { hapticTap(); onPickUp(); });
    row.appendChild(pickBtn);
  }

  return row;
}
