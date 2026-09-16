from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Assignment
from .serializers import AssignmentSerializer


class AssignmentViewSet(viewsets.ModelViewSet):
    """CRUD de asignaciones paciente-estudiante."""

    queryset = Assignment.objects.all()
    serializer_class = AssignmentSerializer
    permission_classes = [IsAuthenticated]
