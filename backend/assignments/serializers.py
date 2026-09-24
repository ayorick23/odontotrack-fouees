from rest_framework import serializers

from .models import Assignment


class AssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assignment
        fields = "__all__"
        read_only_fields = ["appointment_number"]


class ClaimAssignmentSerializer(serializers.Serializer):
    patient = serializers.IntegerField(min_value=1)
    reason = serializers.CharField()
    priority = serializers.ChoiceField(
        choices=Assignment.Priority.choices,
        default=Assignment.Priority.MEDIA,
    )
