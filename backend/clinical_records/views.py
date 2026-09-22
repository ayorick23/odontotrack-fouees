from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from accounts.permissions import HasRequiredAcl
from patients.models import Patient

from .models import ClinicalRecord
from .serializers import ClinicalRecordSerializer, OdontogramSerializer
from .services import OdontogramService


class ClinicalRecordViewSet(ModelViewSet):
    """
    CRUD de registros clínicos. La validación por parte del docente
    (campos validated_by / is_validated / validated_at) se manejará en
    un endpoint de acción específico más adelante, no por escritura
    directa desde este serializer.
    """

    queryset = ClinicalRecord.objects.all()
    serializer_class = ClinicalRecordSerializer
    permission_classes = [IsAuthenticated, HasRequiredAcl]
    acl_permissions = {
        "list": "clinical_records.view",
        "retrieve": "clinical_records.view",
        "create": "clinical_records.create",
        "update": "clinical_records.edit",
        "partial_update": "clinical_records.edit",
        "destroy": "clinical_records.edit",
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
