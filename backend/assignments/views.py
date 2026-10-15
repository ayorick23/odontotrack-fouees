from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import User
from accounts.permissions import HasRequiredAcl

from .models import Appointment, Assignment
from .serializers import (
    AppointmentCreateSerializer,
    AppointmentRangeSerializer,
    AppointmentSerializer,
    AppointmentStatusSerializer,
    AppointmentUpdateSerializer,
    AssignableStudentSerializer,
    AssignmentSerializer,
    BulkAssignmentSerializer,
    ClaimAssignmentSerializer,
    SchedulableAssignmentSerializer,
)
from .services import (
    assign_patient,
    assign_patients,
    assignable_students,
    change_appointment_status,
    claim_available_patients,
    finalize_assignment,
    reschedule_appointment,
    schedulable_assignments,
    schedule_appointment,
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


class AppointmentViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    Citas del calendario. Qué se puede hacer lo decide el permiso
    (calendar.view / calendar.create / calendar.edit); qué citas se ven, el
    alcance del usuario (el estudiante, solo las de sus casos). No se borran:
    se cancelan.
    """

    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated, HasRequiredAcl]
    pagination_class = None
    acl_permissions = {
        "list": "calendar.view",
        "retrieve": "calendar.view",
        "create": "calendar.create",
        "schedulable": "calendar.create",
        "partial_update": "calendar.edit",
        "change_status": "calendar.edit",
    }

    def get_queryset(self):
        return Appointment.objects.visible_to(self.request.user).select_related(
            "assignment__patient", "assignment__student"
        )

    def list(self, request):
        params = AppointmentRangeSerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        appointments = self.get_queryset().in_range(
            params.validated_data.get("start"),
            params.validated_data.get("end"),
        )
        return Response(AppointmentSerializer(appointments, many=True).data)

    def create(self, request):
        payload = AppointmentCreateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        appointment = schedule_appointment(
            user=request.user,
            assignment_id=data["assignment"],
            starts_at=data["starts_at"],
            duration_minutes=data["duration_minutes"],
            notes=data["notes"],
        )
        return Response(
            AppointmentSerializer(appointment).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, pk=None):
        payload = AppointmentUpdateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        appointment = reschedule_appointment(self.get_object(), **payload.validated_data)
        return Response(AppointmentSerializer(appointment).data)

    @action(detail=True, methods=["post"], url_path="status")
    def change_status(self, request, pk=None):
        payload = AppointmentStatusSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        appointment = change_appointment_status(
            self.get_object(), payload.validated_data["status"]
        )
        return Response(AppointmentSerializer(appointment).data)

    @action(detail=False, methods=["get"])
    def schedulable(self, request):
        assignments = schedulable_assignments(
            request.user, request.query_params.get("search", "")
        )
        return Response(
            SchedulableAssignmentSerializer(
                assignments[:STUDENT_OPTIONS_LIMIT], many=True
            ).data
        )
