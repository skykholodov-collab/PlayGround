# ORBIT

An interactive 3D solar system explorer built with Three.js and Vite. ORBIT renders the Sun, all eight planets, Earth's Moon, Saturn's rings, and the asteroid belt with procedurally generated textures — no external image assets required.

## Features

- Real-time orbital motion with a speed control, pause, and guided tour.
- Click any world (or its label) for an animated close-up and a data panel with distance, diameter, rotation, year length, moons, and temperature.
- Toggle orbit lines and labels, reset to the system overview, and orbit/zoom freely with the mouse, trackpad, or touch.
- Responsive layout: a full HUD on desktop and a focused bottom-sheet experience on phones.
- Deterministic procedural planet textures, starfield, ring bands, and atmospheric rims generated at runtime.

## Run locally

```sh
npm install
npm run dev
```

Open the printed local URL. For a production build:

```sh
npm run build
npm run preview
```

## Controls

| Action | Input |
| --- | --- |
| Rotate the view | Drag |
| Zoom | Scroll or pinch |
| Inspect a body | Click a planet or label |
| Pause / resume | `Space` or the pause button |
| Reset to overview | `Escape`, `R` |
| Guided tour | `T` or the tour button |

## Tests

```sh
npm test
```

Data integrity tests cover the body catalog, required display fields, outward ordering, and decreasing orbital speeds.

Built with [OMGithub](https://omgithub.com).
