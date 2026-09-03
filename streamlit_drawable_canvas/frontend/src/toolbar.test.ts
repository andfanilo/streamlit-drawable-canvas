import { beforeEach, describe, expect, it } from "vitest";
import { buildToolbar, setToolbarState, setToolbarTheme } from "./toolbar";

const noop = () => {};
const callbacks = {
  onSend: noop,
  onUndo: noop,
  onRedo: noop,
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
    expect(card.querySelectorAll("button.dc-icon-button")).toHaveLength(4);
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
      "Reset canvas & history",
    ]);
  });

  it("clears prior content when called again", () => {
    buildToolbar(toolbarEl, callbacks);
    buildToolbar(toolbarEl, callbacks);

    expect(toolbarEl.querySelectorAll(".dc-toolbar-card")).toHaveLength(1);
    expect(toolbarEl.querySelectorAll("button")).toHaveLength(4);
  });

  it("disables undo/redo through setToolbarState", () => {
    const handles = buildToolbar(toolbarEl, callbacks);

    setToolbarState(handles, false, false);
    expect(handles.undoButton.disabled).toBe(true);
    expect(handles.redoButton.disabled).toBe(true);

    setToolbarState(handles, true, false);
    expect(handles.undoButton.disabled).toBe(false);
    expect(handles.redoButton.disabled).toBe(true);
  });
});

describe("setToolbarTheme", () => {
  const themeFor = (backgroundColor: string): string | undefined => {
    const container = document.createElement("div");
    container.style.setProperty("--st-background-color", backgroundColor);
    document.body.appendChild(container);
    setToolbarTheme(container);
    const theme = container.dataset.theme;
    container.remove();
    return theme;
  };

  it("reads Streamlit's default light and dark backgrounds", () => {
    expect(themeFor("#ffffff")).toBe("light");
    expect(themeFor("#0e1117")).toBe("dark");
  });

  it("accepts short hex and rgb()/rgba() notation", () => {
    expect(themeFor("#fff")).toBe("light");
    expect(themeFor("#123")).toBe("dark");
    expect(themeFor("rgb(255, 255, 255)")).toBe("light");
    expect(themeFor("rgba(14, 17, 23, 1)")).toBe("dark");
  });

  it("splits on luminance, not on the raw channel values", () => {
    // Same channel value, opposite verdicts: green carries ~10x the
    // luminance weight of blue.
    expect(themeFor("#00ff00")).toBe("light");
    expect(themeFor("#0000ff")).toBe("dark");
  });

  it("falls back to light when the variable is missing or unparseable", () => {
    expect(themeFor("")).toBe("light");
    expect(themeFor("not-a-color")).toBe("light");
  });
});
