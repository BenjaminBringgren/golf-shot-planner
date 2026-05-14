# Pricing Strategy — Golf Shot Planner

## Context

The app is feature-complete with English UI — global launch is available from day one. This document covers competitor analysis, tier structure, pricing, and churn-adjusted revenue scenarios that include marketing spend and churn cost as explicit line items.

---

## Competitor Landscape (2026)

| App | Free Tier | Mid Tier | Premium | Notes |
|---|---|---|---|---|
| **Arccos Golf** | 45-day trial only | — | $199.99 / ~2,060 SEK/yr | Requires hardware sensors |
| **18Birdies** | Yes (GPS, scorecard) | — | $99.99 / ~1,030 SEK/yr | Wind/altitude behind paywall |
| **SwingU** | Yes (strong free) | $49.99 / ~515 SEK/yr | $99.99 / ~1,030 SEK/yr | 3 tiers; Apple Watch focus |
| **Golfshot** | Yes (GPS only) | $39.99 / ~412 SEK/yr | $59.98 / ~618 SEK/yr | 3 tiers; AR feature |
| **Hole19** | Yes (very strong) | — | $59.99 / ~618 SEK/yr | Most complete free tier |
| **Golf GameBook** | Yes (stroke play) | — | $39.99 / ~412 SEK/yr | Social/game-format focus |
| **GolfLogix** | Limited | — | $49.99–$69.99 / ~515–721 SEK/yr | Slope-adjusted distances |
| **Shot Scope** | N/A | — | $0 subscription | Hardware-only (~2,050 SEK device) |

*Exchange rate used throughout: 1 USD = 10.3 SEK*

**Market sweet spot: $39.99–$59.99/year (412–618 SEK/yr).**

### Features competitors gate behind paywall
- Wind + temperature + altitude adjustments (18Birdies, SwingU Plus)
- Strokes Gained / stroke loss attribution (all premium tiers)
- Club recommendations (nearly universal premium feature)
- Shot strategy recommendations — **not offered by any competitor at any price**
- Pre-round coaching — only SwingU Pro, 18Birdies Premium
- Round history beyond a limit (common gating mechanism)
- Advanced stats drill-downs

---

## Unique Differentiators

These features **do not exist in any competitor at any tier:**

1. **Shot strategy carousel** (Max Distance / Controlled / Conservative) with per-strategy expected strokes
2. **Per-strategy performance tracking** — learn which strategy scores best for you personally
3. **Wind + compass pin-and-shoot flow** — more intuitive than competitors' static wind entry
4. **Pre-round coaching** based on your own round history (not generic AI drills)
5. **No hardware required** — pure software, unlike Arccos's ~2,000 SEK sensor requirement

---

## Recommended Tier Structure: Two Tiers (Free + Pro)

### Free Tier — "Starter"

| Feature | Free |
|---|---|
| Shot planning (club distances, basic carry) | ✅ |
| Digital scorecard (stroke play, Stableford) | ✅ |
| Course management (add/edit courses) | ✅ |
| Round saving — **last 5 rounds only** | ✅ limited |
| Wind input — **manual entry only** | ✅ limited |
| Basic stats (GIR %, avg putts, rounds played) | ✅ |
| Handicap / WHS course handicap | ✅ |
| Club bag setup | ✅ |
| Live wind fetch + GPS compass flow | ❌ |
| Shot strategy carousel (Max/Controlled/Conservative) | ❌ |
| Strategy performance tracking | ❌ |
| Strokes Gained / stroke loss attribution | ❌ |
| Per-hole scoring averages vs par | ❌ |
| Pre-round focus coaching | ❌ |
| GPS shot tracking | ❌ |
| Unlimited round history | ❌ |
| Advanced stats drill-downs | ❌ |

### Pro Tier — "Golf Shot Planner Pro"
Everything in Free, plus all locked features above.

---

## Pricing

### App Store fixed price points

| | Monthly | Annual | Effective monthly |
|---|---|---|---|
| **SEK** | 49 SEK/mo | 349 SEK/yr | ~29 SEK/mo |
| **USD** | $5.99/mo | $49.99/yr | ~$4.17/mo |

