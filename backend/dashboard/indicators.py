from django.db.models import Q, QuerySet

from patients.models import Patient

from .scoping import DashboardScope


def _ratio(count: int, total: int) -> dict:
    """Porcentaje con su numerador y denominador; None si no hay base."""
    percent = round(count * 100 / total, 1) if total else None
    return {"percent": percent, "count": count, "total": total}


def _digitized_patients(scope: DashboardScope) -> QuerySet:
    """Pacientes con al menos un registro clínico digital."""
    saved_odontograms = scope.odontograms.filter(updated_by__isnull=False)
    return scope.patients.filter(
        Q(id__in=scope.diagnoses.values("patient_id"))
        | Q(id__in=scope.treatments.values("patient_id"))
        | Q(id__in=scope.evolutions.values("patient_id"))
        | Q(id__in=saved_odontograms.values("patient_id"))
    )


def build_indicators(scope: DashboardScope) -> dict:
    """
    Indicadores del banco de pacientes (ODO-37), dentro del alcance del
    usuario (ver scoping.py). Cada uno trae `percent` (0-100, un decimal,
    None si el denominador es 0), `count` y `total`.

    - digitalization: pacientes con expediente digital / pacientes.
      "Con expediente" = al menos un diagnóstico, tratamiento, evolución u
      odontograma guardado. El odontograma solo cuenta si alguien lo guardó
      (updated_by): abrir la pestaña ya lo crea vacío.
    - validated_diagnoses: diagnósticos validados / diagnósticos.
    - cases_with_validated_diagnosis: casos en proceso o finalizados con al
      menos un diagnóstico validado / casos en proceso o finalizados. Es la
      condición para poder finalizar un caso (ODO-31).

    Quien no ve el expediente (sin clinical_records.view) recibe los tres
    en None: no es que valgan 0, es que no aplican para él.
    """
    if not scope.clinical:
        return {
            "digitalization": None,
            "validated_diagnoses": None,
            "cases_with_validated_diagnosis": None,
        }

    cases = scope.patients.filter(
        case_status__in=[
            Patient.CaseStatus.EN_PROCESO,
            Patient.CaseStatus.FINALIZADO,
        ]
    )
    validated = scope.diagnoses.filter(is_validated=True)
    return {
        "digitalization": _ratio(
            _digitized_patients(scope).count(), scope.patients.count()
        ),
        "validated_diagnoses": _ratio(validated.count(), scope.diagnoses.count()),
        "cases_with_validated_diagnosis": _ratio(
            cases.filter(id__in=validated.values("patient_id")).count(),
            cases.count(),
        ),
    }
