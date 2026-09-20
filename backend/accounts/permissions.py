from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import User


class HasRequiredAcl(BasePermission):
    """Chequea `view.acl_permission` o `view.acl_permissions[action]`.

    Si la acción no está mapeada, deja pasar (p. ej. GET /me).
    """

    message = "No tienes permiso para esta acción."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        required = self._required(request, view)
        if required is None:
            return True
        if isinstance(required, (list, tuple, frozenset)):
            return any(user.has_acl(name) for name in required)
        return user.has_acl(required)

    def _required(self, request, view):
        single = getattr(view, "acl_permission", None)
        if single:
            return single
        mapping = getattr(view, "acl_permissions", None) or {}
        action = getattr(view, "action", None)
        if action is not None and action in mapping:
            return mapping[action]
        return mapping.get(request.method.lower())


class _HasRole(BasePermission):
    allowed_roles: tuple[str, ...] = ()
    message = "No tienes permiso para esta acción."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and user.role in self.allowed_roles
        )


class IsAdmin(_HasRole):
    allowed_roles = (User.Role.ADMIN,)
    message = "Solo administración puede realizar esta acción."


class IsDocente(_HasRole):
    allowed_roles = (User.Role.DOCENTE,)
    message = "Solo docentes pueden realizar esta acción."


class IsEstudiante(_HasRole):
    allowed_roles = (User.Role.ESTUDIANTE,)
    message = "Solo estudiantes pueden realizar esta acción."


class IsRecepcion(_HasRole):
    allowed_roles = (User.Role.RECEPCION,)
    message = "Solo recepción puede realizar esta acción."


class IsSoporte(_HasRole):
    allowed_roles = (User.Role.SOPORTE,)
    message = "Solo soporte técnico puede realizar esta acción."


class IsAdminOrSoporte(_HasRole):
    allowed_roles = (User.Role.ADMIN, User.Role.SOPORTE)
    message = "Solo administración o soporte pueden crear o modificar usuarios."


class RecepcionCannotEditAssignedPatient(BasePermission):
    message = "Recepción no puede editar pacientes ya asignados a un estudiante."

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if request.user.role != User.Role.RECEPCION:
            return True
        return not obj.has_active_assignment()
