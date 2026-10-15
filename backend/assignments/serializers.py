from rest_framework import serializers

from accounts.models import User

from .models import Appointment, Assignment


class AssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assignment
        fields = "__all__"
        read_only_fields = ["appointment_number", "status"]


# Igual al tamaño de página de "Pacientes disponibles".
MAX_PATIENTS_PER_ASSIGNMENT = 20


class ClaimAssignmentSerializer(serializers.Serializer):
    patients = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        min_length=1,
        max_length=MAX_PATIENTS_PER_ASSIGNMENT,
    )
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class BulkAssignmentSerializer(ClaimAssignmentSerializer):
    student = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())


class AssignableStudentSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    active_cases = serializers.IntegerField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "name", "active_cases"]

    def get_name(self, student: User) -> str:
        return student.get_full_name() or student.username


def _person(first_name: str, last_name: str, fallback: str = "") -> str:
    return f"{first_name} {last_name}".strip() or fallback


class AppointmentSerializer(serializers.ModelSerializer):
    patient = serializers.SerializerMethodField()
    student = serializers.SerializerMethodField()
    ends_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Appointment
        fields = [
            "id",
            "assignment",
            "patient",
            "student",
            "starts_at",
            "ends_at",
            "duration_minutes",
            "status",
            "notes",
        ]

    def get_patient(self, appointment: Appointment) -> dict:
        patient = appointment.assignment.patient
        return {"id": patient.id, "name": _person(patient.first_name, patient.last_name)}

    def get_student(self, appointment: Appointment) -> dict:
        student = appointment.assignment.student
        return {
            "id": student.id,
            "name": _person(student.first_name, student.last_name, student.username),
        }


class AppointmentRangeSerializer(serializers.Serializer):
    """Rango visible del calendario (?start=&end=), ambos opcionales."""

    start = serializers.DateTimeField(required=False)
    end = serializers.DateTimeField(required=False)


class AppointmentCreateSerializer(serializers.Serializer):
    assignment = serializers.IntegerField(min_value=1)
    starts_at = serializers.DateTimeField()
    duration_minutes = serializers.ChoiceField(
        choices=Appointment.Duration.choices,
        default=Appointment.Duration.UNA_HORA,
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class AppointmentUpdateSerializer(serializers.Serializer):
    starts_at = serializers.DateTimeField(required=False)
    duration_minutes = serializers.ChoiceField(
        choices=Appointment.Duration.choices,
        required=False,
    )
    notes = serializers.CharField(required=False, allow_blank=True)


class AppointmentStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            (Appointment.Status.ATENDIDA, "Atendida"),
            (Appointment.Status.CANCELADA, "Cancelada"),
        ]
    )


class SchedulableAssignmentSerializer(serializers.ModelSerializer):
    patient = serializers.SerializerMethodField()
    student = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = ["id", "patient", "student"]

    def get_patient(self, assignment: Assignment) -> str:
        return _person(assignment.patient.first_name, assignment.patient.last_name)

    def get_student(self, assignment: Assignment) -> str:
        student = assignment.student
        return _person(student.first_name, student.last_name, student.username)
