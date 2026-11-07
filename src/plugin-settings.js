import { PluginSettingTab, Platform } from "obsidian";
export class BoardSettings extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  getSettingDefinitions() {
    return [
      {
        name: "Board background",
        desc: "Enter a hex color, for example #fffdf5, #f5fbff or #f5faf3.",
        control: {
          type: "text",
          key: "background",
          defaultValue: "#fffdf5",
        },
      },
      {
        name: "Show grid dots",
        desc: "Hide visual dots without disabling snapping or alignment guides.",
        control: { type: "toggle", key: "showGrid", defaultValue: true },
      },
      {
        name: "External MCP bridge",
        desc: "Off by default. A local authenticated listener lets configured assistants read and edit Board files. No embedded AI or provider keys.",
        control: {
          type: "toggle",
          key: "bridgeEnabled",
          defaultValue: false,
          disabled: !Platform.isDesktopApp,
        },
      },
      {
        name: "Allow MCP note reading",
        desc: "Let configured assistants search Markdown titles and read requested excerpts. External assistants may send this content to their model provider. Board editing does not require note access.",
        control: {
          type: "toggle",
          key: "bridgeReadNotes",
          defaultValue: false,
        },
      },
      {
        name: "Support development",
        desc: "Board remains free; donations are optional.",
        action: () =>
          window.open(
            "https://ko-fi.com/theprasanjitsahoo",
            "_blank",
            "noopener,noreferrer",
          ),
      },
      ...Object.entries(this.plugin.recovery).map(([path, draft]) => ({
        name: "Recover unsaved Board",
        desc: path,
        render: (setting) => {
          setting.addButton((button) =>
            button.setButtonText("Restore as new board").onClick(async () => {
              await this.plugin.restoreDraft(path, draft.source);
              this.update();
            }),
          );
        },
      })),
    ];
  }
  async setControlValue(key, value) {
    if (key === "background") {
      await this.plugin.setAppearance({ background: value });
      return;
    }
    if (key === "showGrid") {
      await this.plugin.setAppearance({ showGrid: value });
      return;
    }
    if (typeof value !== "boolean") throw new Error("Expected a toggle value");
    if (key === "bridgeEnabled") {
      await this.plugin.setBridgeEnabled(value);
      return;
    }
    if (key !== "bridgeReadNotes") throw new Error("Unknown Board preference");
    this.plugin.settings[key] = value;
    await this.plugin.saveSettings();
  }
}
