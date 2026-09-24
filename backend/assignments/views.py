from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import HasRequiredAcl

from .models import Assignment
from .serializers import AssignmentSerializer, ClaimAssignmentSerializer
from .services import assign_patient, claim_available_patient


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
        "claim": "assignments.claim",
    }

    def perform_create(self, serializer):
        fields = dict(serializer.validated_data)
        serializer.instance = assign_patient(
            patient_id=fields.pop("patient").pk,
            **fields,
        )

    @action(detail=False, methods=["post"])
    def claim(self, request):
        payload = ClaimAssignmentSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        assignment = claim_available_patient(
            user=request.user,
            patient_id=payload.validated_data["patient"],
            reason=payload.validated_data["reason"],
            priority=payload.validated_data["priority"],
        )
        return Response(
            AssignmentSerializer(assignment).data,
            status=status.HTTP_201_CREATED,
        )
