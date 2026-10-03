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

Oil contact sucks the ship in and automatically restarts the course. Shots cut larger blobs into two differently colored pieces, pushing the halves apart; fragments of radius 32 or less explode for 100 points per blob. Small-blob destruction has a 5% chance to leave a floating oil barrel. Fly into it to collect one nuke charge; you can carry up to three charges, and barrels remain available when you are full. Nukes clear only visible blobs whose centers are inside a local blast radius (up to 240 world units around the ship), and award no points or pickups. Score and charges reset with each run. Blobs randomly absorb or repel on collision. Blob speed and wake force gradually increase to 1.25× by the exit. A gentle persistent current steers every blob toward the ship, including oil left behind. Eddies vary their sideways curl and surge strength, turning amber just before a shift. Hiding the tab pauses the game. Reduced-motion preferences remove the engine flicker; flight begins only after launching.

## Sound

Procedural Web Audio effects cover launch, engine thrust, lasers, oil splits, fragment explosions, capture, and the exit. Sound starts after a user interaction, pauses with the game, and the header sound toggle remembers your mute preference on this device. No audio downloads are needed.

## Checks

`npm test` runs the liquid and game checks, covering area conservation, collision behavior, laser splitting, steering/thrust, capture/restart, wake influence, exit conditions, and long-run stability.

The renderer uses procedural thin-film shading over a metaball field. Ship contact samples the same field as the renderer. This is a stylized game simulation rather than a physically exact fluid solver.

## Deploy to Netlify

Connect this repository to Netlify. The included `netlify.toml` copies the public game assets into `dist` and publishes that folder. No dependencies, environment variables, or backend are required. The game is served at `/`, and the original liquid playground remains at `/playground.html`.

For a manual upload, run the command under `[build]` in `netlify.toml`, then upload the generated `dist` folder to Netlify.
