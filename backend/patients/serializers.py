from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from assignments.models import Assignment
from catalogs.models import ClinicalArea, ClinicalTreatment

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


class OptionalSlugRelatedField(serializers.SlugRelatedField):
    def to_internal_value(self, data):
        if data in ("", None):
            return None
        return super().to_internal_value(data)

    def to_representation(self, obj):
        if obj is None:
            return ""
        return super().to_representation(obj)


def empty_catalog_slugs(data: dict) -> dict:
    if data.get("clinical_area") is None:
        data["clinical_area"] = ""
    if data.get("clinical_subcategory") is None:
        data["clinical_subcategory"] = ""
    return data


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
    clinical_area = OptionalSlugRelatedField(
        slug_field="slug",
        queryset=ClinicalArea.objects.all(),
        allow_null=True,
        required=False,
    )
    clinical_subcategory = OptionalSlugRelatedField(
        slug_field="slug",
        queryset=ClinicalTreatment.objects.all(),
        source="clinical_treatment",
        allow_null=True,
        required=False,
    )

    class Meta:
        model = Patient
        fields = (
            "id",
            "first_name",
            "last_name",
            "dui",
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
            "clinical_subcategory",
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

    def validate(self, attrs):
        attrs = super().validate(attrs)
        area = (
            attrs["clinical_area"]
            if "clinical_area" in attrs
            else (self.instance.clinical_area if self.instance else None)
        )
        treatment_provided = "clinical_treatment" in attrs
        treatment = (
            attrs["clinical_treatment"]
            if treatment_provided
            else (self.instance.clinical_treatment if self.instance else None)
        )
        if not treatment:
            return attrs
        if not area:
            raise serializers.ValidationError(
                {
                    "clinical_subcategory": (
                        "Selecciona un área clínica antes del tratamiento."
                    )
                }
            )
        if treatment.area_id == area.id:
            return attrs
        if treatment_provided:
            raise serializers.ValidationError(
                {
                    "clinical_subcategory": (
                        "El tratamiento no corresponde al área clínica seleccionada."
                    )
                }
            )
        attrs["clinical_treatment"] = None
        return attrs

    def to_representation(self, instance):
        return empty_catalog_slugs(super().to_representation(instance))


class PatientListSerializer(serializers.ModelSerializer):
    assigned_to = serializers.SerializerMethodField()
    clinical_area = OptionalSlugRelatedField(
        slug_field="slug",
        read_only=True,
    )
    clinical_subcategory = OptionalSlugRelatedField(
        slug_field="slug",
        source="clinical_treatment",
        read_only=True,
    )

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
            "clinical_subcategory",
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

    def to_representation(self, instance):
        return empty_catalog_slugs(super().to_representation(instance))