Note: SEK and USD are separate App Store price tiers. Swedish users pay 349 SEK (~$34), international users pay $49.99 (~515 SEK). International subscribers generate ~47% more revenue per head on the annual plan.

### Developer payout after App Store cut

| Plan | Gross | Year 1 payout (30% cut) | Year 2+ payout (15% cut) |
|---|---|---|---|
| Annual – SEK | 349 SEK | 244 SEK | 297 SEK |
| Annual – USD | $49.99 | $35.00 | $42.49 |
| Monthly – SEK | 49 SEK/mo | 34 SEK/mo | 42 SEK/mo |
| Monthly – USD | $5.99/mo | $4.19/mo | $5.09/mo |

### Blended MRR per active subscriber (70% annual / 30% monthly)

| Market | Gross MRR/sub | Net MRR/sub — Year 1 (30% cut) | Net MRR/sub — Year 2+ (15% cut) |
|---|---|---|---|
| SEK | 35 SEK/mo | **25 SEK/mo** | **30 SEK/mo** |
| USD | $4.71/mo | **$3.30/mo** | **$4.00/mo** |

*Gross MRR = 0.70 × (annual ÷ 12) + 0.30 × monthly*

---

## Subscriber Milestone Revenue

Revenue at steady subscriber counts (year 2+ net rates, after App Store cut, before marketing).

| Active Subs | Monthly Net — SEK market | **Annual Revenue — SEK market** | Monthly Net — USD market | **Annual Revenue — USD market** |
|---|---|---|---|---|
| 1,000 | 30,000 SEK | **360,000 SEK** | $4,000 | **$48,000 (~494,000 SEK)** |
| 2,000 | 60,000 SEK | **720,000 SEK** | $8,000 | **$96,000 (~989,000 SEK)** |
| 3,000 | 90,000 SEK | **1,080,000 SEK** | $12,000 | **$144,000 (~1,483,000 SEK)** |
| 5,000 | 150,000 SEK | **1,800,000 SEK** | $20,000 | **$240,000 (~2,472,000 SEK)** |
| 10,000 | 300,000 SEK | **3,600,000 SEK** | $40,000 | **$480,000 (~4,944,000 SEK)** |
| 15,000 | 450,000 SEK | **5,400,000 SEK** | $60,000 | **$720,000 (~7,416,000 SEK)** |
| 20,000 | 600,000 SEK | **7,200,000 SEK** | $80,000 | **$960,000 (~9,888,000 SEK)** |

A real-world global subscriber base will be a mix of SEK and USD subscribers. USD subscribers pay more per head — at a 50/50 split, blended annual revenue per subscriber is ~420 SEK on the SEK market vs ~510 SEK equivalent on the USD market.

---

## Churn Model

Golf is seasonal — churn is higher than year-round apps.

### Churn rate assumptions

| Plan type | Monthly churn | Annual equivalent |
|---|---|---|
| Annual subscribers | 2.0%/month | ~22%/year |
| Monthly subscribers | 6.0%/month | ~52%/year |
| **Blended (70/30 split)** | **2.5%/month** | **~27%/year** |

Seasonal dip: expect 40–60% higher churn in Nov–Feb (Nordic) and Jun–Aug. Plan acquisition pushes for Mar–May and Aug–Oct.

### Cost of churn

Churn has two costs:
1. **Lost MRR** — revenue that stops arriving each month
2. **Wasted CAC** — marketing spend on subscribers who left before recovering their acquisition cost

| Active subscribers | Monthly churn (2.5%) | Lost MRR/mo (SEK market) | Lost MRR/mo (USD market) |
|---|---|---|---|
| 100 | 3 | ~90 SEK | ~$12 |
| 500 | 13 | ~390 SEK | ~$52 |
| 1,000 | 25 | ~750 SEK | ~$100 |
| 5,000 | 125 | ~3,750 SEK | ~$500 |
| 10,000 | 250 | ~7,500 SEK | ~$1,000 |

