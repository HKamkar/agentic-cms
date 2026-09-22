// The lab as a package: the scene functions the command line and the route
// share, the in-page clock, and the LabScenes server component a site's
// throwaway route renders (docs/lab.md § The route).
export { LAB_API, LAB_CONTROLS_HTML, labControls } from "./api.ts";
export { LabScenes, type Ground, type LabScenesProps } from "./LabScenes.ts";
export { LAB_COMMENT, LAB_DIR, animates, followsTheme, isSceneName, listScenes, sceneMeta, svgMarkup, tagRoot, type SceneMeta } from "./scenes.ts";
