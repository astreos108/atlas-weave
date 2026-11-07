// Loaded only by the desktop adapter, never by domain or UI modules.
export function desktopClipboard() {
  const { clipboard, nativeImage } = require("electron");
  return {
    readClipboard: async () => ({
      text: clipboard.readText(),
      html: clipboard.readHTML(),
    }),
    copyImage: async (bytes) =>
      clipboard.writeImage(nativeImage.createFromBuffer(Buffer.from(bytes))),
    copySvg: async (svg) => clipboard.write({ text: svg, html: svg }),
  };
}
