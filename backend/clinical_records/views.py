from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from accounts.permissions import HasRequiredAcl

from .models import ClinicalRecord
from .serializers import ClinicalRecordSerializer


class ClinicalRecordViewSet(viewsets.ModelViewSet):
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
