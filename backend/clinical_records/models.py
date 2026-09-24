from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Diagnostico(models.Model):
    """
    Diagnóstico de un paciente. Un docente supervisor puede validarlo
    antes de que se considere parte oficial del expediente; el caso no
    puede finalizar sin al menos un diagnóstico validado (ver
    DiagnosisService en services.py).
    """

    patient = models.ForeignKey(
        "patients.Patient",
        on_delete=models.CASCADE,
        related_name="diagnoses",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="authored_diagnoses",
        limit_choices_to={"role": "estudiante"},
        help_text="Estudiante que registró el diagnóstico.",
    )
    content = models.TextField(help_text="Diagnóstico del paciente.")

    validated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="validated_diagnoses",
        limit_choices_to={"role": "docente"},
        help_text="Docente supervisor que validó este diagnóstico.",
    )
    is_validated = models.BooleanField(default=False)
    validated_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Diagnóstico de {self.patient} ({self.created_at:%Y-%m-%d})"


class Tratamiento(models.Model):
    """Tratamiento aplicado o propuesto para un paciente."""

    patient = models.ForeignKey(
        "patients.Patient",
        on_delete=models.CASCADE,
        related_name="treatments",
    )
    clinical_area = models.ForeignKey(
        "catalogs.ClinicalArea",
        on_delete=models.PROTECT,
        related_name="clinical_records_treatments",
    )
    clinical_treatment = models.ForeignKey(
        "catalogs.ClinicalTreatment",
        on_delete=models.PROTECT,
        related_name="clinical_records_treatments",
        help_text="Tipo de tratamiento del catálogo FOUEES.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Tratamiento de {self.patient} ({self.clinical_treatment})"

    def clean(self):
        super().clean()
        if self.clinical_treatment_id and self.clinical_area_id:
            if self.clinical_treatment.area_id != self.clinical_area_id:
                raise ValidationError(
                    {
                        "clinical_treatment": (
                            "El tratamiento no corresponde al área clínica seleccionada."
                        )
                    }
                )


class EvolucionClinica(models.Model):
    """Nota de evolución clínica de un paciente a lo largo del caso."""

    patient = models.ForeignKey(
        "patients.Patient",
        on_delete=models.CASCADE,
        related_name="clinical_evolutions",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="authored_clinical_evolutions",
        limit_choices_to={"role": "estudiante"},
        help_text="Estudiante que registró la nota de evolución.",
    )
    date = models.DateField()
    note = models.TextField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"Evolución de {self.patient} ({self.date})"


class Odontogram(models.Model):
    """
    Odontograma FDI del paciente (permanente o mixto). El estado actual
    vive aquí; cada guardado con contenido clínico deja un revision en
    OdontogramRevision.
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


class OdontogramRevision(models.Model):
    """Snapshot consultable de un odontograma en un momento dado."""

    odontogram = models.ForeignKey(
        Odontogram,
        on_delete=models.CASCADE,
        related_name="revisions",
    )
    teeth = models.JSONField(default=list)
    placa = models.BooleanField(default=False)
    sangrado = models.BooleanField(default=False)
    sarro = models.BooleanField(default=False)
    visual_snapshot = models.JSONField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="odontogram_revisions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Revisión de {self.odontogram} ({self.created_at:%Y-%m-%d %H:%M})"
