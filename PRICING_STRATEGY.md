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

**How to read this table:** Each row is a total subscriber count. The Apple cut and churn loss columns use the 50/50 mix (half Swedish, half international) — the most realistic scenario for a global launch. The final three net columns show what you actually keep depending on your mix.

Churn note: Annual subscribers pay upfront — their churn shows at renewal, not within the year. Churn loss below applies to monthly subscribers (30% of base) who leave mid-year at ~6%/month, averaging 8.7 months paid instead of 12.

### Per-subscriber annual breakdown (year 2+, 70% annual / 30% monthly)

| | SEK market | USD market | 50/50 blended |
|---|---|---|---|
| Gross revenue | 421 SEK | 582 SEK | 502 SEK |
| Apple cut (15%) | −63 SEK | −87 SEK | −75 SEK |
| Churn loss (net) | −41 SEK | −51 SEK | −46 SEK |
| **Net per subscriber / yr** | **317 SEK** | **444 SEK** | **381 SEK** |

### Annual revenue at subscriber milestones

| Total Subs | Gross (50/50) | Apple Cut | Churn Loss | **Net (50/50)** | Net (SEK-only) | Net (USD-only) |
|---|---|---|---|---|---|---|
| 1,000 | 502,000 SEK | −75,000 SEK | −46,000 SEK | **381,000 SEK** (~$37,000) | 317,000 SEK | 444,000 SEK (~$43,100) |
| 2,000 | 1,004,000 SEK | −150,000 SEK | −92,000 SEK | **762,000 SEK** (~$74,000) | 634,000 SEK | 888,000 SEK (~$86,200) |
| 3,000 | 1,506,000 SEK | −225,000 SEK | −138,000 SEK | **1,143,000 SEK** (~$111,000) | 951,000 SEK | 1,332,000 SEK (~$129,300) |
| 5,000 | 2,510,000 SEK | −375,000 SEK | −230,000 SEK | **1,905,000 SEK** (~$185,000) | 1,585,000 SEK | 2,220,000 SEK (~$215,500) |
| 10,000 | 5,020,000 SEK | −750,000 SEK | −460,000 SEK | **3,810,000 SEK** (~$370,000) | 3,170,000 SEK | 4,440,000 SEK (~$431,100) |
| 15,000 | 7,530,000 SEK | −1,125,000 SEK | −690,000 SEK | **5,715,000 SEK** (~$555,000) | 4,755,000 SEK | 6,660,000 SEK (~$646,600) |
| 20,000 | 10,040,000 SEK | −1,500,000 SEK | −920,000 SEK | **7,620,000 SEK** (~$740,000) | 6,340,000 SEK | 8,880,000 SEK (~$861,900) |

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

---

## Competitive Honesty: Hooks, Gaps, and Brutal Truth

### What are the strongest conversion hooks?

These are the moments where a user feels the app is genuinely earning their attention.

**1. The wind + physics calculation**
This is the strongest hook. Wind speed, direction, temperature, and altitude all feed into carry adjustments derived from Trackman data. Altitude scaling is even adjusted per handicap tier — amateurs hit flatter ball flights, so altitude benefits them less than scratch players. No free-tier competitor does this with this level of calibration. When a user enters 12 m/s headwind on a 175m par 3 and the app says "your 7i doesn't reach — take 6i, adjusted carry 164m, 3m crosswind drift right" — that's a moment of genuine value.

**2. Shot strategy with expected strokes per option**
The carousel showing Max Distance / Controlled / Conservative with "+0.2 vs par" per option is a real decision-making tool. Golfers who think about course management will immediately understand the value. It answers "which club off the tee actually gives me the best chance of a par?" — a question no other app frames this clearly.

**3. Shot-by-shot lie capture**
Logging fairway, rough, sand, and penalty per shot with a full hole flow is more granular than most competitors' scorecard apps. For a golfer who wants to know *why* they scored badly, not just *that* they scored badly, this is compelling.

**4. Stroke loss attribution**
Showing "you lost 2.1 strokes to short game this round" broken into driving / approach / short game / putting / penalties is actionable in a way that a raw score is not. Most free-tier apps show your score. This shows where the score came from.

**5. The app works without GPS hardware or sensors**
Arccos requires $200 in sensors. This is free to download and works immediately with manual input. For golfers who won't commit to hardware, this is the entire value proposition.

---

### What are the weaknesses — brutal honesty

**The #1 killer: No course database.**
Every competing app lets a user find their course in under 10 seconds. This app requires manual entry of 18 holes including par and length before anything works. On a realistic 18-hole course, that's 5–10 minutes of data entry before the user sees a single useful output. Most users will not do this. They will delete the app.

This is not a minor UX issue — it is the single largest barrier to adoption and the most likely reason early users will churn before ever paying.

**The shot strategy carousel is less unique than it sounds.**
The three strategy options (Max / Controlled / Conservative) map directly to the 1st, 2nd, and 3rd longest tee clubs available. The expected strokes values behind them come from a static 6×4 lookup table, not a player-specific model. An 18-handicap and a 5-handicap playing the same hole from 165m get meaningfully different numbers — but only because of a simple handicap multiplier, not because the model knows anything about how *you* actually play. SwingU and 18Birdies both have expected-stroke models in their premium tiers. They don't call it a "strategy carousel" — but the underlying math is comparable.

**"Expected strokes" is not Strokes Gained.**
Strokes Gained is a measurement of your performance relative to a baseline — it tells you whether you gained or lost strokes against expectation on each shot. This app's "expected strokes remaining" is a lookup table of what an average golfer at your handicap *should* take from a given distance. That's useful for decision-making but it's not the same metric. Calling it anything close to Strokes Gained in marketing would be misleading and experienced golfers will notice.

