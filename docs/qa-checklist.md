# Noise Hue — manual QA checklist

Run against `npm run build && npm run preview` (or `npm run dev`). Spec: [§9 Testing](superpowers/specs/2026-10-13-noisehue-design.md#9-testing). Tick each item per browser.

## Desktop (window ≥ 1000 px wide)

### Panels
- [ ] Both panels start pinned (unless a saved layout says otherwise).
- [ ] Unpinning a panel collapses it to a rail at once and keeps it closed until the pointer leaves.
- [ ] Hovering a collapsed rail opens the panel; it closes about 150 ms after the pointer leaves.
- [ ] Clicking a control inside an open unpinned panel, then moving away, closes it and focus doesn't stay hidden inside.
- [ ] Tabbing onto a rail opens the panel.
- [ ] The color description is hidden while the color panel is unpinned; hovering a color still previews it.
- [ ] Pin state survives a reload.

### Colors
- [ ] Hovering a color shows an inset border in that color (none on touch devices).
- [ ] Hovering or focusing a color previews its description; leaving restores the selected one.
- [ ] Choosing a color updates the accent, the title dot, the selected-color line and the description.
- [ ] The title dot bounces on each color change (not on first load).
- [ ] While playing, the selected color's ring is solid and ripples outward; paused, it is a soft ring with no ripple.
- [ ] While playing, the play button shows the same ripple in the accent color.
- [ ] Switching color while playing crossfades smoothly (no click or gap).

### Waveform and compare
- [ ] The waveform fades in when playing and fades out (0.6 s) when paused.
- [ ] The compare icon and a click on the waveform both toggle the compare overlay, and both show as pressed.
- [ ] Compare on White: "White is the flat reference line. / Select another color to see its difference."
- [ ] Compare on another color while paused: dashed ideal curve only, "Dashed: ideal shape / Press play to measure live".
- [ ] Compare while playing: solid measured curve follows the dashed ideal, "Solid: measured · Dashed: ideal / Flat line: white noise".
- [ ] Compare while muted: measured curve disappears (ideal only).

### Background
- [ ] The glow rises from the bottom in the accent color, grows with volume and follows the pan slider.
- [ ] It moves gently (waves) while playing and also while paused with volume above 0.
- [ ] Muted or volume 0: plain dark background, no motion.

### Sound panel
- [ ] Every slider updates its value text live and the sound in real time.
- [ ] Double-clicking a slider restores its default.
- [ ] Changed-dots appear on groups with non-default values; Reset restores volume and options but keeps the color.
- [ ] Wave length is dimmed while Wave depth is Off.
- [ ] Color settings group appears only for Brown, Green, Grey and Orange; dragging those sliders regenerates the sound shortly after (no glitch while dragging).

### Playback bar
- [ ] Status reads Paused (coral), Playing · Color (green), Muted · Color (amber).
- [ ] Mute icon reflects muted / low (< 50 %) / high; un-muting at volume 0 restores the last volume.
- [ ] Volume and mute changes ramp smoothly (no zipper noise).
- [ ] Volume, mute, color and options survive a reload; playback never auto-starts.

### Fullscreen / immersive
- [ ] The fullscreen button enters browser fullscreen (where allowed) and immersive mode: panels and bar fade, title and selected-color line hide.
- [ ] The description hides while audible and returns when paused or muted.
- [ ] "Click or press any key to exit" shows, then fades after about 3 s.
- [ ] Exit by click, by any key (except Tab and modifiers), and by leaving browser fullscreen (Esc). Focus returns to the fullscreen button.
- [ ] If the browser refuses fullscreen, immersive mode still works in the page.

### Sleep timer
- [ ] The moon button opens the popover: Off, 15, 30, 45, 60, 90, Custom (1–480). Esc closes it and returns focus.
- [ ] Set while paused: the button is tinted (armed) and counting starts only on play.
- [ ] Set while playing: starts immediately; the button shows "27m" / "<1m" and the status adds "· 27m left".
- [ ] Full run with a short custom timer (e.g. 2 min): the sound fades over the last 20 % (or the last 60 s for ≥ 5 min), then pauses. The volume slider never moves; the next play is at full level.
- [ ] Manual pause cancels the timer. Color, option, preset and fullscreen changes don't affect it.
- [ ] Choosing Off or a new length during the fade restores full level and keeps playing.
- [ ] Timer keeps counting in a background tab.
- [ ] After a reload the popover defaults to the last choice, but no timer is running.

### Presets
- [ ] "+ Save" opens an inline name prefilled "<Color> N" (next free N). Enter saves, Esc cancels; empty or >32-char names are refused.
- [ ] Applying a preset sets color and options (crossfade while playing, stays paused otherwise); volume and mute don't change.
- [ ] The active chip is highlighted while the settings match, and clears on any change.
- [ ] × deletes without confirmation; focus stays in the row.
- [ ] With 20 presets, Save is disabled with a tooltip.
- [ ] Presets survive a reload.

## Mobile (< 1000 px; also check at phone width)
- [ ] Single column in this order: player, colors, sound. No horizontal scroll.
- [ ] Color grid: 3 columns, 2 below 800 px, 1 below 500 px.
- [ ] Fold bars: "● Pink · Show colors" and "Show sound options · Defaults / N changed"; folded panels stack flush with hairlines. Fold state survives a reload.
- [ ] Touch sizes: play 4 rem, mute 3.25 rem, icon buttons 3.5 rem, sliders 3.25 rem tall.
- [ ] The playback bar stays stuck to the bottom while scrolling within the player.
- [ ] Sound may stop when the phone locks (expected for v1).

## Reduced motion (OS setting "reduce motion" on)
- [ ] No background wave motion, ring or play ripples, dot bounce or panel slide; the glow is static.
- [ ] Toggling the OS setting while the page is open takes effect without a reload.

## Keyboard-only pass
- [ ] Every control is reachable with Tab in a sensible order, with a visible focus ring.
- [ ] Colors, pins, folds, sliders (arrow keys), presets, timer popover and fullscreen all work without a mouse.

## Errors and edge cases
- [ ] No Web Audio (e.g. a browser with it disabled): "Your browser can't play generated audio" shows, play, timer, mute and volume are disabled, the rest still works.
- [ ] Storage blocked (private mode / blocked site data): the app works with defaults and doesn't error.
- [ ] Corrupt stored data (edit `noisehue:settings` in devtools to junk): bad fields fall back to defaults.
- [ ] Legacy `noise-app-config` / `noise-app-panes` data is imported once and left untouched.
- [ ] Browser console is clean on load, play, color change, compare and fullscreen.

## Browsers
| Browser | Desktop | Mobile |
|---|---|---|
| Safari | [ ] | [ ] iOS Safari |
| Chrome | [ ] | [ ] Android Chrome |
| Firefox | [ ] | — |
| Edge | [ ] | — |
