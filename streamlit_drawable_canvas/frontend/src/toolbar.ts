// Toolbar DOM + inline SVG icons, stroked with `currentColor` inherited from
// `.dc-toolbar-card`. Layout mirrors Streamlit's `stElementToolbar`: a
// positioning wrapper (`.dc-toolbar`) holding a floating card
// (`.dc-toolbar-card`). See `styles.css`.

const ICONS = {
  // Upload arrow, not the mirrored download arrow Streamlit uses for CSV export.
  upload:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 18V6"/><path d="M7 11l5-5 5 5"/><path d="M5 21h14"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/></svg>',
  redo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h2"/></svg>',
  bin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg>',
  forward:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 16V8"/><path d="M8 12l4-4 4 4"/></svg>',
  backward:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8v8"/><path d="M8 12l4 4 4-4"/></svg>',
  deleteSelected:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
} as const;

export interface ToolbarCallbacks {
  onSend: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onEditToggle: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onDeleteSelected: () => void;
  onReset: () => void;
}

export interface ToolbarHandles {
  undoButton: HTMLButtonElement;
  redoButton: HTMLButtonElement;
  editButton: HTMLButtonElement;
  contextualGroup: HTMLDivElement;
  bringForwardButton: HTMLButtonElement;
  sendBackwardButton: HTMLButtonElement;
  deleteSelectedButton: HTMLButtonElement;
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

/** Builds the toolbar's DOM, clearing any prior content. */
export const buildToolbar = (
  toolbarEl: HTMLElement,
  callbacks: ToolbarCallbacks
): ToolbarHandles => {
  toolbarEl.innerHTML = "";

  const card = document.createElement("div");
  card.className = "dc-toolbar-card";
  toolbarEl.appendChild(card);

  const sendButton = makeButton(
    "upload",
    "Update the app with this drawing",
    callbacks.onSend
  );
  const undoButton = makeButton("undo", "Undo", callbacks.onUndo);
  const redoButton = makeButton("redo", "Redo", callbacks.onRedo);

  const separator = document.createElement("div");
  separator.className = "dc-toolbar-separator";

  const editButton = makeButton("edit", "Edit", callbacks.onEditToggle);
  editButton.setAttribute("aria-pressed", "false");

  const bringForwardButton = makeButton(
    "forward",
    "Bring forward",
    callbacks.onBringForward
  );
  const sendBackwardButton = makeButton(
    "backward",
    "Send backward",
    callbacks.onSendBackward
  );
  const deleteSelectedButton = makeButton(
    "deleteSelected",
    "Delete selected",
    callbacks.onDeleteSelected
  );

  const contextualGroup = document.createElement("div");
  contextualGroup.className = "dc-toolbar-contextual";
  contextualGroup.append(
    bringForwardButton,
    sendBackwardButton,
    deleteSelectedButton
  );

  const resetButton = makeButton(
    "bin",
    "Reset canvas & history",
    callbacks.onReset
  );

  card.append(
    sendButton,
    undoButton,
    redoButton,
    separator,
    editButton,
    contextualGroup,
    resetButton
  );

  return {
    undoButton,
    redoButton,
    editButton,
    contextualGroup,
    bringForwardButton,
    sendBackwardButton,
    deleteSelectedButton,
  };
};

export const setToolbarState = (
  handles: ToolbarHandles,
  canUndo: boolean,
  canRedo: boolean,
  isEditMode: boolean,
  hasActiveSelection: boolean
): void => {
  handles.undoButton.disabled = !canUndo;
  handles.redoButton.disabled = !canRedo;
  handles.editButton.setAttribute("aria-pressed", String(isEditMode));
  handles.contextualGroup.style.display = isEditMode ? "flex" : "none";
  handles.bringForwardButton.disabled = !hasActiveSelection;
  handles.sendBackwardButton.disabled = !hasActiveSelection;
  handles.deleteSelectedButton.disabled = !hasActiveSelection;
};
