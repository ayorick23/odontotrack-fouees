from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from assignments.models import Assignment

from .models import Patient

MAX_PHOTO_BYTES = 2 * 1024 * 1024
ALLOWED_PHOTO_CONTENT_TYPES = frozenset(
    {"image/jpeg", "image/jpg", "image/png", "image/webp"}
)


class StrippedCharField(serializers.CharField):
    def to_internal_value(self, data):
        if isinstance(data, str):
            data = data.strip()
        return super().to_internal_value(data)


class PatientPhotoField(serializers.ImageField):
    def to_internal_value(self, data):
        size = getattr(data, "size", 0) or 0
        if size > MAX_PHOTO_BYTES:
            raise serializers.ValidationError("La foto no puede superar 2 MB.")
        content_type = getattr(data, "content_type", "") or ""
        if content_type and content_type not in ALLOWED_PHOTO_CONTENT_TYPES:
            raise serializers.ValidationError("La foto debe ser JPG, PNG o WebP.")
        return super().to_internal_value(data)


class PatientSerializer(serializers.ModelSerializer):
    first_name = StrippedCharField(
        max_length=100,
        error_messages={"blank": "El nombre es obligatorio."},
    )
    last_name = StrippedCharField(
        max_length=100,
        error_messages={"blank": "El apellido es obligatorio."},
    )
    dui = StrippedCharField(
        max_length=30,
        error_messages={"blank": "El DUI es obligatorio."},
        validators=[
            UniqueValidator(
                queryset=Patient.objects.all(),
                message="Ya existe un paciente con este DUI.",
            )
        ],
    )
    carnet = StrippedCharField(max_length=30, required=False, allow_blank=True)
    whatsapp_number = StrippedCharField(
        max_length=20,
        required=False,
        allow_blank=True,
    )
    emergency_contact_name = StrippedCharField(
        max_length=150,
        required=False,
        allow_blank=True,
    )
    emergency_contact_phone = StrippedCharField(
        max_length=20,
        required=False,
        allow_blank=True,
    )
    photo = PatientPhotoField(required=False, allow_null=True)
    has_active_assignment = serializers.SerializerMethodField()

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
            "has_active_assignment",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "case_status",
            "has_active_assignment",
            "created_at",
            "updated_at",
        )

    def get_has_active_assignment(self, patient: Patient) -> bool:
        return any(
            assignment.status == Assignment.AssignmentStatus.ACTIVA
            for assignment in patient.assignments.all()
        )


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
            "photo",
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
