from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from accounts.permissions import HasRequiredAcl

from .models import Assignment
from .serializers import AssignmentSerializer


class AssignmentViewSet(viewsets.ModelViewSet):
    """CRUD de asignaciones paciente-estudiante."""

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
    }
