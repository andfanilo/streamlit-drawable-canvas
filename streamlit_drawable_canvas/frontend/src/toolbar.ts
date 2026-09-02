// Toolbar DOM + inline SVG icons (F5). Icons are stroked with `currentColor`
// so `.dc-icon-button`'s CSS `color: var(--st-text-color)` drives them --
// no PNGs, no `filter: invert(...) hue-rotate(...)` recolor hack, and dark
// mode works because the CSS variable itself flips.

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

  toolbarEl.append(sendButton, undoButton, redoButton, resetButton);

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
