# Immiscible / Deep Drift

A playable spacecraft course through iridescent oil and shifting underwater currents. The original liquid playground is preserved at `/playground.html`.

## Run

Run `npm run dev` and open http://localhost:5173. No dependencies or build step are required. Rendering requires WebGL. Google Fonts have local fallbacks.

## Deep Drift

Launch, then cross the red-and-yellow striped finish tape 4,250 meters ahead, at the original end of the course.

- **W / Up:** thrust
- **A, D / Left, Right:** turn
- Release thrust to coast and gradually decelerate; turning alone preserves your drift direction.
- **S / Down:** brake
- **Space:** twin lasers
- **N / Nuke button:** spend a collected oil-barrel charge to clear nearby oil, without points or extra drops
- **P / Escape:** pause
- **R:** restart
- Touch controls appear on narrow screens.

Start with three lives. Oil contact costs a life and restarts the current encounter. Losing the third life returns to the animated main menu with your final score. Score carries across lives and levels; collected nukes and wide shot are lost on death. A fresh launch starts a new run.

Cross the finish tape to enter **Super Blob's arena**. The boss has a health bar, pursues the ship, and periodically sheds smaller oil blobs. Hits produce sparks, damage numbers, a brief surface flash, and a distinct impact sound; its color shifts and cracks spread as health falls. Three outward warning marks announce shedding, rather than a shield-like ring. Reduced-motion mode disables the hit flash. Lasers damage it; a nearby nuke deals eight damage and clears surrounding small blobs without awarding points. Defeating Super Blob starts another regular course with the same lives, score, and remaining gear. If you die during the boss fight, the next life retries that encounter.

Small fragments (radius 32 or less) explode for 100 points. Each destruction makes **one shared 5% drop roll**, then chooses equally among:

- **Oil barrel / nuke:** adds one charge, up to three. Press N or the nuke button to clear nearby visible oil within a maximum radius of 240 world units. No points or extra pickups are awarded by nukes.
- **Med kit / free life:** restores one life, up to three. Kits remain available when your lives are full.
- **Machine gun / wide shot:** gives a three-direction spread of twin lasers for 15 seconds. Another pickup refreshes the timer. Pausing freezes it.

The shared drop rate is `POWERUP_DROP_RATE` in `game.js`; change `.05` to `.08` to try 8%. It is not a separate roll per pickup type.

Blobs randomly absorb or repel on collision. A gentle current continuously guides them toward the ship, including oil left behind. Speed and wake strength rise to 1.25× near the finish. Amber wake warnings precede gentle surges. Hiding the tab pauses play. Reduced-motion preferences keep the menu still and reduce effects.

## Sound

Procedural Web Audio effects cover launch, engine thrust, lasers, oil splits, fragment explosions, capture, boss encounters, and victory. Sound starts after a user interaction, pauses with the game, and the header sound toggle remembers your mute preference on this device. No audio downloads are needed.

## Checks

`npm test` runs the liquid and game checks, covering area conservation, collision behavior, laser splitting, steering/thrust, capture/restart, wake influence, exit conditions, long-run stability, lives, shared powerup drops, wide shot, and the course/boss loop.

The renderer uses procedural thin-film shading over a metaball field. Ship contact samples the same field as the renderer. This is a stylized game simulation rather than a physically exact fluid solver.

## Deploy to Netlify

Connect this repository to Netlify. The included `netlify.toml` copies the public game assets into `dist` and publishes that folder. No dependencies, environment variables, or backend are required. The game is served at `/`, and the original liquid playground remains at `/playground.html`.

For a manual upload, run the command under `[build]` in `netlify.toml`, then upload the generated `dist` folder to Netlify.
