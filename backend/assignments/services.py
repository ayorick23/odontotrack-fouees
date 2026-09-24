from django.db import transaction
from django.db.models import Count, Q, QuerySet
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import User
from patients.models import Patient

from .models import Assignment

UNAVAILABLE_MESSAGE = "Ese paciente ya no está disponible."


def assign_patient(
    *,
    patient_id: int,
    student: User,
    only_pending: bool = False,
    **fields,
) -> Assignment:
    """Abre una cita sin dejar al paciente con dos asignaciones activas.

    Bloquea la fila del paciente: si recepción y un estudiante (o dos
    estudiantes) asignan al mismo tiempo, solo pasa el primero.
    `fields` son los demás campos de Assignment (reason, priority, ...).
    """
    if student.role != User.Role.ESTUDIANTE:
        raise ValidationError({"student": "Solo se puede asignar a un estudiante."})

    opens_case = (
        fields.get("status", Assignment.AssignmentStatus.ACTIVA)
        == Assignment.AssignmentStatus.ACTIVA
    )
    with transaction.atomic():
        try:
            patient = Patient.objects.select_for_update().get(pk=patient_id)
        except Patient.DoesNotExist:
            raise ValidationError({"patient": UNAVAILABLE_MESSAGE})
        if only_pending and patient.case_status != Patient.CaseStatus.PENDIENTE:
            raise ValidationError({"patient": UNAVAILABLE_MESSAGE})
        if opens_case and patient.has_active_assignment():
            raise ValidationError(
                {"patient": "Ese paciente ya tiene una asignación activa."}
            )
        return Assignment.objects.create(patient=patient, student=student, **fields)


def claim_available_patient(
    *,
    user: User,
    patient_id: int,
    reason: str,
    priority: str,
) -> Assignment:
    """El estudiante toma un pendiente sin asignación y abre la cita."""
    if user.role != User.Role.ESTUDIANTE:
        raise PermissionDenied("Solo un estudiante puede elegir un paciente disponible.")
    return assign_patient(
        patient_id=patient_id,
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
