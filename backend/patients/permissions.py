from rest_framework.permissions import SAFE_METHODS, BasePermission

from accounts.models import User
from assignments.models import Assignment

from .models import Patient


class EstudianteEditsOwnOrAvailablePatient(BasePermission):
    """Banco de pacientes: el estudiante edita los disponibles y los suyos.

    No toca casos activos de otro estudiante. Crear sí puede siempre
    (patients.create); esto solo mira el objeto al editar.
    """

    message = "Solo puedes editar pacientes disponibles o asignados a ti."

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if request.user.role != User.Role.ESTUDIANTE:
            return True
        own = obj.assignments.filter(
            student=request.user,
            status=Assignment.AssignmentStatus.ACTIVA,
        ).exists()
        return own or Patient.objects.available().filter(pk=obj.pk).exists()
