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
| **SEK** | 49 SEK/mo | 399 SEK/yr | ~33 SEK/mo |
| **USD** | $4.99/mo | $49.99/yr | ~$4.17/mo |

Note: SEK and USD are different App Store price tiers. Swedish users pay 399 SEK (~$39), international users pay $49.99 (~515 SEK). International subscribers generate ~29% more revenue per head.

### Developer payout after App Store cut

| Plan | Gross | Year 1 payout (30% cut) | Year 2+ payout (15% cut) |
|---|---|---|---|
| Annual – SEK | 399 SEK | 279 SEK | 339 SEK |
| Annual – USD | $49.99 | $35.00 | $42.50 |
| Monthly – SEK | 49 SEK/mo | 34 SEK/mo | 42 SEK/mo |
| Monthly – USD | $4.99/mo | $3.49/mo | $4.24/mo |

### Blended MRR per active subscriber (year 2+, 70% annual / 30% monthly)

| Market | Gross MRR/subscriber | Net MRR/subscriber (after App Store) |
|---|---|---|
| SEK | 38 SEK/mo | **32 SEK/mo** |
| USD | $4.42/mo | **$3.76/mo** |

*Gross MRR = 0.70 × (annual price ÷ 12) + 0.30 × monthly price*

---

## Churn Model

Golf is seasonal — churn is higher than year-round apps.

### Churn rate assumptions

| Plan type | Monthly churn | Annual equivalent |
|---|---|---|
| Annual subscribers | 2.0%/month | ~22%/year |
| Monthly subscribers | 6.0%/month | ~52%/year |
| **Blended (70/30 split)** | **2.5%/month** | **~27%/year** |

Seasonal dip: expect 40–60% higher churn in Nov–Feb (Nordic) and Jun–Aug (too busy playing to care about analytics). Plan acquisition pushes for Mar–May and Aug–Oct.

### Cost of churn

Churn has two costs:
1. **Lost MRR** — revenue that stops arriving each month
2. **Wasted CAC** — marketing spend on subscribers who left before recovering their acquisition cost

| Active subscribers | Monthly churn (2.5%) | Lost MRR (SEK) | Lost MRR (USD) |
|---|---|---|---|
| 100 | 3 | ~96 SEK | ~$11 |
| 500 | 13 | ~416 SEK | ~$49 |
| 1,000 | 25 | ~800 SEK | ~$94 |
| 5,000 | 125 | ~4,000 SEK | ~$470 |
| 10,000 | 250 | ~8,000 SEK | ~$940 |

**Steady-state rule:** New paid acquisitions each month must exceed churned subscribers to grow. At 10,000 subscribers you need 250+ new paid users/month just to maintain — before any growth.

---

## Revenue Scenarios (Net Profit After All Costs)

### Cost categories

| Cost | What it covers |
|---|---|
| **App Store cut** | 30% year 1, 15% thereafter |
| **Marketing spend** | Influencer fees, paid ads |
| **Affiliate payouts** | 15% of gross for influencer-referred subscribers |
| **Churn revenue loss** | Shown as "Lost MRR" column; implicit in falling subscriber count |

Blended net = 32 SEK / $3.76 per subscriber/month after App Store cut.

---

### Scenario A — Organic only, no marketing spend

*App Store launch visibility and word of mouth. No influencer deals.*

| Month | New Paid/mo | Churned/mo | Active Subs | Lost MRR (churn) | Gross MRR | App Store Cut | Marketing | Net Profit (SEK) | Net Profit (USD) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 10 | 0 | 10 | — | 380 SEK | 114 SEK | 0 | **266 SEK** | **~$26** |
| 3 | 20 | 1 | 48 | 38 SEK | 1,824 SEK | 547 SEK | 0 | **1,277 SEK** | **~$124** |
| 6 | 35 | 3 | 130 | 96 SEK | 4,940 SEK | 1,482 SEK | 0 | **3,458 SEK** | **~$336** |
| 12 | 50 | 9 | 340 | 288 SEK | 12,920 SEK | 3,876 SEK | 0 | **9,044 SEK** | **~$878** |
| 24 | 60 | 17 | 680 | 544 SEK | 25,840 SEK | 7,752 SEK | 0 | **18,088 SEK** | **~$1,757** |

**Year 1 cumulative net: ~60,000 SEK (~$5,800 USD)**
**Year 2 cumulative net: ~140,000 SEK (~$13,600 USD)**

Self-funding. Covers ~120 hours of dev time at 500 SEK/hr by end of year 2.

---

### Scenario B — Global launch, micro-influencer seeding (5–15 creators)

*Free Pro codes + affiliate deals with golf micro-influencers (5k–30k followers). No upfront spend — affiliate payouts only in first months.*

