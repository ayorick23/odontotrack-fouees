from datetime import timedelta

from django.core.exceptions import ValidationError
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

    def available(self):
        """Pendientes sin asignación activa: los que el estudiante puede elegir."""
        return self.unassigned().by_case_status(Patient.CaseStatus.PENDIENTE)

    def by_case_status(self, case_status: str | None):
        if case_status in Patient.CaseStatus.values:
            return self.filter(case_status=case_status)
        return self

    def by_clinical_area(self, clinical_area: str | None):
        if not clinical_area:
            return self
        return self.filter(clinical_area__slug=clinical_area)

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

    class EmergencyContactRelationship(models.TextChoices):
        MADRE = "madre", "Madre"
        PADRE = "padre", "Padre"
        HERMANO_A = "hermano_a", "Hermano/a"
        CONYUGE = "conyuge", "Cónyuge"
        HIJO_A = "hijo_a", "Hijo/a"
        OTRO = "otro", "Otro"

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    dui = models.CharField(
        max_length=30,
        unique=True,
        help_text="Documento Único de Identidad del paciente.",
    )
    date_of_birth = models.DateField(null=True, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    whatsapp_number = models.CharField(
        max_length=20,
        blank=True,
        default="",
        help_text="Número de WhatsApp, si es distinto al teléfono principal.",
    )
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    photo = models.ImageField(upload_to="patients/photos/", null=True, blank=True)

    emergency_contact_name = models.CharField(max_length=150, blank=True, default="")
    emergency_contact_phone = models.CharField(max_length=20, blank=True, default="")
    emergency_contact_relationship = models.CharField(
        max_length=20,
        choices=EmergencyContactRelationship.choices,
        blank=True,
        default="",
    )

    clinical_area = models.ForeignKey(
        "catalogs.ClinicalArea",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="patients",
    )
    clinical_treatment = models.ForeignKey(
        "catalogs.ClinicalTreatment",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="patients",
        help_text="Tratamiento del catálogo FOUEES según el área clínica.",
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
        return f"{self.first_name} {self.last_name} ({self.dui})"

    def clean(self):
        super().clean()
        if not self.clinical_treatment_id:
            return
        if not self.clinical_area_id:
            raise ValidationError(
                {
                    "clinical_subcategory": (
                        "Selecciona un área clínica antes del tratamiento."
                    )
                }
            )
        if self.clinical_treatment.area_id != self.clinical_area_id:
            raise ValidationError(
                {
                    "clinical_subcategory": (
                        "El tratamiento no corresponde al área clínica seleccionada."
                    )
                }
            )

    def has_active_assignment(self) -> bool:
        return self.assignments.filter(
            status=Assignment.AssignmentStatus.ACTIVA,
        ).exists()
