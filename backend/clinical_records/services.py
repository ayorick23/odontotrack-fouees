from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import User
from assignments.models import Assignment
from patients.models import Patient

from .catalog import default_tooth_findings, has_clinical_content
from .models import Odontogram, OdontogramRevision


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
    def assert_can_view(user: User, _patient: Patient) -> None:
        if not user.has_acl("odontogram.view"):
            raise PermissionDenied("No puedes ver este odontograma.")

    @staticmethod
    def assert_can_update(user: User, _patient: Patient) -> None:
        if not user.has_acl("odontogram.update"):
            raise PermissionDenied("No puedes actualizar este odontograma.")

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
