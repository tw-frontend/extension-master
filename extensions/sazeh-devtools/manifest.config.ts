import { defineManifest } from "@crxjs/vite-plugin";

import pkg from "./package.json" with { type: "json" };

export default defineManifest({
  manifest_version: 3,
  name: "Sazeh DevTools",
  version: pkg.version,
  description: pkg.description,
  icons: {
    "16": "logo.png",
    "32": "logo.png",
    "48": "logo.png",
    "128": "logo.png",
  },
  action: {
    default_popup: "index.html",
    default_title: "Sazeh DevTools",
    default_icon: {
      "16": "logo.png",
      "32": "logo.png",
      "48": "logo.png",
      "128": "logo.png",
    },
  },
  // activeTab + scripting let us read/write the focused tab's localStorage on
  // demand without standing host permissions. tabs is used to read the URL and
  // reload after saving an override.
  permissions: ["scripting", "activeTab", "tabs"],
});