Marketing spend: 0 in months 1–3 → 5,000–15,000 SEK/month by month 4–9 → 15,000–30,000 SEK/month by month 10+

~60% of subscribers come via affiliates (15% of gross = ~6 SEK/sub/month cost).

| Month | New Paid/mo | Churned/mo | Active Subs | Lost MRR (churn) | Gross MRR | App Store Cut | Marketing | Net Profit (SEK) | Net Profit (USD) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 50 | 0 | 50 | — | 1,900 SEK | 570 SEK | 0 | **1,330 SEK** | **~$129** |
| 3 | 120 | 7 | 280 | 266 SEK | 10,640 SEK | 3,192 SEK | 2,000 SEK | **5,448 SEK** | **~$529** |
| 6 | 200 | 19 | 750 | 608 SEK | 28,500 SEK | 8,550 SEK | 8,000 SEK | **11,950 SEK** | **~$1,160** |
| 12 | 300 | 47 | 1,900 | 1,504 SEK | 72,200 SEK | 21,660 SEK | 20,000 SEK | **30,540 SEK** | **~$2,965** |
| 24 | 400 | 105 | 4,200 | 3,360 SEK | 159,600 SEK | 47,880 SEK | 25,000 SEK | **86,720 SEK** | **~$8,419** |

**Year 1 cumulative net: ~200,000 SEK (~$19,400 USD)**
**Year 2 cumulative net: ~700,000 SEK (~$68,000 USD)**

Real side-income by month 12. Full-time dev equivalent by late year 2.

---

### Scenario C — Global launch, mid-tier influencer deals (2–4 creators, 50k–200k followers)

*Paid influencer deals from month 3. Best content repurposed as paid Meta/TikTok ads. 7-day free Pro trial introduced.*

Marketing spend: 5,000 SEK months 1–2 → 30,000–50,000 SEK/month by month 3–6 → 50,000–80,000 SEK/month by month 7–12 → 80,000–150,000 SEK/month month 13+

| Month | New Paid/mo | Churned/mo | Active Subs | Lost MRR (churn) | Gross MRR | App Store Cut | Marketing | Net Profit (SEK) | Net Profit (USD) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 250 | 0 | 250 | — | 9,500 SEK | 2,850 SEK | 5,000 SEK | **1,650 SEK** | **~$160** |
| 3 | 600 | 38 | 1,620 | 1,216 SEK | 61,560 SEK | 18,468 SEK | 35,000 SEK | **8,092 SEK** | **~$786** |
| 6 | 1,000 | 130 | 5,200 | 4,160 SEK | 197,600 SEK | 59,280 SEK | 55,000 SEK | **83,320 SEK** | **~$8,090** |
| 12 | 1,500 | 338 | 13,500 | 10,800 SEK | 513,000 SEK | 153,900 SEK | 75,000 SEK | **284,100 SEK** | **~$27,583** |
| 24 | 2,000 | 750 | 30,000 | 24,000 SEK | 1,140,000 SEK | 342,000 SEK | 120,000 SEK | **678,000 SEK** | **~$65,825** |

**Year 1 cumulative net: ~1,400,000 SEK (~$136,000 USD)**
**Year 2 cumulative net: ~5,800,000 SEK (~$563,000 USD)**

Full salary from month 6. Serious business by year 2.

---

### Break-even reference

| Monthly dev cost | Subscribers needed | Break-even: A / B / C |
|---|---|---|
| 10 hrs × 500 SEK = 5,000 SEK | ~156 subs | Month 9 / 3 / 2 |
| 20 hrs × 500 SEK = 10,000 SEK | ~313 subs | Month 13 / 4 / 2 |
| Full-time = 80,000 SEK | ~2,500 subs | Never / month 22 / month 7 |

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
| SEK price | 399 SEK/yr · 49 SEK/mo |
| USD price | $49.99/yr · $4.99/mo |
| Primary paywall | Shot strategy carousel + live wind GPS + analytics |
| Free limit | Last 5 rounds, manual wind only, basic stats |
| Trial offer | 7-day free Pro trial (add when running paid ads) |
| Launch markets | Global from day 1 |
| Priority order | Sweden → UK/Ireland → US/Australia |
| Marketing start | Free Pro codes to 10–20 micro-influencers, zero cost |
| First paid spend | Repurpose best creator content as Meta/TikTok ads (~5,000 SEK/mo) |
| Churn defence | Push notifications in Mar–May and Aug–Oct to re-engage lapsed users |

**The shot strategy carousel exists nowhere else at any price point.** Competitors charge $99.99/yr for less. At 399 SEK / $49.99 you are priced to grow fast.
