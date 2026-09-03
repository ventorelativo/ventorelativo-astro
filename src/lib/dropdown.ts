/**
 * Light-dismiss for a `<details>` used as a dropdown.
 *
 * `<details>` gives the open/close state, the keyboard behaviour and the
 * accessible role for free, which is why all three of this site's dropdowns are
 * one. The two things it does not give are closing when you click elsewhere and
 * closing on Escape — that is all this is.
 *
 * Shared rather than copied a third time: the theme toggle and the language
 * switcher each carry their own version of these listeners. Astro bundles per
 * page, so importing this costs nothing on a page that has no dropdown.
 *
 * The listeners are never removed. Navigation on this site is cross-document
 * (`@view-transition { navigation: auto }`), so each page starts with a fresh
 * document and nothing accumulates.
 */
export function dismissable(
  root: HTMLDetailsElement,
  focusOnClose?: HTMLElement | null,
) {
  document.addEventListener('click', (event) => {
    if (root.open && !root.contains(event.target as Node)) root.open = false;
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && root.open) {
      root.open = false;
      focusOnClose?.focus();
    }
  });
}
