# Noise Hue — manual QA checklist

Run against `npm run build && npm run preview` (or `npm run dev`). Tick each item per browser.

## Layout
- [ ] At 360×640, 768 and 1280: one centred column (max-width 32rem), no horizontal scroll.
- [ ] The background is a static vertical gradient tinted by the selected color; nothing animates.

## Colors
- [ ] Selecting a chip highlights it and updates the accent, title dot, selection line and description.
- [ ] The description matches the selected color.

## Playback
- [ ] Play/pause starts and stops the sound; the button icon and label follow.
- [ ] Status reads Paused (coral), Playing · Color (green) and Muted · Color (amber) with the right text.
- [ ] Volume changes the level and readout; mute toggles; unmuting at volume 0 restores the last volume.
- [ ] Switching color while playing crossfades without a click or gap.

## Sound options
- [ ] The details open and close with pointer and keyboard (Enter/Space on the summary).
- [ ] Every slider changes the sound and its value text live.
- [ ] Color settings appear only for Brown, Green, Grey and Orange.
- [ ] Wave length is dimmed while wave depth is Off.
- [ ] Reset restores volume, mute and all options, keeping the selected color.

## Persistence
- [ ] Reload keeps the color, volume, mute and all options; playback never auto-starts.
- [ ] Corrupt `noisehue:settings` in devtools falls back to defaults without errors.
- [ ] Legacy `noise-app-config` is migrated once and left untouched; old `noisehue:ui`/`noisehue:presets` data is ignored.

## Errors and edge cases
- [ ] No Web Audio: "Your browser can't play generated audio" shows, play/mute/volume are disabled, the rest still works.
- [ ] Storage blocked (private mode): the app works with defaults and doesn't error.
- [ ] Console is clean on load, play, color change and options use.

## Keyboard
- [ ] Every control is reachable with Tab in a sensible order with a visible focus ring.

## Browsers
| Browser | Desktop | Mobile |
|---|---|---|
| Safari | [ ] | [ ] iOS Safari |
| Chrome | [ ] | [ ] Android Chrome |
| Firefox | [ ] | — |
| Edge | [ ] | — |