**Pre-round coaching is template text, not coaching.**
The "pre-round focus" feature identifies your biggest stat leak from the last 5 rounds and returns one of ~7 pre-written advice strings. "Tee shots are leaking — swing at 80%." This is accurate but it's closer to a fortune cookie than coaching. Arccos and 18Birdies have AI-personalised drill recommendations tied to video libraries. This is not competitive with those in its current state. It should not be marketed as "coaching."

**7 taps to log one hole is too many for casual play.**
Advanced mode requires roughly 7 taps per hole (lie selection for each shot + putt count + save). That is acceptable for a statistics-obsessed 5-handicap who wants granular data. It is a chore for a 22-handicap playing a casual Saturday round. Arccos logs the same data automatically with zero taps. The app needs a simpler entry path to compete for the casual-golfer segment.

**No validation that the expected strokes table is accurate.**
The static table values (e.g. 2.95 strokes remaining from 60m for an 18-handicap) are not publicly sourced or validated against PGA/amateur tour data. If serious golfers question the numbers, there is no published methodology to point to.

---

### What the app has that no competitor has

These are genuine differentiators — not marketing copy, actual gaps in the market.

| Feature | This app | Closest competitor |
|---|---|---|
| Strategy carousel showing expected score per tee option | ✅ | ❌ none |
| Per-strategy historical performance tracking | ✅ | ❌ none |
| Altitude wind scaling adjusted by handicap tier | ✅ | ❌ none (competitors apply flat altitude factor) |
| Temperature carry correction (air density model) | ✅ | Partially — 18Birdies shows temp but doesn't adjust carry |
| WHS stroke-index-aware expected strokes per hole | ✅ | ❌ none at this price point |
| Manual course entry for any course, anywhere, any format | ✅ | ❌ competitors locked to their database |
| Full hole flow: lie per shot + penalty relief workflow + pick-up tracking | ✅ | Partial — Arccos captures club/distance but not lie type |
| Offline-capable wind fallback with manual entry | ✅ | ❌ most fail silently offline |

---

### What gap does this app realistically fill?

The app fits one specific golfer profile: **the 8–20 handicap who thinks analytically about their game, plays regular courses they're willing to set up once, and wants more than a scorecard but less than a $200 sensor system.**

That player exists. They're the golfer who reads about Strokes Gained, has tried to use a rangefinder, and wishes their GPS app told them which club to hit instead of just how far away the pin is. There are millions of them. But they are not the median golfer.

The median golfer wants to open an app, tap their course, and start tracking a score. This app does not serve them yet.

**The realistic beachhead market:** Golfers who play the same 1–3 courses regularly and are willing to spend 10 minutes setting up those courses in exchange for better shot planning. Once set up, the per-round experience is genuinely better than anything at this price. The setup cost is front-loaded; the value is recurring.

---

### How can it compete — what needs to be true

For the app to retain users against established competitors, at least one of the following must be true:

**Option A — Niche depth**
Double down on the shot planning differentiator. Make the strategy carousel genuinely smarter: factor in player's personal miss pattern ("you tend to go short with 7i"), play-to-a-number logic ("leave yourself 120m — your best approach distance"), hazard awareness ("layup to avoid OB left"). No competitor does this at depth. This is a defensible niche that premium golfers will pay for.

**Option B — Remove the setup wall**
Integrate a course database API (OpenGolfCourses, golfbert, or similar). Even a 5,000-course library covering Sweden, UK, and Ireland at launch removes the biggest drop-off point. Wind physics and strategy carousel become immediately accessible on day one. This is the single highest-leverage technical investment.

**Option C — Own the serious amateur segment explicitly**
Position the app as *not* for casual golfers. Market it as the tool for golfers who take their handicap seriously, play the same courses, and want genuine course management — not score tracking. Price it accordingly. Accept a smaller but more loyal paying user base. This is viable as a lifestyle business at Scenario A/B revenue.

**What will fail:**
Trying to compete with Arccos, 18Birdies, or Hole19 on breadth. They have years of data, hardware integrations, marketing budgets, and course databases that cannot be replicated quickly. Competing head-on on features is a losing game. The shot planning angle is the only credible differentiator and it needs to be deeper and more personal to justify subscription revenue at scale.

---

### Feature additions with the highest conversion impact

Ranked by estimated user acquisition and retention effect:

| Priority | Feature | Why | Effort |
|---|---|---|---|
| 1 | **Course database integration** | Eliminates the #1 drop-off. Without it, most users never reach the value moment. | High |
| 2 | **Play-to-a-number strategy** ("leave 120m — your best club") | Genuinely unique. No competitor shows the shot that leaves you at your optimal approach distance. | Medium |
| 3 | **Club performance history** ("your 7i averaged 147m last 5 rounds") | Turns the strategy carousel personal. Numbers adapt to actual performance, not generic interpolation. | Medium |
| 4 | **Visual wind compass on screen** | Wind direction as a compass rose with the hole drawn relative to it. The calculation is already there — the visualisation is missing. Makes the wind value immediately legible to a new user watching a creator video. | Low |
| 5 | **Shareable round card** | One-tap image export of score + key stats. Golf is inherently social. This drives organic acquisition every time someone shares a result. Competitors all have this. | Low |
| 6 | **Dispersion zone per club** ("your driver: ±12m carry, bias 4m right") | Once enough rounds are logged, the app knows your actual carry distribution. Strategy recommendations can adjust for it. Only Arccos does this, and only with hardware. | High |
| 7 | **Apple Watch scorecard** | Single biggest retention driver for iPhone users playing a round. Keeps the phone in the bag. | High |
