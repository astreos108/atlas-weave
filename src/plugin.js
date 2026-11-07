import { backgroundHex } from "./appearance.js";
import {
  Plugin,
  FileView,
  Notice,
  TFile,
  TFolder,
  normalizePath,
  addIcon,
  Platform,
} from "obsidian";
import { mount } from "./canvas.js";
import { BoardSettings } from "./plugin-settings.js";
import { pickNoteLink } from "./note-links.js";
import { readBoard, replaceBoard } from "./model.js";
const VIEW = "rea-whimsical";
class BoardView extends FileView {
  getViewType() {
    return VIEW;
  }
  getDisplayText() {
    return this.file?.basename || "Board";
  }
  getIcon() {
    return "rea-board";
  }
  async setState(state, result) {
    // Restore tabs from 0.1, whose custom view stored a path instead of FileView's file.
    if (state.path && !state.file) state = { ...state, file: state.path };
    await super.setState(state, result);
  }
  cacheEditorSession() {
    if (this.board && this.boardPath) {
      const session = this.board.getEditorSession();
      if (session) this.plugin.editorSessions.set(this.boardPath, session);
      else this.plugin.editorSessions.delete(this.boardPath);
    }
  }
  async onLoadFile(file) {
    this.cacheEditorSession();
    await this.board?.flush();
    this.board?.destroy();
    this.contentEl.empty();
    let baseline = await this.app.vault.read(file);
    const getSource = (text) =>
      file.extension === "board" ? text.trim() : readBoard(text);
    const source = getSource(baseline);
    if (source === null) {
      this.contentEl.setText(
        "This note has no Mermaid block. Use New board to start a board.",
      );
      return;
    }
    this.boardPath = file.path;
    this.board = mount(this.contentEl, {
      title: file.basename,
      source,
      theme: this.plugin.settings.theme,
      snap: this.plugin.settings.snap,
      background: this.plugin.settings.background,
      showGrid: this.plugin.settings.showGrid,
      counterEnabled: this.plugin.settings.counterEnabled,
      characterTarget: this.plugin.settings.characterTarget,
      setTextPreferences: (patch) => this.plugin.setTextPreferences(patch),
      editorSession: this.plugin.editorSessions.get(file.path),
      resolveLinkTitle: (target) =>
        this.app.metadataCache.getFirstLinkpathDest(
          target.split("#")[0],
          file.path,
        )?.basename,
      setAppearance: (patch) => this.plugin.setAppearance(patch),
      setSnap: (value) => this.plugin.setSnap(value),
      pickLink: () => pickNoteLink(this.app),
      setTheme: (theme) => this.plugin.setTheme(theme),
      fixedTitle: true,
      ...this.plugin.clipboard,
      rename: async (name) => {
        await this.board?.flush();
        const path = normalizePath(
          `${file.parent?.path || ""}/${name}.${file.extension}`,
        );
        await this.app.fileManager.renameFile(file, path);
      },
      newBoard: () => this.plugin.createBoard(file.parent?.path || ""),
      openLink: (link) => this.app.workspace.openLinkText(link, file.path),
      save: async (next) => {
        let saved;
        try {
          await this.app.vault.process(file, (current) => {
            if (getSource(current) !== getSource(baseline))
              throw new Error(
                "Board changed elsewhere. Reopen the board to reload",
              );
            saved =
              file.extension === "board"
                ? `${next}\n`
                : replaceBoard(current, next);
            return saved;
          });
          baseline = saved;
          delete this.plugin.recovery[file.path];
          await this.plugin.saveSettings();
        } catch (error) {
          this.plugin.recovery[file.path] = {
            source: next,
            updated: Date.now(),
          };
          await this.plugin.saveSettings();
          throw error;
        }
      },
    });
  }
  async onRename(file) {
    await super.onRename(file);
    this.boardPath = file.path;
    this.board?.setTitle(file.basename);
  }
  async onUnloadFile() {
    this.cacheEditorSession();
    await this.board?.flush();
    this.board?.destroy();
    this.board = null;
  }
  async onClose() {
    await this.onUnloadFile();
  }
}
export default class ReaWhimsical extends Plugin {
  async setTextPreferences(patch) {
    if (patch.counterEnabled !== undefined)
      this.settings.counterEnabled = !!patch.counterEnabled;
    if (patch.characterTarget !== undefined)
      this.settings.characterTarget = Math.max(
        1,
        Math.min(10000, Math.round(Number(patch.characterTarget) || 280)),
      );
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW))
      leaf.view.board?.setTextPreferences(patch);
    await this.saveSettings();
  }
  async setAppearance(patch) {
    if (patch.background !== undefined && !backgroundHex(patch.background))
      throw new Error("Unknown background");
    if (patch.background !== undefined)
      this.settings.background = backgroundHex(patch.background);
    if (patch.showGrid !== undefined) this.settings.showGrid = !!patch.showGrid;
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW))
      leaf.view.board?.setAppearance(patch);
    await this.saveSettings();
  }
  async setSnap(value) {
    this.settings.snap = value;
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW))
      leaf.view.board?.setSnap(value);
    await this.saveSettings();
  }
  async setTheme(theme) {
    this.settings.theme = theme;
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW))
      leaf.view.board?.setTheme(theme);
    await this.saveSettings();
  }
  async onload() {
    this.editorSessions = new Map();
    const stored = (await this.loadData()) || {};
    this.settings = {
      theme: "light",
      background: "#fffdf5",
      showGrid: true,
      counterEnabled: false,
      characterTarget: 280,
      snap: true,
      bridgeEnabled: false,
      bridgeReadNotes: false,
      ...stored.settings,
      ...(stored.theme
        ? { theme: stored.theme, snap: stored.snap !== false }
        : {}),
    };
    this.settings.background =
      backgroundHex(this.settings.background) || "#fffdf5";
    this.recovery = stored.recovery || {};
    this.disposed = false;
    this.addSettingTab(new BoardSettings(this.app, this));
    if (Platform.isDesktopApp) {
      const { desktopClipboard } = await import("./desktop-clipboard.js");
      this.clipboard = desktopClipboard();
    }
    addIcon(
      "rea-board",
      '<rect x="13" y="14" width="74" height="57" rx="5" fill="none" stroke="currentColor" stroke-width="7"/><path d="M35 90l15-19 15 19M29 32h17m9 22h16M46 32l9 22" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
    );
    this.registerView(VIEW, (leaf) => {
      const view = new BoardView(leaf);
      view.plugin = this;
      return view;
    });
    this.registerExtensions(["board"], VIEW);
    this.addRibbonIcon("rea-board", "New board", () => this.createBoard());
    this.addCommand({
      id: "new-board",
      name: "New board",
      callback: () => this.createBoard(),
    });
    this.addCommand({
      id: "open-board",
      name: "Open current note as board",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (file?.extension !== "md") return false;
        if (!checking) this.openBoard(file);
        return true;
      },
    });
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof TFolder)
          menu.addItem((item) =>
            item
              .setTitle("New board")
              .setIcon("rea-board")
              .onClick(() => this.createBoard(file.path)),
          );
        if (file instanceof TFile && file.extension === "md")
          menu.addItem((item) =>
            item
              .setTitle("Open as board")
              .setIcon("rea-board")
              .onClick(() => this.openBoard(file)),
          );
      }),
    );
    if (this.settings.bridgeEnabled && Platform.isDesktopApp)
      try {
        await this.setBridgeEnabled(true);
      } catch (error) {
        new Notice(`Board MCP bridge unavailable: ${error.message}`);
      }
  }
  onunload() {
    this.disposed = true;
    this.bridge?.close();
  }
  async saveSettings() {
    const snapshot = JSON.parse(
      JSON.stringify({ settings: this.settings, recovery: this.recovery }),
    );
    this.settingsQueue = (this.settingsQueue || Promise.resolve())
      .catch(() => {})
      .then(() => this.saveData(snapshot));
    await this.settingsQueue;
  }
  async setBridgeEnabled(enabled) {
    const generation = (this.bridgeGeneration =
      (this.bridgeGeneration || 0) + 1);
    this.settings.bridgeEnabled = enabled;
    this.bridge?.close();
    this.bridge = null;
    if (enabled) {
      if (!Platform.isDesktopApp)
        throw new Error("MCP bridge requires desktop Obsidian");
      const { startBridge } = await import("./bridge-server.js");
      const bridge = await startBridge(this.app, this);
      if (
        this.disposed ||
        !this.settings.bridgeEnabled ||
        generation !== this.bridgeGeneration
      ) {
        bridge.close();
        return;
      }
      this.bridge = bridge;
    }
    await this.saveSettings();
  }
  async restoreDraft(path, source) {
    const base = path.replace(/\.(board|md)$/i, "") + " recovered";
    let candidate = base + ".board",
      i = 1;
    while (this.app.vault.getAbstractFileByPath(candidate))
      candidate = base + " " + i++ + ".board";
    const file = await this.app.vault.create(candidate, source + "\n");
    delete this.recovery[path];
    await this.saveSettings();
    await this.openBoard(file);
  }
  async openBoard(file) {
    if (file.extension === "board") {
      const leaf = this.app.workspace.getLeaf("tab");
      await leaf.openFile(file);
      return;
    }
    if (readBoard(await this.app.vault.read(file)) === null) {
      new Notice("This note needs a fenced Mermaid block first.");
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: VIEW,
      state: { file: file.path },
      active: true,
    });
    this.app.workspace.revealLeaf(leaf);
  }
  async createBoard(folder) {
    const parent =
      folder ?? this.app.workspace.getActiveFile()?.parent?.path ?? "";
    let i = 0,
      path;
    do {
      path = normalizePath(`${parent}/Untitled board${i ? ` ${i}` : ""}.board`);
      i++;
    } while (this.app.vault.getAbstractFileByPath(path));
    const file = await this.app.vault.create(path, "flowchart LR\n");
    await this.openBoard(file);
  }
}
