import { existsSync } from "node:fs";
const macChrome =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const browserOptions = {
  headless: true,
  ...(process.env.REA_BOARD_CHROME
    ? { executablePath: process.env.REA_BOARD_CHROME }
    : existsSync(macChrome)
      ? { executablePath: macChrome }
      : {}),
};
