/** Access levels and permission engine contract. */

/** Defined access levels in order of increasing privilege. */
export enum AccessLevel {
  User = 0,
  Moderator = 10,
  Admin = 20,
  Owner = 30,
}

/** Check if a level meets or exceeds a requirement. */
export function meetsAccessLevel(have: AccessLevel, need: AccessLevel): boolean {
  return have >= need;
}

/** Interface for checking user permissions. */
export interface AccessEngine {
  check(userId: string, requiredLevel: AccessLevel): boolean;
}
