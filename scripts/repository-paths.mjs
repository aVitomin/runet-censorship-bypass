// Tooling ownership only; not build inputs or a package-discovery fallback.
// Review these paths together with build rules, CI and scoped instructions on a move.
export const TOOLING_ROOT = 'extensions/chromium/runet-censorship-bypass';
export const SOURCES = Object.freeze({
  chromium: `${TOOLING_ROOT}/src/extension-chromium-mv3`,
  firefox: `${TOOLING_ROOT}/src/extension-firefox-mv3`,
  shared: `${TOOLING_ROOT}/src/extension-mv3-common`,
  commonAssets: `${TOOLING_ROOT}/src/extension-common`,
  sharedIcons: `${TOOLING_ROOT}/src/extension-chromium-mv3/icons`,
});

export const SCOPED_GUIDANCE = Object.freeze([
  `${SOURCES.chromium}/background/AGENTS.md`,
  `${SOURCES.chromium}/pages/AGENTS.md`,
  `${SOURCES.firefox}/AGENTS.md`,
]);

export function isWithin(file, directory) {
  return file === directory || file.startsWith(`${directory}/`);
}
