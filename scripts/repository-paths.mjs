// Tooling ownership only; not build inputs or a package-discovery fallback.
// Review these paths together with build rules, CI and scoped instructions on a move.
export const TOOLING_ROOT = 'extension';
export const SOURCES = Object.freeze({
  chromium: `${TOOLING_ROOT}/src/chromium`,
  firefox: `${TOOLING_ROOT}/src/firefox`,
  shared: `${TOOLING_ROOT}/src/shared`,
  chromiumCompat: `${TOOLING_ROOT}/src/chromium-compat`,
  sharedIcons: `${TOOLING_ROOT}/src/chromium/icons`,
});

export const SCOPED_GUIDANCE = Object.freeze([
  `${SOURCES.chromium}/background/AGENTS.md`,
  `${SOURCES.chromium}/pages/AGENTS.md`,
  `${SOURCES.firefox}/AGENTS.md`,
]);

export function isWithin(file, directory) {
  return file === directory || file.startsWith(`${directory}/`);
}
