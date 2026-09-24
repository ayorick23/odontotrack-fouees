from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import HasRequiredAcl

from .models import Assignment
from .serializers import AssignmentSerializer
from .services import finalize_assignment


class AssignmentViewSet(viewsets.ModelViewSet):
    """
    CRUD de asignaciones paciente-estudiante. El estado no se edita
    por PATCH: se cambia con acciones explícitas (p. ej. finalize) que
    delegan en services.py.
    """

    queryset = Assignment.objects.all()
    serializer_class = AssignmentSerializer
    permission_classes = [IsAuthenticated, HasRequiredAcl]
    acl_permissions = {
        "list": "assignments.view",
        "retrieve": "assignments.view",
        "create": ("assignments.create", "assignments.assign_student"),
        "update": "assignments.edit",
        "partial_update": "assignments.edit",
        "destroy": "assignments.edit",
        "finalize": "assignments.change_status",
    }

    @action(detail=True, methods=["post"])
    def finalize(self, request, pk=None):
        assignment = finalize_assignment(self.get_object())
        return Response(self.get_serializer(assignment).data)
