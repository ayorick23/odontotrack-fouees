from collections.abc import Iterable

from django.utils.text import slugify
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import AclPermission, Notification, Role, User
from .permissions_catalog import SYSTEM_ROLES, all_permission_names, iter_catalog_permissions


def unique_role_slug(name: str) -> str:
    base = slugify(name)[:40] or "rol"
    candidate = base
    index = 2
    while Role.objects.filter(slug=candidate).exists():
        suffix = f"-{index}"
        candidate = f"{base[: 40 - len(suffix)]}{suffix}"
        index += 1
    return candidate


def sync_acl(*, reset_role_defaults: bool = False) -> dict[str, int]:
    """Crea/actualiza permisos del catálogo y roles de sistema.

    Solo desarrollo local (`acl_sync_permissions`). No corre al migrar.
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


def notify(
    recipients: Iterable[User],
    kind: str,
    title: str,
    body: str = "",
    link: str = "",
) -> list[Notification]:
    """Crea el mismo aviso para cada destinatario (ODO-68)."""
    return Notification.objects.bulk_create(
        Notification(
            recipient=recipient, kind=kind, title=title, body=body, link=link
        )
        for recipient in recipients
    )


# Relaciones que dejan rastro clínico. Las CASCADE borrarían expediente
# (diagnósticos, evoluciones, asignaciones) y las SET_NULL, la autoría.
_HISTORY_RELATIONS = (
    "patient_assignments",
    "authored_diagnoses",
    "authored_clinical_evolutions",
    "validated_diagnoses",
    "updated_odontograms",
    "odontogram_revisions",
)


def user_has_history(user: User) -> bool:
    return any(getattr(user, name).exists() for name in _HISTORY_RELATIONS)


def _is_admin(user: User) -> bool:
    return user.is_superuser or user.role == User.Role.ADMIN


def assert_can_manage_user(
    actor: User,
    target: User | None,
    *,
    new_role: str | None = None,
    new_is_active: bool | None = None,
) -> None:
    """Reglas de gestión de cuentas que el ACL solo no cubre (ODO-64).

    - Solo un admin crea, edita o asigna cuentas admin: soporte tiene
      users.edit y si no podría ascenderse a sí mismo.
    - Nadie se desactiva ni se cambia el rol a sí mismo (se quedaría fuera).
    `target` es None al crear.
    """
    touches_admin = new_role == User.Role.ADMIN or (
        target is not None and _is_admin(target)
    )
    if touches_admin and not _is_admin(actor):
        raise PermissionDenied("Solo un administrador puede gestionar cuentas de administrador.")
    if target is not None and target.pk == actor.pk:
        if new_is_active is False:
            raise ValidationError({"is_active": "No puedes desactivar tu propia cuenta."})
        if new_role is not None and new_role != actor.role:
            raise ValidationError({"role": "No puedes cambiar tu propio rol."})


def assert_can_delete_user(actor: User, target: User) -> None:
    assert_can_manage_user(actor, target)
    if target.pk == actor.pk:
        raise ValidationError({"detail": "No puedes eliminar tu propia cuenta."})
    if user_has_history(target):
        raise ValidationError(
            {
                "detail": (
                    "Esta cuenta tiene historial clínico y no se puede eliminar. "
                    "Desactívala para bloquear el acceso."
                )
            }
        )
