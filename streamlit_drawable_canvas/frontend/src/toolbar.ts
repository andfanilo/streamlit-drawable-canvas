// Toolbar DOM + inline SVG icons (F5). Icons are stroked with `currentColor`,
// inherited from `.dc-toolbar-card`'s `color` -- no PNGs and no
// `filter: invert(...) hue-rotate(...)` recolor hack.
//
// Layout mirrors Streamlit's own element toolbar (`stElementToolbar`): a
// positioning wrapper (`.dc-toolbar`) holding a floating card
// (`.dc-toolbar-card`), revealed above the canvas's top-right on hover. See
// `styles.css`.

const ICONS = {
  download:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/></svg>',
  redo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h2"/></svg>',
  bin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg>',
} as const;

export interface ToolbarCallbacks {
  onSend: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
}

export interface ToolbarHandles {
  undoButton: HTMLButtonElement;
  redoButton: HTMLButtonElement;
}

const makeButton = (
  icon: keyof typeof ICONS,
  label: string,
  onClick: () => void
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "dc-icon-button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.innerHTML = ICONS[icon];
  button.addEventListener("click", onClick);
  return button;
};

/**
 * Build the toolbar's DOM once. Safe to call multiple times on the same
 * element (e.g. if it were ever torn down); it clears prior content first.
 */
export const buildToolbar = (
  toolbarEl: HTMLElement,
  callbacks: ToolbarCallbacks
): ToolbarHandles => {
  toolbarEl.innerHTML = "";

  const card = document.createElement("div");
  card.className = "dc-toolbar-card";
  toolbarEl.appendChild(card);

  const sendButton = makeButton(
    "download",
    "Send to Streamlit",
    callbacks.onSend
  );
  const undoButton = makeButton("undo", "Undo", callbacks.onUndo);
  const redoButton = makeButton("redo", "Redo", callbacks.onRedo);
  const resetButton = makeButton(
    "bin",
    "Reset canvas & history",
    callbacks.onReset
  );

  card.append(sendButton, undoButton, redoButton, resetButton);

  return { undoButton, redoButton };
};

export const setToolbarState = (
  handles: ToolbarHandles,
  canUndo: boolean,
  canRedo: boolean
): void => {
  handles.undoButton.disabled = !canUndo;
  handles.redoButton.disabled = !canRedo;
};

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Parse `#abc`, `#aabbcc` or `rgb(...)`/`rgba(...)` to 0-255 channels. */
const parseRgb = (color: string): [number, number, number] | null => {
  const trimmed = color.trim();

  const hex = HEX.exec(trimmed);
  if (hex) {
    const digits =
      hex[1].length === 3 ? hex[1].replace(/./g, (d) => d + d) : hex[1];
    return [
      parseInt(digits.slice(0, 2), 16),
      parseInt(digits.slice(2, 4), 16),
      parseInt(digits.slice(4, 6), 16),
    ];
  }

  const parts = trimmed.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return null;
  const rgb = parts.slice(0, 3).map(Number);
  return rgb.every((c) => Number.isFinite(c))
    ? (rgb as [number, number, number])
    : null;
};

/** sRGB relative luminance of a CSS color, or null if unparseable. */
const luminance = (color: string): number | null => {
  const rgb = parseRgb(color);
  if (!rgb) return null;

  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * Stamp `data-theme` on the container from the luminance of
 * `--st-background-color`, mirroring Streamlit's own
 * `hasLightBackgroundColor`. Only the two toolbar values that differ by
 * theme base -- shadow depth and icon opacity -- key off it; everything else
 * is a `--st-*` variable and needs no branch.
 */
export const setToolbarTheme = (container: HTMLElement): void => {
  const bg = getComputedStyle(container).getPropertyValue(
    "--st-background-color"
  );
  const l = luminance(bg);
  container.dataset.theme = l !== null && l <= 0.5 ? "dark" : "light";
};
