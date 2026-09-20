from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticated

from accounts.permissions import HasRequiredAcl, RecepcionCannotEditAssignedPatient

from .models import Patient
from .serializers import PatientListSerializer, PatientSerializer


class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    permission_classes = [IsAuthenticated, HasRequiredAcl, RecepcionCannotEditAssignedPatient]
    acl_permissions = {
        "list": "patients.view",
        "retrieve": "patients.view",
        "create": "patients.create",
        "update": "patients.edit",
        "partial_update": "patients.edit",
        "destroy": "patients.delete",
    }
    filter_backends = [filters.SearchFilter]
    search_fields = ["first_name", "last_name", "document_id"]

    def get_queryset(self):
        queryset = (
            Patient.objects.prefetch_related("assignments__student")
            .in_period(self.request.query_params.get("period"))
            .order_by("id")
        )
        case_status = self.request.query_params.get("case_status")
        if case_status in Patient.CaseStatus.values:
            queryset = queryset.filter(case_status=case_status)
        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return PatientListSerializer
        return PatientSerializer