**Steady-state rule:** New paid acquisitions each month must exceed churned subscribers to grow. At 10,000 subscribers you need 250+ new paid users/month just to hold position.

---

## Revenue Scenarios

All figures use blended net MRR: **25 SEK/sub/mo in year 1** (30% App Store cut), **30 SEK/sub/mo in year 2+** (15% cut). Churn of 2.5%/month applied to active base. Each scenario shows two tables: **with marketing costs** and **pre-marketing (gross profit)**.

---

### Scenario A — Organic only, no marketing spend

*App Store launch visibility and word of mouth.*

#### With marketing costs

| Month | New Paid/mo | Churned/mo | Active Subs | Lost MRR (churn) | Gross MRR | App Store Cut | Marketing | Net Profit/mo (SEK) | Annual Run Rate (SEK) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 10 | 0 | 10 | — | 350 SEK | 105 SEK | 0 | **245 SEK** | **2,940 SEK** |
| 3 | 20 | 1 | 48 | 35 SEK | 1,680 SEK | 504 SEK | 0 | **1,176 SEK** | **14,112 SEK** |
| 6 | 35 | 3 | 130 | 90 SEK | 4,550 SEK | 1,365 SEK | 0 | **3,185 SEK** | **38,220 SEK** |
| 12 | 50 | 9 | 340 | 263 SEK | 11,900 SEK | 3,570 SEK | 0 | **8,330 SEK** | **99,960 SEK** |
| 24 | 60 | 17 | 680 | 510 SEK | 23,800 SEK | 3,570 SEK | 0 | **20,230 SEK** | **242,760 SEK** |

**Year 1 cumulative net: ~47,000 SEK**
**Year 2 cumulative net: ~184,000 SEK**

#### Pre-marketing (gross profit — no marketing deducted)
*Identical to above — Scenario A has no marketing spend.*

Self-funding. Covers ~94 dev hours at 500 SEK/hr by end of year 1.

---

### Scenario B — Global launch, micro-influencer seeding (5–15 creators)

*Free Pro codes + affiliate deals (5k–30k follower creators). No upfront spend in months 1–3.*

Marketing spend: 0 months 1–3 → 5,000–15,000 SEK/mo months 4–9 → 15,000–30,000 SEK/mo month 10+

~60% of subscribers via affiliates; affiliate cost = ~15% of gross = ~5 SEK/sub/mo.

#### With marketing costs

| Month | New Paid/mo | Churned/mo | Active Subs | Lost MRR (churn) | Gross MRR | App Store Cut | Marketing | Net Profit/mo (SEK) | Annual Run Rate (SEK) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 50 | 0 | 50 | — | 1,750 SEK | 525 SEK | 0 | **1,225 SEK** | **14,700 SEK** |
| 3 | 120 | 7 | 280 | 245 SEK | 9,800 SEK | 2,940 SEK | 2,000 SEK | **4,860 SEK** | **58,320 SEK** |
| 6 | 200 | 19 | 750 | 563 SEK | 26,250 SEK | 7,875 SEK | 8,000 SEK | **10,375 SEK** | **124,500 SEK** |
| 12 | 300 | 47 | 1,900 | 1,425 SEK | 66,500 SEK | 19,950 SEK | 20,000 SEK | **26,550 SEK** | **318,600 SEK** |
| 24 | 400 | 105 | 4,200 | 3,150 SEK | 147,000 SEK | 22,050 SEK | 25,000 SEK | **99,950 SEK** | **1,199,400 SEK** |

**Year 1 cumulative net (after marketing): ~175,000 SEK**
**Year 2 cumulative net (after marketing): ~650,000 SEK**

#### Pre-marketing (gross profit — marketing costs omitted)

