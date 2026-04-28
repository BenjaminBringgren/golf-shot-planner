# Hero Screen Quote Cycling — Implementation Instructions

## Overview
Replace the static "GOLF PRO" text on the home screen hero image(s) with a rotating set of golf quotes. A new quote is selected randomly each time the home screen loads or is refreshed.

---

## Typography Spec
- **Font:** Apple serif (Georgia or system serif fallback if needed)
- **Weight:** Regular
- **Size:** 28pt
- **Color:** White
- **Alignment:** Centered
- **Layout:** Quote text on top, attribution name always on a new line below — never inline

---

## Behavior
- On every home screen load, one quote is selected at random from the pool below.
- The same quote should not repeat twice in a row (simple last-shown exclusion is sufficient).
- No manual cycling controls needed — randomisation on load is the full behaviour.

---

## Quote Pool

```
"Grip it and rip it."
— John Daly

"I don't think I've ever tried to be anything I'm not."
— John Daly

"I hit the ball as hard as I can. If I can find it, I hit it again."
— John Daly

"Golf is a game you can never really conquer."
— Ben Hogan

"Confidence is the most important single factor in this game."
— Jack Nicklaus

"Focus on remedies, not faults."
— Jack Nicklaus

"Tempo is everything."
— Fred Couples

"You don't have to swing hard to hit it far."
— Fred Couples

"When it feels right, it usually is."
— Fred Couples

"Patience is key out there."
— Nelly Korda

"You can't get ahead of yourself in golf."
— Nelly Korda

"The more I practice, the luckier I get."
— Annika Sörenstam

"It's about controlling what you can control."
— Annika Sörenstam

"Consistency is what separates the best from the rest."
— Annika Sörenstam

"Keep it simple."
— Ernie Els

"A good swing is about rhythm and balance."
— Ernie Els

"You've got to stay patient and trust your swing."
— Ernie Els

"Golf is not a game of perfect."
— Nick Faldo

"You build a swing by understanding cause and effect."
— Nick Faldo

"Pressure is what you feel when you don't know what you're doing."
— Nick Faldo

"Talent is only a small part of it — hard work beats talent."
— Rory McIlroy

"You have to be comfortable being uncomfortable."
— Rory McIlroy

"The biggest thing is to believe in yourself."
— Rory McIlroy

"The only thing you can control is your effort."
— Tiger Woods

"You can always become better."
— Tiger Woods

"You learn more from failure than from success."
— Tiger Woods

"You have to earn it every day."
— Tiger Woods

"I practice until I don't have to think about it."
— Tiger Woods
```

---

## Layout Notes
- The quote text and the attribution line should be visually grouped as a single unit, centered on the hero image.
- Attribution should be styled slightly smaller or lighter than the quote if needed for visual hierarchy, but must remain white.
- Ensure sufficient text shadow or overlay contrast so quotes remain legible across all hero images.
