// For tests/undefinedNames.test.js: one name in code that nothing declares, one that a list can allow, and one only named in a comment, which is fine.
/** @param {NamedOnlyInACommentType} a */
export function uses(a) {
  return [a, GHOST_NAME, ALLOWED_NAME];
}
