import { lazy } from "react";

import type { PluginManifest } from "../../../src/pluginTypes";

// OPD Saathi (prototype): the Chrome widget rebuilt as a CARE App.
// It sits in CARE's "Scribe" slot on the consultation form, so CARE hands it the
// form's own data (formState) instead of the widget reading the page.
const manifest: PluginManifest = {
  plugin: "care_assist_fe",
  components: {
    Scribe: lazy(() => import("./components/AssistPanel")),
  },
};

export default manifest;
