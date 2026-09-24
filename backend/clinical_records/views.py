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
    OdontogramRevisionSerializer,
    OdontogramSerializer,
    TratamientoSerializer,
)
from .services import OdontogramService, queryset_for_patient, resolve_clinical_student


class DiagnosisViewSet(ModelViewSet):
    """
    CRUD de diagnósticos. La validación por parte del docente (campos
    validated_by / is_validated / validated_at) se maneja en un
    endpoint de acción específico agregado en ODO-31, no por escritura
    directa desde este serializer.
    """

    queryset = Diagnostico.objects.select_related("student", "validated_by")
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

    def get_queryset(self):
        return queryset_for_patient(
            super().get_queryset(),
            self.request.query_params.get("patient"),
        )

    def perform_create(self, serializer):
        patient = serializer.validated_data["patient"]
        serializer.save(
            student=resolve_clinical_student(
                user=self.request.user,
                patient=patient,
            )
        )


class TreatmentViewSet(ModelViewSet):
    """CRUD de tratamientos del caso."""

    queryset = Tratamiento.objects.select_related(
        "clinical_area",
        "clinical_treatment",
    )
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

    def get_queryset(self):
        return queryset_for_patient(
            super().get_queryset(),
            self.request.query_params.get("patient"),
        )


class ClinicalEvolutionViewSet(ModelViewSet):
    """CRUD de notas de evolución clínica del caso."""

    queryset = EvolucionClinica.objects.select_related("student")
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

    def get_queryset(self):
        return queryset_for_patient(
            super().get_queryset(),
            self.request.query_params.get("patient"),
        )

    def perform_create(self, serializer):
        patient = serializer.validated_data["patient"]
        serializer.save(
            student=resolve_clinical_student(
                user=self.request.user,
                patient=patient,
            )
        )


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
        OdontogramService.record_revision(odontogram, request.user)
        serializer = OdontogramSerializer(odontogram, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        return Response(serializer.data)


class PatientOdontogramHistoryView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredAcl]
    acl_permissions = {
        "get": "odontogram.view",
    }

    def get(self, request, patient_id: int):
        patient = get_object_or_404(Patient, pk=patient_id)
        OdontogramService.assert_can_view(request.user, patient)
        odontogram = OdontogramService.get_or_create(patient)
        revisions = odontogram.revisions.select_related("created_by")
        return Response(OdontogramRevisionSerializer(revisions, many=True).data)
