import { beforeEach, describe, expect, it } from "vitest";
import { buildToolbar, setToolbarState } from "./toolbar";

const noop = () => {};
const callbacks = {
  onSend: noop,
  onUndo: noop,
  onRedo: noop,
  onBringForward: noop,
  onSendBackward: noop,
  onDeleteSelected: noop,
  onReset: noop,
};

describe("buildToolbar", () => {
  let toolbarEl: HTMLDivElement;

  beforeEach(() => {
    toolbarEl = document.createElement("div");
    toolbarEl.className = "dc-toolbar";
  });

  it("nests the buttons in a card, not in the positioning wrapper", () => {
    buildToolbar(toolbarEl, callbacks);

    expect(toolbarEl.children).toHaveLength(1);
    const card = toolbarEl.firstElementChild as HTMLElement;
    expect(card.className).toBe("dc-toolbar-card");
    expect(card.querySelectorAll("button.dc-icon-button")).toHaveLength(7);
    expect(toolbarEl.querySelectorAll(":scope > button")).toHaveLength(0);
  });

  it("labels every button", () => {
    buildToolbar(toolbarEl, callbacks);

    const labels = [...toolbarEl.querySelectorAll("button")].map((b) =>
      b.getAttribute("aria-label")
    );
    expect(labels).toEqual([
      "Update the app with this drawing",
      "Undo",
      "Redo",
      "Bring forward",
      "Send backward",
      "Delete selected",
      "Reset canvas & history",
    ]);
  });

  it("clears prior content when called again", () => {
    buildToolbar(toolbarEl, callbacks);
    buildToolbar(toolbarEl, callbacks);

    expect(toolbarEl.querySelectorAll(".dc-toolbar-card")).toHaveLength(1);
    expect(toolbarEl.querySelectorAll("button")).toHaveLength(7);
  });

  it("disables undo/redo through setToolbarState", () => {
    const handles = buildToolbar(toolbarEl, callbacks);

    setToolbarState(handles, false, false, false, false);
    expect(handles.undoButton.disabled).toBe(true);
    expect(handles.redoButton.disabled).toBe(true);

    setToolbarState(handles, true, false, false, false);
    expect(handles.undoButton.disabled).toBe(false);
    expect(handles.redoButton.disabled).toBe(true);
  });

  it("shows the contextual group only in transform mode", () => {
    const handles = buildToolbar(toolbarEl, callbacks);

    setToolbarState(handles, false, false, false, false);
    expect(handles.contextualGroup.style.display).toBe("none");

    setToolbarState(handles, false, false, true, false);
    expect(handles.contextualGroup.style.display).toBe("flex");
  });

  it("disables the contextual buttons without an active selection", () => {
    const handles = buildToolbar(toolbarEl, callbacks);

    setToolbarState(handles, false, false, true, false);
    expect(handles.bringForwardButton.disabled).toBe(true);
    expect(handles.sendBackwardButton.disabled).toBe(true);
    expect(handles.deleteSelectedButton.disabled).toBe(true);

    setToolbarState(handles, false, false, true, true);
    expect(handles.bringForwardButton.disabled).toBe(false);
    expect(handles.sendBackwardButton.disabled).toBe(false);
    expect(handles.deleteSelectedButton.disabled).toBe(false);
  });
});
