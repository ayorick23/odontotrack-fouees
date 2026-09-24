from django.contrib.auth import get_user_model
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import HasRequiredAcl, RecepcionCannotEditAssignedPatient
from assignments.models import Assignment

from .models import Patient
from .serializers import PatientListSerializer, PatientSerializer

User = get_user_model()


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
        "assignees": "patients.view",
    }
    filter_backends = [filters.SearchFilter]
    search_fields = ["first_name", "last_name"]

    def get_queryset(self):
        params = self.request.query_params
        return (
            Patient.objects.prefetch_related("assignments__student")
            .select_related("clinical_area", "clinical_treatment")
            .in_period(params.get("period"))
            .by_case_status(params.get("case_status"))
            .by_clinical_area(params.get("clinical_area"))
            .by_assignee(params.get("assigned_to"))
            .order_by("id")
        )

    def get_serializer_class(self):
        if self.action == "list":
            return PatientListSerializer
        return PatientSerializer

    @action(detail=False, methods=["get"])
    def assignees(self, request):
        students = (
            User.objects.filter(
                role=User.Role.ESTUDIANTE,
                patient_assignments__status=Assignment.AssignmentStatus.ACTIVA,
            )
            .distinct()
            .order_by("last_name", "first_name", "id")
        )
        return Response(
            [
                {
                    "id": student.id,
                    "name": student.get_full_name() or student.username,
                }
                for student in students
            ]
        )
