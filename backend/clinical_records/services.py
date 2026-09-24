from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import User
from assignments.models import Assignment
from patients.models import Patient

from .catalog import default_tooth_findings, has_clinical_content
from .models import Diagnostico, Odontogram, OdontogramRevision


def user_display_name(user: User | None) -> str | None:
    if user is None:
        return None
    full = user.get_full_name().strip()
    return full or user.username


def queryset_for_patient(queryset, patient_id: str | None):
    if not patient_id:
        return queryset
    try:
        pk = int(patient_id)
    except (TypeError, ValueError):
        return queryset.none()
    if pk < 1:
        return queryset.none()
    return queryset.filter(patient_id=pk)


def scope_clinical_queryset(queryset, user: User):
    """Registros clínicos de los pacientes que `user` puede ver."""
    if user.role != User.Role.ESTUDIANTE:
        return queryset
    return queryset.filter(patient__in=Patient.objects.visible_to(user))


def assert_can_write_clinical(user: User, patient: Patient) -> None:
    """El estudiante solo escribe expediente de sus asignaciones activas."""
    if user.role != User.Role.ESTUDIANTE:
        return
    has_active = patient.assignments.filter(
        student=user,
        status=Assignment.AssignmentStatus.ACTIVA,
    ).exists()
    if not has_active:
        raise PermissionDenied(
            "Solo puedes registrar información clínica de pacientes asignados a ti."
        )


def resolve_clinical_student(*, user: User, patient: Patient) -> User:
    if user.role == User.Role.ESTUDIANTE:
        return user
    assignment = (
        patient.assignments.filter(status=Assignment.AssignmentStatus.ACTIVA)
        .select_related("student")
        .first()
    )
    if assignment is None:
        raise ValidationError(
            {
                "student": (
                    "Asigna un estudiante al paciente antes de registrar la nota."
                )
            }
        )
    return assignment.student


class DiagnosisService:
    @staticmethod
    def validate(diagnosis: Diagnostico, user: User) -> Diagnostico:
        if diagnosis.is_validated:
            raise ValidationError({"detail": "Este diagnóstico ya fue validado."})
        diagnosis.is_validated = True
        diagnosis.validated_by = user
        diagnosis.validated_at = timezone.now()
        diagnosis.save(
            update_fields=["is_validated", "validated_by", "validated_at", "updated_at"]
        )
        return diagnosis

    @staticmethod
    def assert_patient_has_validated_diagnosis(patient: Patient) -> None:
        if not patient.diagnoses.filter(is_validated=True).exists():
            raise ValidationError(
                {
                    "detail": (
                        "El caso no puede finalizar sin un diagnóstico "
                        "validado por un docente."
                    )
                }
            )


class OdontogramService:
    @staticmethod
    def get_or_create(patient: Patient) -> Odontogram:
        odontogram, created = Odontogram.objects.get_or_create(
            patient=patient,
            defaults={"teeth": default_tooth_findings()},
        )
        if created is False and not odontogram.teeth:
            odontogram.teeth = default_tooth_findings()
            odontogram.save(update_fields=["teeth"])
        return odontogram

    @staticmethod
    def assert_can_view(user: User, patient: Patient) -> None:
        if not user.has_acl("odontogram.view"):
            raise PermissionDenied("No puedes ver este odontograma.")
        if not Patient.objects.visible_to(user).filter(pk=patient.pk).exists():
            raise PermissionDenied("No puedes ver este odontograma.")

    @staticmethod
    def assert_can_update(user: User, patient: Patient) -> None:
        if not user.has_acl("odontogram.update"):
            raise PermissionDenied("No puedes actualizar este odontograma.")
        assert_can_write_clinical(user, patient)

    @staticmethod
    def record_revision(odontogram: Odontogram, user: User) -> OdontogramRevision | None:
        if not has_clinical_content(odontogram.teeth):
            return None
        return OdontogramRevision.objects.create(
            odontogram=odontogram,
            teeth=odontogram.teeth,
            placa=odontogram.placa,
            sangrado=odontogram.sangrado,
            sarro=odontogram.sarro,
            visual_snapshot=odontogram.visual_snapshot,
            created_by=user,
        )
