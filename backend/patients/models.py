from django.db import models


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

    case_status = models.CharField(
        max_length=20,
        choices=CaseStatus.choices,
        default=CaseStatus.PENDIENTE,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["last_name", "first_name"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.document_id})"
