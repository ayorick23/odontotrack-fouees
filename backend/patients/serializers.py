import re

from rest_framework import serializers

from accounts.models import User
from assignments.models import Assignment
from catalogs.models import ClinicalArea, ClinicalTreatment

from .models import Patient
from .phones import normalize_phone

MAX_PHOTO_BYTES = 2 * 1024 * 1024
ALLOWED_PHOTO_CONTENT_TYPES = frozenset(
    {"image/jpeg", "image/jpg", "image/png", "image/webp"}
)

DUI_PATTERN = re.compile(r"^(\d{8})-?(\d)$")
PASSPORT_PATTERN = re.compile(r"^[A-Z0-9]{5,20}$")
DUI_FORMAT_ERROR = "El DUI debe tener el formato 00000000-0 (solo números)."

# Observación de la demo: no guardar sin contacto ni contacto de
# emergencia. WhatsApp y correo quedan opcionales (no todos los
# pacientes tienen).
REQUIRED_CONTACT_FIELDS = {
    "phone_number": "El teléfono es obligatorio.",
    "address": "La dirección es obligatoria.",
    "emergency_contact_name": "El nombre del contacto de emergencia es obligatorio.",
    "emergency_contact_phone": "El teléfono del contacto de emergencia es obligatorio.",
    "emergency_contact_relationship": "El parentesco del contacto de emergencia es obligatorio.",
}


def normalize_dui(value: str) -> str | None:
    """00000000-0 o 9 dígitos seguidos → 00000000-0; None si no es un DUI."""
    match = DUI_PATTERN.match(value.strip())
    if match is None:
        return None
    return f"{match.group(1)}-{match.group(2)}"


class StrippedCharField(serializers.CharField):
    def to_internal_value(self, data):
        if isinstance(data, str):
            data = data.strip()
        return super().to_internal_value(data)


class PhoneField(StrippedCharField):
    """Teléfono con código de país, guardado como '+503 7000-1111'.

    Vacío se acepta aquí; si el campo es obligatorio lo dice
    REQUIRED_CONTACT_FIELDS.
    """

    def __init__(self, **kwargs):
        kwargs.setdefault("max_length", 20)
        kwargs.setdefault("required", False)
        kwargs.setdefault("allow_blank", True)
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        if not value:
            return value
        normalized = normalize_phone(value)
        if normalized is None:
            raise serializers.ValidationError(
                "Teléfono no válido: usa solo números y la cantidad de "
                "dígitos del país."
            )
        return normalized


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


def active_assignment(patient: Patient) -> Assignment | None:
    # Recorre el prefetch de assignments en vez de otra consulta.
    return next(
        (
            assignment
            for assignment in patient.assignments.all()
            if assignment.status == Assignment.AssignmentStatus.ACTIVA
        ),
        None,
    )


def latest_assignment(patient: Patient) -> Assignment | None:
    # La activa o, si el caso ya se cerró, la última finalizada; así la
    # ficha conserva quién atendió el caso. Las canceladas no cuentan:
    # ese estudiante dejó el caso sin atenderlo.
    assignment = active_assignment(patient)
    if assignment is not None:
        return assignment
    finished = [
        assignment
        for assignment in patient.assignments.all()
        if assignment.status == Assignment.AssignmentStatus.FINALIZADA
    ]
    return max(finished, key=lambda a: a.created_at, default=None)


def student_name(assignment: Assignment | None) -> str | None:
    if assignment is None:
        return None
    student = assignment.student
    return student.get_full_name() or student.username


def user_name(user: User | None) -> str | None:
    if user is None:
        return None
    return user.get_full_name() or user.username


