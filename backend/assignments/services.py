from collections.abc import Iterable

from django.db import transaction
from django.db.models import Count, Q, QuerySet
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import User
from clinical_records.services import DiagnosisService
from patients.models import Patient

from .models import Assignment

# Transiciones válidas del estado del caso (Patient.case_status).
# Cualquier cambio de estado tiene que pasar por aquí; el ViewSet no
# decide nada por su cuenta.
CASE_TRANSITIONS = {
    Patient.CaseStatus.PENDIENTE: {Patient.CaseStatus.EN_PROCESO},
    Patient.CaseStatus.EN_PROCESO: {Patient.CaseStatus.FINALIZADO},
    Patient.CaseStatus.FINALIZADO: set(),
}


def can_transition(current: str, target: str) -> bool:
    return target in CASE_TRANSITIONS.get(current, set())


def transition_case_status(patient: Patient, target: str) -> Patient:
    if not can_transition(patient.case_status, target):
        current_label = Patient.CaseStatus(patient.case_status).label
        target_label = Patient.CaseStatus(target).label
        raise ValidationError(
            {
                "case_status": (
                    f"El caso no puede pasar de '{current_label}' "
                    f"a '{target_label}'."
                )
            }
        )
    patient.case_status = target
    patient.save(update_fields=["case_status", "updated_at"])
    return patient


def start_case(assignment: Assignment) -> None:
    """Una asignación activa nueva pone en proceso un caso pendiente."""
    if assignment.status != Assignment.AssignmentStatus.ACTIVA:
        return
    if assignment.patient.case_status == Patient.CaseStatus.PENDIENTE:
        transition_case_status(assignment.patient, Patient.CaseStatus.EN_PROCESO)


@transaction.atomic
def finalize_assignment(assignment: Assignment) -> Assignment:
    if assignment.status != Assignment.AssignmentStatus.ACTIVA:
        raise ValidationError(
            {"status": "Solo se puede finalizar una asignación activa."}
        )
    patient = assignment.patient
    DiagnosisService.assert_patient_has_validated_diagnosis(patient)
    transition_case_status(patient, Patient.CaseStatus.FINALIZADO)
    assignment.status = Assignment.AssignmentStatus.FINALIZADA
    assignment.save(update_fields=["status", "updated_at"])
    return assignment


def assign_patients(
    *,
    patient_ids: Iterable[int],
    student: User,
    only_pending: bool = False,
    **fields,
) -> list[Assignment]:
    """Abre una cita por paciente, todo o nada.

    Bloquea las filas de los pacientes (en orden de id, para que dos
    asignaciones simultáneas no se traben entre sí): si recepción y un
    estudiante asignan al mismo paciente a la vez, solo pasa el primero.
    Un paciente nunca queda con dos asignaciones activas.
    `fields` son los demás campos de Assignment (reason, notes, ...).
    """
    if student.role != User.Role.ESTUDIANTE:
        raise ValidationError({"student": "Solo se puede asignar a un estudiante."})

    ids = set(patient_ids)
    opens_case = (
        fields.get("status", Assignment.AssignmentStatus.ACTIVA)
        == Assignment.AssignmentStatus.ACTIVA
    )
    with transaction.atomic():
        patients = list(
            Patient.objects.select_for_update().filter(pk__in=ids).order_by("pk")
        )
        if len(patients) != len(ids):
            raise ValidationError({"patient": "Paciente no encontrado."})
        for patient in patients:
            name = f"{patient.first_name} {patient.last_name}"
            if only_pending and patient.case_status != Patient.CaseStatus.PENDIENTE:
                raise ValidationError({"patient": f"{name} ya no está disponible."})
            if opens_case and patient.has_active_assignment():
                raise ValidationError(
                    {"patient": f"{name} ya tiene una asignación activa."}
                )
        return [
            Assignment.objects.create(patient=patient, student=student, **fields)
            for patient in patients
        ]


def assign_patient(*, patient_id: int, **kwargs) -> Assignment:
    """Un solo paciente; mismas reglas que assign_patients."""
    return assign_patients(patient_ids=[patient_id], **kwargs)[0]


def claim_available_patients(
    *,
    user: User,
    patient_ids: Iterable[int],
    reason: str,
) -> list[Assignment]:
    """El estudiante toma pendientes sin asignación y abre una cita por cada uno."""
    if user.role != User.Role.ESTUDIANTE:
        raise PermissionDenied("Solo un estudiante puede elegir un paciente disponible.")
    return assign_patients(
        patient_ids=patient_ids,
        student=user,
        only_pending=True,
        reason=reason,
    )


def assignable_students(search: str = "") -> QuerySet[User]:
    """Estudiantes activos para el combo de asignación, con su carga actual.

    Cada palabra de `search` debe aparecer en el nombre, apellido o usuario.
    """
    students = User.objects.filter(
        role=User.Role.ESTUDIANTE,
        is_active=True,
    ).annotate(
        active_cases=Count(
            "patient_assignments",
            filter=Q(patient_assignments__status=Assignment.AssignmentStatus.ACTIVA),
        )
    )
    for term in search.split():
        students = students.filter(
            Q(first_name__icontains=term)
            | Q(last_name__icontains=term)
            | Q(username__icontains=term)
        )
    return students.order_by("last_name", "first_name", "id")
