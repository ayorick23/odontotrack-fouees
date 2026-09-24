from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import User
from patients.models import Patient

from .models import Assignment


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

    cleaned_reason = reason.strip()
    if priority not in Assignment.Priority.values:
        raise ValidationError({"priority": "Prioridad no válida."})

    with transaction.atomic():
        try:
            patient = Patient.objects.select_for_update().get(pk=patient_id)
        except Patient.DoesNotExist:
            raise ValidationError({"patient": "Ese paciente ya no está disponible."})
        if (
            patient.case_status != Patient.CaseStatus.PENDIENTE
            or patient.has_active_assignment()
        ):
            raise ValidationError({"patient": "Ese paciente ya no está disponible."})
        return Assignment.objects.create(
            patient=patient,
            student=user,
            reason=cleaned_reason,
            priority=priority,
        )
