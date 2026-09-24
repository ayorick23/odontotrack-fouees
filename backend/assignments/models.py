from django.conf import settings
from django.db import models


class Assignment(models.Model):
    """
    Relación entre un paciente y el estudiante responsable de su caso.
    Un paciente puede tener varias asignaciones a lo largo del tiempo
    (por ejemplo, si cambia de estudiante), por eso esto es un modelo
    aparte y no un campo directo en Patient.
    """

    class AssignmentStatus(models.TextChoices):
        ACTIVA = "activa", "Activa"
        FINALIZADA = "finalizada", "Finalizada"
        CANCELADA = "cancelada", "Cancelada"

    patient = models.ForeignKey(
        "patients.Patient",
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="patient_assignments",
        limit_choices_to={"role": "estudiante"},
    )
    assigned_date = models.DateField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=AssignmentStatus.choices,
        default=AssignmentStatus.ACTIVA,
    )
    appointment_number = models.PositiveIntegerField(
        editable=False,
        help_text="Número de cita del paciente, correlativo por paciente.",
    )
    # Nota opcional al asignar. El motivo de consulta lo registra el
    # estudiante en el diagnóstico cuando atiende al paciente.
    reason = models.TextField(blank=True, help_text="Motivo o nota al asignar.")
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-assigned_date"]

    def __str__(self):
        return f"{self.patient} -> {self.student} ({self.status})"

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        if is_new and not self.appointment_number:
            self.appointment_number = (
                Assignment.objects.filter(patient_id=self.patient_id).count() + 1
            )
        super().save(*args, **kwargs)
        if is_new and self.status == self.AssignmentStatus.ACTIVA:
            from patients.models import Patient

            if self.patient.case_status == Patient.CaseStatus.PENDIENTE:
                self.patient.case_status = Patient.CaseStatus.EN_PROCESO
                self.patient.save(update_fields=["case_status"])