| Month | Active Subs | Gross MRR | App Store Cut | Gross Profit/mo (SEK) | Annual Run Rate (SEK) |
|---|---|---|---|---|---|
| 1 | 50 | 1,750 SEK | 525 SEK | **1,225 SEK** | **14,700 SEK** |
| 3 | 280 | 9,800 SEK | 2,940 SEK | **6,860 SEK** | **82,320 SEK** |
| 6 | 750 | 26,250 SEK | 7,875 SEK | **18,375 SEK** | **220,500 SEK** |
| 12 | 1,900 | 66,500 SEK | 19,950 SEK | **46,550 SEK** | **558,600 SEK** |
| 24 | 4,200 | 147,000 SEK | 22,050 SEK | **124,950 SEK** | **1,499,400 SEK** |

Real side-income by month 12. Full-time dev equivalent by late year 2.

---

### Scenario C — Global launch, mid-tier influencer deals (2–4 creators, 50k–200k followers)

*Paid influencer deals from month 3. Best content repurposed as paid Meta/TikTok ads. 7-day free Pro trial introduced.*

Marketing spend: 5,000 SEK months 1–2 → 30,000–50,000 SEK/mo months 3–6 → 50,000–80,000 SEK/mo months 7–12 → 80,000–150,000 SEK/mo month 13+

#### With marketing costs

| Month | New Paid/mo | Churned/mo | Active Subs | Lost MRR (churn) | Gross MRR | App Store Cut | Marketing | Net Profit/mo (SEK) | Annual Run Rate (SEK) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 250 | 0 | 250 | — | 8,750 SEK | 2,625 SEK | 5,000 SEK | **1,125 SEK** | **13,500 SEK** |
| 3 | 600 | 38 | 1,620 | 1,215 SEK | 56,700 SEK | 17,010 SEK | 35,000 SEK | **4,690 SEK** | **56,280 SEK** |
| 6 | 1,000 | 130 | 5,200 | 3,900 SEK | 182,000 SEK | 54,600 SEK | 55,000 SEK | **72,400 SEK** | **868,800 SEK** |
| 12 | 1,500 | 338 | 13,500 | 10,125 SEK | 472,500 SEK | 141,750 SEK | 75,000 SEK | **255,750 SEK** | **3,069,000 SEK** |
| 24 | 2,000 | 750 | 30,000 | 22,500 SEK | 1,050,000 SEK | 157,500 SEK | 120,000 SEK | **772,500 SEK** | **9,270,000 SEK** |

**Year 1 cumulative net (after marketing): ~1,250,000 SEK**
**Year 2 cumulative net (after marketing): ~5,500,000 SEK**

#### Pre-marketing (gross profit — marketing costs omitted)

| Month | Active Subs | Gross MRR | App Store Cut | Gross Profit/mo (SEK) | Annual Run Rate (SEK) |
|---|---|---|---|---|---|
| 1 | 250 | 8,750 SEK | 2,625 SEK | **6,125 SEK** | **73,500 SEK** |
| 3 | 1,620 | 56,700 SEK | 17,010 SEK | **39,690 SEK** | **476,280 SEK** |
| 6 | 5,200 | 182,000 SEK | 54,600 SEK | **127,400 SEK** | **1,528,800 SEK** |
| 12 | 13,500 | 472,500 SEK | 141,750 SEK | **330,750 SEK** | **3,969,000 SEK** |
| 24 | 30,000 | 1,050,000 SEK | 157,500 SEK | **892,500 SEK** | **10,710,000 SEK** |

Full salary from month 6. Serious business by year 2.

---

### Break-even reference

| Monthly dev cost | Subscribers needed | Break-even: A / B / C |
|---|---|---|
| 10 hrs × 500 SEK = 5,000 SEK | ~167 subs | Month 10 / 3 / 2 |
| 20 hrs × 500 SEK = 10,000 SEK | ~333 subs | Month 14 / 4 / 2 |
| Full-time = 80,000 SEK | ~2,667 subs | Never / month 23 / month 7 |

---

## Influencer Marketing Playbook

All markets are open from launch — English UI is already in place.

---

### Phase 0 — Pre-launch (Month -2 to 0): Free seeding, zero cost

