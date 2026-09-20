export function can(
  user: { permissions: readonly string[] } | null | undefined,
  permission: string,
): boolean {
  return user?.permissions.includes(permission) ?? false;
}

export function canAny(
  user: { permissions: readonly string[] } | null | undefined,
  permissions: readonly string[],
): boolean {
  return permissions.some((permission) => can(user, permission));
}
