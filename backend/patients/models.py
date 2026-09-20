from datetime import timedelta

from django.db import models
from django.utils import timezone

from assignments.models import Assignment

PERIOD_DAYS = {
    "1m": 30,
    "6m": 182,
    "1a": 365,
}


class PatientQuerySet(models.QuerySet):
    def in_period(self, period: str | None):
        days = PERIOD_DAYS.get(period or "")
        if days is None:
            return self
        return self.filter(created_at__gte=timezone.now() - timedelta(days=days))

    def unassigned(self):
        return self.exclude(assignments__status=Assignment.AssignmentStatus.ACTIVA)

    def by_case_status(self, case_status: str | None):
        if case_status in Patient.CaseStatus.values:
            return self.filter(case_status=case_status)
        return self

    def by_clinical_area(self, clinical_area: str | None):
        if clinical_area in Patient.ClinicalArea.values:
            return self.filter(clinical_area=clinical_area)
        return self

    def by_assignee(self, assigned_to: str | None):
        if assigned_to == "unassigned":
            return self.unassigned()
        try:
            student_id = int(assigned_to or "")
        except ValueError:
            return self
        if student_id < 1:
            return self
        return self.filter(
            assignments__status=Assignment.AssignmentStatus.ACTIVA,
            assignments__student_id=student_id,
        ).distinct()


class Patient(models.Model):
    """
    Paciente registrado en el banco digital de pacientes de la Facultad
    de Odontología. Este modelo guarda solo los datos personales y el
    estado general del caso; el detalle clínico vive en clinical_records.
    """

    class CaseStatus(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        EN_PROCESO = "en_proceso", "En proceso"
        FINALIZADO = "finalizado", "Finalizado"

    class ClinicalArea(models.TextChoices):
        OPERATORIA = "operatoria", "Operatoria"
        ENDODONCIA = "endodoncia", "Endodoncia"
        PERIODONCIA = "periodoncia", "Periodoncia"
        CIRUGIA = "cirugia", "Cirugía"
        PROTESIS = "protesis", "Prótesis"
        ODONTOPEDIATRIA = "odontopediatria", "Odontopediatría"
        ORTODONCIA = "ortodoncia", "Ortodoncia"

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    document_id = models.CharField(
        max_length=30,
        unique=True,
        help_text="Número de documento único de identificación (DUI, pasaporte, etc.)",
    )
    date_of_birth = models.DateField(null=True, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=255, blank=True)

    clinical_area = models.CharField(
        max_length=20,
        choices=ClinicalArea.choices,
        blank=True,
    )
    case_status = models.CharField(
        max_length=20,
        choices=CaseStatus.choices,
        default=CaseStatus.PENDIENTE,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = PatientQuerySet.as_manager()

    class Meta:
        ordering = ["last_name", "first_name"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.document_id})"

    def has_active_assignment(self) -> bool:
        return self.assignments.filter(
            status=Assignment.AssignmentStatus.ACTIVA,
        ).exists()