- DM 10–20 golf micro-influencers (2k–20k followers) on Instagram and TikTok
- Offer a **lifetime Pro account** in exchange for honest use + one story post on launch day
- Target profiles: regular club golfers, assistant pros, golf vloggers, club captains
- Prioritise engagement rate >3% over follower count
- Brief: *"Film your club selection on one hole, show the wind reading, tell your followers how you use it"*
- Ask for an App Store review — critical for early ranking

**Cost: 0 SEK. Return: reviews, social proof, first word-of-mouth wave.**

Priority markets: Sweden, UK, Ireland

---

### Phase 1 — Launch (Month 1–3): Affiliate-only, no upfront spend

- Promo code per creator (e.g. "JAMES20" = 20% off first year)
- Pay 15–20% of revenue they generate — performance only, zero risk
- Track via App Store affiliate program or custom codes + UTM links

**Content formats that convert:**
1. *Club selection dilemma* — 165m, 10 knots into wind, picks Controlled, makes GIR
2. *Round recap stats screen* — stroke loss breakdown at end of round
3. *Wind shot POV* — compass, wind lock, club selected, real-time, no narration
4. *Before vs after* — scorecard comparison without app vs with app

Target: 5–10 creators, 1 reel/TikTok + 2 stories each.

**Budget: 0 SEK upfront. ~15% affiliate payout on generated revenue only.**

---

### Phase 2 — Growth (Month 3–9): Small flat fees + paid ad amplification

- Expand to 10–25 creators across Sweden, UK, Ireland, US, Australia
- Flat fees: 500–2,000 SEK per story · 2,000–8,000 SEK per dedicated reel/TikTok
- Affiliate code still included — they earn on every subscriber they drive
- Repurpose best creator content as paid Meta/TikTok ads (UGC outperforms polished ads 2–4x)
- Paid amplification budget: 5,000–15,000 SEK/month
- Target CPD (cost per download): 15–35 SEK
- Introduce **7-day free Pro trial** — improves cold-audience conversion significantly

**Total Phase 2 budget: 10,000–30,000 SEK/month**

---

### Phase 3 — Scale (Month 9–18): Mid-tier deals + YouTube

- Upgrade 1–2 creators to ongoing ambassador deals (50k–200k followers)
- Monthly commitment: 4 stories + 1 reel · Fee: 10,000–35,000 SEK/month each
- YouTube: 10–15 min dedicated videos, 5k–30k sub channels, 5,000–20,000 SEK per video
- Scale paid ads: 20,000–50,000 SEK/month Meta + TikTok
- Lookalike audiences from existing subscriber base
- Retarget free users who haven't converted after 14 days

**Total Phase 3 budget: 50,000–100,000 SEK/month**

---

### Influencer content brief

> *"Film one hole — par 4 or par 3 works best. Before you hit, open the app and show your club options. Mention the wind reading. Pick a strategy. Show the result. Keep it real — no script needed. Your followers want to see how you actually use it, not a tutorial. Tag the app in your story and use your code [CODE] in the link."*

**What to avoid:** scripted delivery, influencers who don't actually play, feature dumps, polished studio production — raw course footage outperforms it every time.

---

## Recommendation Summary

| Decision | Recommendation |
|---|---|
| Tiers | 2 (Free + Pro) |
| SEK price | 349 SEK/yr · 49 SEK/mo |
| USD price | $49.99/yr · $5.99/mo |
| Primary paywall | Shot strategy carousel + live wind GPS + analytics |
| Free limit | Last 5 rounds, manual wind only, basic stats |
| Trial offer | 7-day free Pro trial (add when running paid ads) |
| Launch markets | Global from day 1 |
| Priority order | Sweden → UK/Ireland → US/Australia |
| Marketing start | Free Pro codes to 10–20 micro-influencers, zero cost |
| First paid spend | Repurpose best creator content as Meta/TikTok ads (~5,000 SEK/mo) |
| Churn defence | Push notifications in Mar–May and Aug–Oct to re-engage lapsed users |

**The shot strategy carousel exists nowhere else at any price point.** Competitors charge $99.99/yr for less. At 349 SEK / $49.99 you are priced to grow fast.
