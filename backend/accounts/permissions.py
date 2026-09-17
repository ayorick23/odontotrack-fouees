from rest_framework.permissions import BasePermission

from accounts.models import User


class IsAdminOrSoporte(BasePermission):
    """Alta y edición de usuarios: no hay registro público."""

    message = "Solo administración o soporte pueden crear o modificar usuarios."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.role in (User.Role.ADMIN, User.Role.SOPORTE)
        )
