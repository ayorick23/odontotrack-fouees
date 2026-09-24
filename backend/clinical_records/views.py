from django.shortcuts import get_object_or_404
from rest_framework.decorators import action
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
from .services import (
    DiagnosisService,
    OdontogramService,
    assert_can_write_clinical,
    queryset_for_patient,
    resolve_clinical_student,
    scope_clinical_queryset,
)


class ClinicalScopeMixin:
    """
    Scoping por rol de los ViewSets clínicos: filtra por ?patient= y por
    los pacientes visibles para el usuario, y bloquea la escritura del
    estudiante sobre pacientes que no tiene asignados (ODO-33).
    """

    def get_queryset(self):
        queryset = queryset_for_patient(
            super().get_queryset(),
            self.request.query_params.get("patient"),
        )
        return scope_clinical_queryset(queryset, self.request.user)

    def perform_update(self, serializer):
        assert_can_write_clinical(self.request.user, serializer.instance.patient)
        new_patient = serializer.validated_data.get("patient")
        if new_patient is not None:
            assert_can_write_clinical(self.request.user, new_patient)
        serializer.save()

    def perform_destroy(self, instance):
        assert_can_write_clinical(self.request.user, instance.patient)
        instance.delete()


class DiagnosisViewSet(ClinicalScopeMixin, ModelViewSet):
    """
    CRUD de diagnósticos. La validación por parte del docente (campos
    validated_by / is_validated / validated_at) se hace solo con
    POST /diagnoses/{id}/validate/, no por escritura directa desde el
    serializer.
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
        "validate_diagnosis": "diagnoses.validate",
    }

    def perform_create(self, serializer):
        patient = serializer.validated_data["patient"]
        assert_can_write_clinical(self.request.user, patient)
        serializer.save(
            student=resolve_clinical_student(
                user=self.request.user,
                patient=patient,
            )
        )

    @action(detail=True, methods=["post"], url_path="validate")
    def validate_diagnosis(self, request, pk=None):
        diagnosis = DiagnosisService.validate(self.get_object(), request.user)
        return Response(self.get_serializer(diagnosis).data)


class TreatmentViewSet(ClinicalScopeMixin, ModelViewSet):
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

    def perform_create(self, serializer):
        assert_can_write_clinical(
            self.request.user, serializer.validated_data["patient"]
        )
        serializer.save()


class ClinicalEvolutionViewSet(ClinicalScopeMixin, ModelViewSet):
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

    def perform_create(self, serializer):
        patient = serializer.validated_data["patient"]
        assert_can_write_clinical(self.request.user, patient)
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
