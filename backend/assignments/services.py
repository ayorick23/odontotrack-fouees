from collections.abc import Iterable

from django.db import transaction
from django.db.models import Count, Q, QuerySet
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import User
from patients.models import Patient

from .models import Assignment

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
    `fields` son los demás campos de Assignment (reason, priority, ...).
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
    priority: str,
) -> list[Assignment]:
    """El estudiante toma pendientes sin asignación y abre una cita por cada uno."""
    if user.role != User.Role.ESTUDIANTE:
        raise PermissionDenied("Solo un estudiante puede elegir un paciente disponible.")
    return assign_patients(
        patient_ids=patient_ids,
        student=user,
        only_pending=True,
        reason=reason,
        priority=priority,
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
