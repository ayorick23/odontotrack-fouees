from rest_framework import serializers

from accounts.models import User

from .models import Assignment


class AssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assignment
        fields = "__all__"
        read_only_fields = ["appointment_number"]


class ClaimAssignmentSerializer(serializers.Serializer):
    patient = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(required=False, allow_blank=True, default="")
    priority = serializers.ChoiceField(
        choices=Assignment.Priority.choices,
        default=Assignment.Priority.MEDIA,
    )


class AssignableStudentSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    active_cases = serializers.IntegerField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "name", "active_cases"]

    def get_name(self, student: User) -> str:
        return student.get_full_name() or student.username
