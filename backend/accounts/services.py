from .models import AclPermission, Role
from .permissions_catalog import SYSTEM_ROLES, all_permission_names, iter_catalog_permissions


def sync_acl(*, reset_role_defaults: bool = False) -> dict[str, int]:
    """Crea/actualiza permisos del catálogo y roles de sistema.

    No pisa la matriz de un rol existente salvo `reset_role_defaults`.
    """
    catalog_names = all_permission_names()
    created_permissions = 0
    for name, module, action in iter_catalog_permissions():
        _permission, created = AclPermission.objects.update_or_create(
            name=name,
            defaults={"module": module, "action": action},
        )
        if created:
            created_permissions += 1

    deleted_permissions, _ = AclPermission.objects.exclude(
        name__in=catalog_names
    ).delete()

    created_roles = 0
    synced_defaults = 0
    for spec in SYSTEM_ROLES:
        role, created = Role.objects.get_or_create(
            slug=spec.slug,
            defaults={
                "name": spec.name,
                "description": spec.description,
                "is_system": True,
            },
        )
        if created:
            created_roles += 1
        else:
            role.is_system = True
            if not role.name:
                role.name = spec.name
            role.save(update_fields=["is_system", "name"])

        if spec.permissions is None:
            role.permissions.set(
                AclPermission.objects.filter(name__in=catalog_names)
            )
            synced_defaults += 1
        elif created or reset_role_defaults:
            role.permissions.set(
                AclPermission.objects.filter(name__in=spec.permissions)
            )
            synced_defaults += 1

    return {
        "permissions_created": created_permissions,
        "permissions_deleted": deleted_permissions,
        "roles_created": created_roles,
        "role_defaults_applied": synced_defaults,
        "permissions_total": AclPermission.objects.count(),
    }
