# packages/ui

Geteilte Design-Tokens und React-Komponenten für `apps/web`.

- `tokens.ts` – Farben, Spacing, Radius, Schriftgrößen als reine TS-Konstanten.
  Plattformneutral, deshalb auch aus `apps/mobile` importierbar (z.B. für
  `StyleSheet`-Farben), auch wenn die React-Komponenten hier DOM-basiert sind.
- `tokens.css` – dieselbe Palette als CSS Custom Properties, inkl. Dark Mode
  (`prefers-color-scheme`). Wird von `apps/web` importiert.
- Komponenten (`Button`, `TagChip`, `ConfidenceBadge`, `Card`, `EmptyState`,
  `ErrorState`, `Field`) kapseln wiederkehrende UI-Bausteine, die vorher in
  `apps/web` dupliziert waren.

Nur nutzen, wenn Web und Mobile sich tatsächlich Tokens/Komponenten teilen
können – für reines React-Native-UI direkt `tokens.ts` importieren statt die
DOM-Komponenten.
