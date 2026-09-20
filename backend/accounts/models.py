from functools import cached_property

from django.contrib.auth.models import AbstractUser
from django.db import models


class AclPermission(models.Model):
    """Permiso del catálogo `{modulo}.{accion}`. No crear filas a mano."""

    name = models.CharField(max_length=100, unique=True)
    module = models.CharField(max_length=50)
    action = models.CharField(max_length=50)

    class Meta:
        ordering = ["module", "action"]
        verbose_name = "permiso ACL"
        verbose_name_plural = "permisos ACL"

    def __str__(self):
        return self.name


class Role(models.Model):
    """Rol del sistema. El usuario hereda los permisos de su rol (RBAC)."""

    name = models.CharField(max_length=80)
    slug = models.SlugField(max_length=40, unique=True)
    description = models.TextField(blank=True)
    is_system = models.BooleanField(
        default=False,
        help_text="Los roles de sistema (admin, docente, …) no se eliminan.",
    )
    permissions = models.ManyToManyField(
        AclPermission,
        related_name="roles",
        blank=True,
    )

    class Meta:
        ordering = ["name"]
        verbose_name = "rol"
        verbose_name_plural = "roles"

    def __str__(self):
        return f"{self.name} ({self.slug})"

    def sync_permissions(self, names: list[str]) -> None:
        """Reemplaza los permisos del rol por los names del catálogo."""
        from .permissions_catalog import all_permission_names

        unique_names = list(dict.fromkeys(names))
        unknown = [name for name in unique_names if name not in all_permission_names()]
        if unknown:
            raise ValueError(unknown)
        permissions = AclPermission.objects.filter(name__in=unique_names)
        self.permissions.set(permissions)


class User(AbstractUser):
    """
    Usuario personalizado de la plataforma.

    `role` es la identidad FOUEES (estudiante asignable, docente validador).
    Los permisos de pantalla y API los hereda del Role con el mismo slug.
    """

    class Role(models.TextChoices):
        ADMIN = "admin", "Administrador"
        DOCENTE = "docente", "Docente supervisor"
        ESTUDIANTE = "estudiante", "Estudiante"
        RECEPCION = "recepcion", "Recepción / Administrativo"
        SOPORTE = "soporte", "Soporte técnico"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.ESTUDIANTE,
        help_text="Identidad del usuario. Los permisos salen de la matriz ACL del rol.",
    )

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.role})"

    @cached_property
    def acl_codenames(self) -> frozenset[str]:
        acl_role = (
            Role.objects.filter(slug=self.role)
            .prefetch_related("permissions")
            .first()
        )
        if acl_role is None:
            return frozenset()
        return frozenset(acl_role.permissions.values_list("name", flat=True))

    def has_acl(self, name: str) -> bool:
        return name in self.acl_codenames
