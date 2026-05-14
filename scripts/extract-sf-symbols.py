#!/usr/bin/env python3
"""Extract Regular-S weight paths from SF Symbols template SVGs into clean web-ready SVGs."""

import xml.etree.ElementTree as ET
import re
import os
import glob

SVG_NS = 'http://www.w3.org/2000/svg'

def find_by_id(root, elem_id):
    for e in root.iter(f'{{{SVG_NS}}}g'):
        if e.get('id') == elem_id:
            return e
    return None

def extract_symbol(input_path, output_path):
    tree = ET.parse(input_path)
    root = tree.getroot()

    symbols_g = find_by_id(root, 'Symbols')
    if symbols_g is None:
        print(f'  SKIP (no Symbols group): {os.path.basename(input_path)}')
        return False

    regular_s = None
    for g in symbols_g:
        if g.get('id') == 'Regular-S':
            regular_s = g
            break

    if regular_s is None:
        print(f'  SKIP (no Regular-S): {os.path.basename(input_path)}')
        return False

    # Parse matrix(1 0 0 1 tx ty) translation
    transform = regular_s.get('transform', '')
    m = re.search(r'matrix\(([^)]+)\)', transform)
    if m:
        parts = m.group(1).split()
        tx, ty = float(parts[4]), float(parts[5])
    else:
        tx, ty = 0.0, 0.0

    # Read margin/baseline guides for Regular-S and Small scale
    guides_g = find_by_id(root, 'Guides')
    lm, rm = tx, tx + 100
    capline, baseline = ty - 70, ty

    if guides_g is not None:
        for line in guides_g.iter(f'{{{SVG_NS}}}line'):
            lid = line.get('id', '')
            if lid == 'left-margin-Regular-S':
                lm = float(line.get('x1', lm))
            elif lid == 'right-margin-Regular-S':
                rm = float(line.get('x1', rm))
            elif lid == 'Baseline-S':
                baseline = float(line.get('y1', baseline))
            elif lid == 'Capline-S':
                capline = float(line.get('y1', capline))

    # Collect all path elements (handles multicolor/multi-path symbols)
    paths = [p.get('d', '').strip() for p in regular_s.iter(f'{{{SVG_NS}}}path')]
    paths = [d for d in paths if d]

    if not paths:
        print(f'  SKIP (no paths): {os.path.basename(input_path)}')
        return False

    # ViewBox in path-local coordinates (origin = transform anchor)
    # Add a small buffer so descenders/ascenders aren't clipped
    vb_x = (lm - tx) - 2
    vb_y = (capline - ty) - 4
    vb_w = (rm - lm) + 4
    vb_h = (baseline - capline) + 10

    path_els = '\n  '.join(f'<path d="{d}" fill="currentColor"/>' for d in paths)
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="{vb_x:.3f} {vb_y:.3f} {vb_w:.3f} {vb_h:.3f}">\n'
        f'  {path_els}\n'
        f'</svg>\n'
    )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        f.write(svg)
    return True


INPUT_DIR  = os.path.join(os.path.dirname(__file__), '..', 'assets', 'SF Symbols')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sf-symbols-web')

files = sorted(glob.glob(os.path.join(INPUT_DIR, '*.svg')))
ok_count = 0
for svg_file in files:
    name = os.path.basename(svg_file)
    out  = os.path.join(OUTPUT_DIR, name)
    success = extract_symbol(svg_file, out)
    if success:
        print(f'  OK  {name}')
        ok_count += 1

print(f'\n{ok_count}/{len(files)} symbols extracted → {OUTPUT_DIR}')
