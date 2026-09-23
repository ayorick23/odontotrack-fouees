from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from accounts.permissions import HasRequiredAcl
from patients.models import Patient

from .models import Diagnostico, EvolucionClinica, Tratamiento
from .serializers import (
    DiagnosticoSerializer,
    EvolucionClinicaSerializer,
    OdontogramSerializer,
    TratamientoSerializer,
)
from .services import OdontogramService


class DiagnosisViewSet(ModelViewSet):
    """
    CRUD de diagnósticos. La validación por parte del docente (campos
    validated_by / is_validated / validated_at) se maneja en un
    endpoint de acción específico agregado en ODO-31, no por escritura
    directa desde este serializer.
    """

    queryset = Diagnostico.objects.all()
    serializer_class = DiagnosticoSerializer
    permission_classes = [IsAuthenticated, HasRequiredAcl]
    acl_permissions = {
        "list": "diagnoses.view",
        "retrieve": "diagnoses.view",
        "create": "diagnoses.create",
        "update": "diagnoses.edit",
        "partial_update": "diagnoses.edit",
        "destroy": "diagnoses.edit",
    }


class TreatmentViewSet(ModelViewSet):
    """CRUD de tratamientos del caso."""

    queryset = Tratamiento.objects.all()
    serializer_class = TratamientoSerializer
    permission_classes = [IsAuthenticated, HasRequiredAcl]
    acl_permissions = {
        "list": "treatments.view",
        "retrieve": "treatments.view",
        "create": "treatments.create",
        "update": "treatments.edit",
        "partial_update": "treatments.edit",
        "destroy": "treatments.edit",
    }


class ClinicalEvolutionViewSet(ModelViewSet):
    """CRUD de notas de evolución clínica del caso."""

    queryset = EvolucionClinica.objects.all()
    serializer_class = EvolucionClinicaSerializer
    permission_classes = [IsAuthenticated, HasRequiredAcl]
    acl_permissions = {
        "list": "evolution.view",
        "retrieve": "evolution.view",
        "create": "evolution.create",
        "update": "evolution.edit",
        "partial_update": "evolution.edit",
        "destroy": "evolution.edit",
    }


class PatientOdontogramView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredAcl]
    acl_permissions = {
        "get": "odontogram.view",
        "put": "odontogram.update",
    }

    def get(self, request, patient_id: int):
        patient = get_object_or_404(Patient, pk=patient_id)
        OdontogramService.assert_can_view(request.user, patient)
        odontogram = OdontogramService.get_or_create(patient)
        return Response(OdontogramSerializer(odontogram).data)

    def put(self, request, patient_id: int):
        patient = get_object_or_404(Patient, pk=patient_id)
        OdontogramService.assert_can_update(request.user, patient)
        odontogram = OdontogramService.get_or_create(patient)
        serializer = OdontogramSerializer(odontogram, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        return Response(serializer.data)
