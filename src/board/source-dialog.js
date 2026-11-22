import mermaid from "../mermaid-renderer.js";
import { parse, readBoard, serialize } from "../model.js";
export function createSourceDialog({
  $,
  modal,
  canvas,
  on,
  finishText,
  hideMenus,
  getDraft,
  setDraft,
  getSource,
  getModel,
  clearSelection,
  commit,
  pasteText,
  fixedTitle,
  setTitle,
  status,
}) {
  let importing = false;
  function showSource(asImport = false) {
    finishText();
    hideMenus();
    importing = asImport;
    modal.hidden = false;
    modal
      .querySelector("section")
      .setAttribute(
        "aria-label",
        asImport ? "Import Mermaid" : "Mermaid source",
      );
    $(".rea-dialog-heading strong").textContent = asImport
      ? "Import Mermaid"
      : "Mermaid";
    $(".rea-source").setAttribute(
      "placeholder",
      asImport ? "Paste Mermaid code or a fenced Mermaid block here…" : "",
    );
    $(".rea-source").value = asImport ? "" : (getDraft() ?? getSource());
    $(".rea-source-error").textContent = "";
    $(".rea-direction").value = getModel()?.direction || "LR";
    $(".rea-direction").disabled = asImport || !getModel();
    $(".rea-import-file").hidden = !asImport;
    $("[data-action=apply-source]").textContent = asImport
      ? "Import diagram"
      : "Apply changes";
    $(".rea-source").focus();
  }
  function closeSource() {
    if (!importing) setDraft($(".rea-source").value);
    modal.hidden = true;
    canvas.focus();
  }
  async function applySource() {
    const entered = $(".rea-source").value,
      value = readBoard(entered) || entered;
    try {
      await mermaid.parse(value);
      if (importing) {
        clearSelection();
      }
      commit(value, { autoFit: importing });
      modal.hidden = true;
      canvas.focus();
    } catch {
      $(".rea-source-error").textContent =
        "Check your syntax. The saved board has not changed.";
    }
  }
  function bind() {
    on($(".rea-source"), "input", () => setDraft($(".rea-source").value));
    on($(".rea-direction"), "change", (e) => {
      const next = parse($(".rea-source").value);
      if (next) {
        next.direction = e.target.value;
        for (const n of next.nodes) delete n.position;
        $(".rea-source").value = serialize(next);
        setDraft($(".rea-source").value);
      }
    });
    on($(".rea-file"), "change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        if (/\.(svg|json|excalidraw|tldr)$/i.test(file.name)) {
          await pasteText(text);
          e.target.value = "";
          return;
        }
        const next = readBoard(text) || text;
        await mermaid.parse(next);
        if (!fixedTitle) {
          setTitle(file.name.replace(/\.(board|md|mmd|mermaid)$/, ""));
        }
        clearSelection();
        modal.hidden = true;
        commit(next, { autoFit: true });
      } catch {
        status("Could not import that Mermaid file.", true);
      }
      e.target.value = "";
    });
  }
  return { showSource, closeSource, applySource, bind };
}
