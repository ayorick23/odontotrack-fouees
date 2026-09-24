from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import User
from accounts.permissions import HasRequiredAcl

from .models import Assignment
from .serializers import (
    AssignableStudentSerializer,
    AssignmentSerializer,
    BulkAssignmentSerializer,
    ClaimAssignmentSerializer,
)
from .services import (
    assign_patient,
    assign_patients,
    assignable_students,
    claim_available_patients,
    finalize_assignment,
)

# El combo busca en el servidor; con 20 opciones basta para elegir.
STUDENT_OPTIONS_LIMIT = 20


class AssignmentViewSet(viewsets.ModelViewSet):
    """
    CRUD de asignaciones paciente-estudiante. El estado no se edita
    por PATCH: se cambia con acciones explícitas (p. ej. finalize) que
    delegan en services.py.
    """

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
        "finalize": "assignments.change_status",
        "claim": "assignments.claim",
        "assign": ("assignments.create", "assignments.assign_student"),
        "students": "assignments.assign_student",
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.role == User.Role.ESTUDIANTE:
            return queryset.filter(student=user)
        return queryset

    def perform_create(self, serializer):
        fields = dict(serializer.validated_data)
        serializer.instance = assign_patient(
            patient_id=fields.pop("patient").pk,
            **fields,
        )

    @action(detail=True, methods=["post"])
    def finalize(self, request, pk=None):
        assignment = finalize_assignment(self.get_object())
        return Response(self.get_serializer(assignment).data)

    @action(detail=False, methods=["post"])
    def claim(self, request):
        payload = ClaimAssignmentSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        assignments = claim_available_patients(
            user=request.user,
            patient_ids=data["patients"],
            reason=data["reason"],
        )
        return Response(
            AssignmentSerializer(assignments, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"])
    def assign(self, request):
        payload = BulkAssignmentSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        assignments = assign_patients(
            patient_ids=data["patients"],
            student=data["student"],
            reason=data["reason"],
        )
        return Response(
            AssignmentSerializer(assignments, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"])
    def students(self, request):
        students = assignable_students(request.query_params.get("search", ""))
        return Response(
            AssignableStudentSerializer(
                students[:STUDENT_OPTIONS_LIMIT],
                many=True,
            ).data
        )
