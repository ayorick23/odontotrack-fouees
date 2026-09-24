from django.db import transaction
from rest_framework.exceptions import ValidationError

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
