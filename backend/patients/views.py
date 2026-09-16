from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Patient
from .serializers import PatientSerializer


class PatientViewSet(viewsets.ModelViewSet):
    """
    CRUD de pacientes. Todavía sin reglas de permisos por rol
    (ej. que un estudiante solo vea sus pacientes asignados);
    eso se implementará junto con la lógica de negocio de assignments.
    """

    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    permission_classes = [IsAuthenticated]
