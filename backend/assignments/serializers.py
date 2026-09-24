from rest_framework import serializers

from accounts.models import User

from .models import Assignment


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
