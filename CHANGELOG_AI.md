# AI Change Log

This file tracks product updates implemented in this workspace when requested.

## 2026-03-02

### Navigation and global layout
- Added a global `ROLLIA` header for game flow and later adjusted placement based on route requirements.
- Kept `ROLLIA` only on the chatbot/game page when requested.
- Added hover behavior to the requested header/button element.
- Kept layout compatibility with left sidebar + right character panel.

### Language and localization
- Added language selection support (English/Russian), then moved selector to first screen only (`/`) per request.
- Wired language through frontend -> backend calls so AI responses follow selected language.
- Fixed case where Russian UI still produced English DM output.
- Applied additional Russian-style constraints to DM output (clearer prose, fewer metaphors, stronger grammar/subject clarity).

### Campaign persistence and continue flow
- Implemented character/session persistence.
- Added `Continue session` behavior on main page when saved state exists.
- Fixed reload/continue behavior where chat reset instead of restoring previous campaign context.
- Fixed empty chat on continue by restoring persisted campaign/chat state.

### Session and character management pages
- Added Characters menu:
- View saved characters.
- Select active character.
- Delete character.
- Added Sessions menu:
- View created sessions.
- Continue/start selected session.
- Delete session.
- Moved related actions into header-level navigation with page redirects.
- Fixed issue where text input on `Create new session` failed after navigation from header.

### Logs / export
- Added on-demand log generation (not auto-saving every turn).
- Added/kept `Export Log` action in relevant header context.
- Clarified where to find/use log export in UI.

### Dice/check and result presentation
- Added post-check result animation (success/fail glow + pulse behavior).
- Fixed visibility/trigger issues for the animation.
- Centered check-result animation relative to check container.
- Centered related text (`bonus`, `modifier`, `overall result`) with the check block.

### DM output structure and formatting rules
- Refined DM narration output format and consistency:
- Stable scene transitions with explicit transition reasons.
- Required block structure (immediate action, atmosphere, tension hook).
- Reduced metaphor stacking.
- Differentiated NPC voice styles.
- Enforced consistent header placement:
  - `Dungeon Master`
  - `Location · Sub-Location · Time`
- Fixed cases where location header appeared inside body text after checks.
- Applied additional Russian-specific clarity/logic constraints:
- explicit acting subject
- spatial continuity
- lore anchoring
- contradiction removal
- cleaner dialogue precision

### Custom class generation: AI weapon + armor
- Extended custom class schema with:
- `startingWeapon`
- `startingArmor` (with `armorClass`)
- Updated backend custom class generation prompt/response/fallbacks to always include starter weapon/armor.
- Updated frontend `CustomClassResponse` typings accordingly.

### Character creation flow alignment
- Found two different character creation flows (`src/pages/*` vs `src/components/character-creation/*`).
- Fixed active `/character/*` flow to use real `generateCustomClass` and persist generated class data.
- Updated review/confirm step to persist:
- `customClassData`
- `equipment`
- `inventoryItems`

### Inventory/equipment persistence and migration
- Added startup/profile migration so old profiles can receive generated starter loadout.
- Fixed migration so it does not re-add removed items after manual unequip.
- Backfill now only runs when `equipment` field is missing (`undefined`) rather than every update.

### Equipment UI in Loadout -> Inventory
- Added `Equipment Box` in `Loadout -> Inventory`.
- Made `Equipment Box` dynamic from generated/player items.
- Slot values now show localized empty state:
- `Empty` (EN)
- `Пусто` (RU)
- Mapped generated weapon/armor into expected slots (`Right Hand`, `Body`) and matched other slots by name keywords.

### Equipped items actions
- Reduced equipped status visual footprint as requested (smaller badge iteration).
- Replaced text status with icon actions:
- Equip icon
- Unequip icon
- Changed to conditional single icon per item:
- If equipped: only unequip icon.
- If not equipped: only equip icon.
- Fixed behavior so clicking actions actually updates state and slots reflect changes.

### Item detail expansion
- Added click-to-expand item description under item row (small text, below main item label).
- Kept animation/expand behavior lightweight for readability.

### Misc support items requested during work
- Clarified project file locations when asked (e.g., `main.tsx` lookup context).
- Kept gameplay mechanics/dice logic unchanged while applying narrative/formatting and UI changes.

---

## Maintenance rule
- When user asks to "update changelog", append a new dated section with:
- what changed
- why it changed
- where it changed (files/components)
