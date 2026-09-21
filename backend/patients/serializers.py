from rest_framework import serializers

from assignments.models import Assignment

from .models import Patient


class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = (
            "id",
            "first_name",
            "last_name",
            "dui",
            "carnet",
            "date_of_birth",
            "phone_number",
            "whatsapp_number",
            "email",
            "address",
            "photo",
            "emergency_contact_name",
            "emergency_contact_phone",
            "emergency_contact_relationship",
            "clinical_area",
            "case_status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class PatientListSerializer(serializers.ModelSerializer):
    assigned_to = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = (
            "id",
            "first_name",
            "last_name",
            "dui",
            "phone_number",
            "clinical_area",
            "case_status",
            "created_at",
            "assigned_to",
        )

    def get_assigned_to(self, patient: Patient) -> str | None:
        active = [
            assignment
            for assignment in patient.assignments.all()
            if assignment.status == Assignment.AssignmentStatus.ACTIVA
        ]
        if not active:
            return None
        student = active[0].student
        return student.get_full_name() or student.username