def assigned_student_name(patient: Patient) -> str | None:
    return student_name(active_assignment(patient))


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
    # Sin UniqueValidator: con dui=None (menores) buscaría IS NULL y
    # chocaría con cualquier otro menor. La unicidad va en validate.
    dui = StrippedCharField(
        max_length=30,
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    guardian_dui = StrippedCharField(
        max_length=10,
        required=False,
        allow_blank=True,
    )
    phone_number = PhoneField()
    whatsapp_number = PhoneField()
    emergency_contact_name = StrippedCharField(
        max_length=150,
        required=False,
        allow_blank=True,
    )
    emergency_contact_phone = PhoneField()
    photo = PatientPhotoField(required=False, allow_null=True)
    has_active_assignment = serializers.SerializerMethodField()
    # Para finalizar el caso desde la ficha (/assignments/{id}/finalize/).
    active_assignment_id = serializers.SerializerMethodField()
    assigned_to = serializers.SerializerMethodField()
    assignment_note = serializers.SerializerMethodField()
    # Si la ficha muestra los formularios clínicos; misma regla que
    # assert_can_write_clinical + assert_case_open en clinical_records.
    can_write_clinical = serializers.SerializerMethodField()
    # Puede registrar diagnóstico y odontograma: lo anterior o, para el
    # estudiante, un paciente disponible que está evaluando antes de tomarlo.
    can_evaluate = serializers.SerializerMethodField()
    # Responsabilidad (observación de la demo): quién registró al paciente
    # y quién hizo el primer diagnóstico.
    created_by_name = serializers.SerializerMethodField()
    first_diagnosis_by = serializers.SerializerMethodField()
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
            "document_type",
            "dui",
            "guardian_dui",
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
            "active_assignment_id",
            "assigned_to",
            "assignment_note",
            "can_write_clinical",
            "can_evaluate",
            "created_by_name",
            "first_diagnosis_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "case_status",
            "has_active_assignment",
            "active_assignment_id",
            "assigned_to",
            "assignment_note",
            "can_write_clinical",
            "can_evaluate",
            "created_at",
            "updated_at",
        )

    def get_has_active_assignment(self, patient: Patient) -> bool:
        return any(
            assignment.status == Assignment.AssignmentStatus.ACTIVA
            for assignment in patient.assignments.all()
        )

    def get_assigned_to(self, patient: Patient) -> str | None:
        return student_name(latest_assignment(patient))

    def get_assignment_note(self, patient: Patient) -> str:
        assignment = latest_assignment(patient)
        return assignment.reason if assignment else ""

    def get_active_assignment_id(self, patient: Patient) -> int | None:
        assignment = active_assignment(patient)
        return assignment.pk if assignment else None

    def get_created_by_name(self, patient: Patient) -> str | None:
        return user_name(patient.created_by)

    def get_first_diagnosis_by(self, patient: Patient) -> str | None:
        # Recorre el prefetch de diagnoses en vez de otra consulta.
        first = min(
            patient.diagnoses.all(),
            key=lambda diagnosis: diagnosis.created_at,
            default=None,
        )
        return user_name(first.student) if first else None

    def get_can_evaluate(self, patient: Patient) -> bool:
        if self.get_can_write_clinical(patient):
            return True
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return (
            user is not None
            and user.role == User.Role.ESTUDIANTE
            and patient.case_status == Patient.CaseStatus.PENDIENTE
            and active_assignment(patient) is None
        )

    def get_can_write_clinical(self, patient: Patient) -> bool:
        assignment = active_assignment(patient)
        if assignment is None:
            return False
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or user.role != User.Role.ESTUDIANTE:
            return True
        return assignment.student_id == user.id

    def _current(self, attrs: dict, field: str):
        """Valor que quedará guardado: el que llega o el de la instancia."""
        if field in attrs:
            return attrs[field]
        return getattr(self.instance, field, None) if self.instance else None

    def _check_document(self, attrs: dict) -> None:
        document_type = self._current(attrs, "document_type") or Patient.DocumentType.DUI
        number = (self._current(attrs, "dui") or "").strip()
        guardian = (self._current(attrs, "guardian_dui") or "").strip()

        if document_type == Patient.DocumentType.MENOR:
            normalized_guardian = normalize_dui(guardian)
            if not guardian:
                raise serializers.ValidationError(
                    {"guardian_dui": "El DUI del responsable es obligatorio."}
                )
            if normalized_guardian is None:
                raise serializers.ValidationError({"guardian_dui": DUI_FORMAT_ERROR})
            attrs["dui"] = None
            attrs["guardian_dui"] = normalized_guardian
            return

        attrs["guardian_dui"] = ""
        if not number:
            raise serializers.ValidationError(
                {"dui": "El número de documento es obligatorio."}
            )
        if document_type == Patient.DocumentType.DUI:
            normalized = normalize_dui(number)
            if normalized is None:
                raise serializers.ValidationError({"dui": DUI_FORMAT_ERROR})
        else:
            normalized = number.upper()
            if not PASSPORT_PATTERN.match(normalized):
                raise serializers.ValidationError(
                    {"dui": "El pasaporte debe tener de 5 a 20 letras o números."}
                )
        duplicates = Patient.objects.filter(dui=normalized)
        if self.instance is not None:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError(
                {"dui": "Ya existe un paciente con este documento."}
            )
        attrs["dui"] = normalized

    def _check_contacts(self, attrs: dict) -> None:
        errors = {
            field: message
            for field, message in REQUIRED_CONTACT_FIELDS.items()
            if not (self._current(attrs, field) or "").strip()
        }
        if errors:
            raise serializers.ValidationError(errors)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        self._check_document(attrs)
        self._check_contacts(attrs)
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
            "document_type",
            "dui",
            "guardian_dui",
            "phone_number",
            "photo",
            "clinical_area",
            "clinical_subcategory",
            "case_status",
            "created_at",
            "assigned_to",
        )

    def get_assigned_to(self, patient: Patient) -> str | None:
        return assigned_student_name(patient)

    def to_representation(self, instance):
        return empty_catalog_slugs(super().to_representation(instance))
