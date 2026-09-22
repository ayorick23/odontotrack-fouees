from django.conf import settings
from django.db import models


class ClinicalRecord(models.Model):
    """
    Registro clínico de un paciente: diagnóstico, tratamiento propuesto
    y evolución. Cada registro puede ser validado por un docente
    supervisor antes de considerarse parte oficial del expediente.
    """

    patient = models.ForeignKey(
        "patients.Patient",
        on_delete=models.CASCADE,
        related_name="clinical_records",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="authored_clinical_records",
        limit_choices_to={"role": "estudiante"},
        help_text="Estudiante que registró el diagnóstico/tratamiento.",
    )

    diagnosis = models.TextField(help_text="Diagnóstico del paciente.")
    treatment = models.TextField(help_text="Tratamiento propuesto o aplicado.")
    evolution_notes = models.TextField(
        blank=True,
        help_text="Notas de evolución clínica a lo largo del tratamiento.",
    )

    validated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="validated_clinical_records",
        limit_choices_to={"role": "docente"},
        help_text="Docente supervisor que validó este registro.",
    )
    is_validated = models.BooleanField(default=False)
    validated_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Registro de {self.patient} ({self.created_at:%Y-%m-%d})"


class Odontogram(models.Model):
    """
    Odontograma FDI del paciente: un estado actual por caso, no un
    historial de visitas. Los 32 dientes y el snapshot visual viven en
    JSON para no perder superficies al recargar el gráfico SVG.
    """

    patient = models.OneToOneField(
        "patients.Patient",
        on_delete=models.CASCADE,
        related_name="odontogram",
    )
    placa = models.BooleanField(default=False)
    sangrado = models.BooleanField(default=False)
    sarro = models.BooleanField(default=False)
    teeth = models.JSONField(default=list)
    visual_snapshot = models.JSONField(null=True, blank=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_odontograms",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Odontograma de {self.patient}"
