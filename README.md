# Sub Sinkers

A 16-bit-style side-scrolling submarine shooter that runs in the browser. It has no build step and no image files.
Open `index.html`, or serve the folder with any static server.

## Play

- **Move:** on touch devices, drag anywhere on the left side of the screen to use the floating virtual joystick. On a keyboard, use the arrows or WASD.
- **Torpedo (forward):** the ▶ button, or Space / J / Z.
- **Missile (upward):** the ▲ button, or K / X / Shift. Missiles leave the water and hit air and surface targets.
- **Pause:** the II button, or P / Esc.

You can move freely within the left ~33% of the screen. Pushing past that scrolls the screen forward, and it never scrolls back.
Rise to the surface to ride the waves, or dive to hug the seabed.

## Stages: a deeper dive each time

| # | Stage | Zone | Palette / scenery | Boss |
|---|-------|------|-------------------|------|
| 1 | Sunlit Shallows | Epipelagic, 200 m | Daylight harbor, sandy seabed, kelp | Battleship |
| 2 | Twilight Reef | Mesopelagic, 1000 m | Sunset oil rigs, coral reef | Dreadnought sub |
| 3 | Midnight Zone | Bathypelagic, 4000 m | Night city, bioluminescent plants, vents | Battleship |
| 4 | Hadal Ice Trench | Hadal, 11000 m | Ice sheet ceiling, icebergs, crystals, falling icicles | Dreadnought sub |

**Enemies:**
- Patrol subs (move left/right and fire homing torpedoes)
- Drones (bob up/down and fire aimed shots)
- Tethered mines (explode on contact)
- Gunboats (drop depth charges)
- Helicopters and jets (drop bombs)
- Seabed turrets
- Walking crab mechs
- Jellyfish
- Icicles

Destroyed enemies sometimes drop **P** (weapon power, up to triple torpedoes and twin missiles) or **+** (hull repair).

## Art

All art is original and generated in code by `src/sprites.js`. Each sprite is a material mask shaded with palette ramps
(cylinder / sphere / vertical lighting), ordered dithering, rim light and a dark outline, recoloured per stage.
Open `sprites.html` to see every sprite.

## Mobile zoom fix

Rapid tapping on touch browsers used to zoom the page. The fix is the self-contained
[`touch-zoom-guard/`](touch-zoom-guard/README.md) package, which is reusable in any touch game
(see [`AGENT_BRIEF.md`](touch-zoom-guard/AGENT_BRIEF.md)).

## Code

- `src/util.js`: math, seeded RNG, noise, 3×5 pixel font
- `src/sprites.js`: procedural pixel-art sprites and effect animations
- `src/levels.js`: stage themes, palettes and enemy mixes
- `src/world.js`: sky/water, skyline, parallax, seabed, ice, decorations
- `src/input.js`: virtual joystick, fire buttons, keyboard
- `src/audio.js`: WebAudio sound effects
- `src/game.js`: game loop, camera, player, enemies, bosses, HUD, menus
- `touch-zoom-guard/`: drop-in fix for mobile tap-to-zoom (shared with other games)
