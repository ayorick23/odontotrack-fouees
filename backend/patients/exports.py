"""Exportación del directorio de pacientes a CSV (ODO-67).

Solo la ficha básica que ya muestra el directorio: nada clínico, ni foto,
ni contacto de emergencia.
"""

import csv
from collections.abc import Iterable

from django.http import HttpResponse
from django.utils import timezone

from .models import Patient
from .practices import CatalogNames, indicated_practices
from .serializers import latest_assignment, student_name

COLUMNS = (
    "Nombre",
    "Apellido",
    "Documento",
    "Teléfono",
    "Área clínica",
    "Tratamiento",
    "Prácticas indicadas",
    "Estado del caso",
    "Estudiante asignado",
    "Fecha de registro",
)


FORMULA_PREFIXES = ("=", "+", "-", "@")


def safe_text(value: str) -> str:
    """Evita que Excel interprete como fórmula un texto escrito a mano."""
    if value.startswith(FORMULA_PREFIXES):
        return f"'{value}"
    return value


def document_label(patient: Patient) -> str:
    if patient.document_type == Patient.DocumentType.MENOR:
        return f"Menor (resp. {patient.guardian_dui})"
    if patient.document_type == Patient.DocumentType.PASAPORTE:
        return f"Pasaporte {patient.dui}"
    return patient.dui or ""


def patient_row(patient: Patient, names: CatalogNames) -> list[str]:
    return [
        safe_text(patient.first_name),
        safe_text(patient.last_name),
        document_label(patient),
        # Empieza con "+": Excel lo tomaría como fórmula.
        safe_text(patient.phone_number),
        patient.clinical_area.name if patient.clinical_area else "",
        patient.clinical_treatment.name if patient.clinical_treatment else "",
        "; ".join(item["label"] for item in indicated_practices(patient, names)),
        patient.get_case_status_display(),
        student_name(latest_assignment(patient)) or "",
        timezone.localtime(patient.created_at).strftime("%Y-%m-%d"),
    ]


def patients_csv_response(patients: Iterable[Patient]) -> HttpResponse:
    """CSV en UTF-8 con BOM para que Excel abra bien tildes y eñes."""
    filename = f"pacientes-{timezone.localdate():%Y-%m-%d}.csv"
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    response.write("﻿")
    writer = csv.writer(response)
    writer.writerow(COLUMNS)
    names = CatalogNames.load()
    for patient in patients:
        writer.writerow(patient_row(patient, names))
    return response
