// The lab as a package: the scene functions the command line and the routes
// share, the render's in-page clock (LAB_API), the one timeline every
// animated preview is inspected with (mountTimeline, LabTimeline), and the
// server components a throwaway route renders — LabScenes for the lab's,
// LabStudy for a design round's (docs/lab.md).
export { LAB_API } from "./api.ts";
export { LabScenes, type LabScenesProps } from "./LabScenes.ts";
export { LabStudy, type Ground, type LabStudyProps } from "./LabStudy.ts";
export { LabTimeline, type LabTimelineProps } from "./LabTimeline.ts";
export { TIMELINE_CSS, mountTimeline, timelineControlsHtml, timelineScript, type Timeline, type TimelineOptions } from "./timeline.ts";
export { LAB_COMMENT, LAB_DIR, ROUNDS_DIR, animates, followsTheme, isSceneName, listScenes, namespaceIds, readTrustedSvg, sceneDuration, sceneMeta, svgMarkup, tagRoot, type SceneMeta } from "./scenes.ts";
