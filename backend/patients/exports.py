"""Exportación del directorio de pacientes a CSV (ODO-67).

Solo la ficha básica que ya muestra el directorio: nada clínico, ni foto,
ni contacto de emergencia.
"""

import csv
from collections.abc import Iterable

from django.http import HttpResponse
from django.utils import timezone

from .models import Patient
from .serializers import assigned_student_name

COLUMNS = (
    "Nombre",
    "Apellido",
    "DUI",
    "Teléfono",
    "Área clínica",
    "Tratamiento",
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


def patient_row(patient: Patient) -> list[str]:
    return [
        safe_text(patient.first_name),
        safe_text(patient.last_name),
        patient.dui,
        patient.phone_number,
        patient.clinical_area.name if patient.clinical_area else "",
        patient.clinical_treatment.name if patient.clinical_treatment else "",
        patient.get_case_status_display(),
        assigned_student_name(patient) or "",
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
    for patient in patients:
        writer.writerow(patient_row(patient))
    return response
