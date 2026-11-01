"""Prácticas planificadas por pieza (columna "pieza + tratamiento" del
directorio y del CSV).

Salen de las marcas Plan del odontograma que llevan tratamiento del
tarifario. Observación de la demo: el estudiante busca pacientes por la
pieza y el tratamiento que necesita practicar. Al pasar a Hecho la marca
deja de listarse.
"""

from dataclasses import dataclass

from catalogs.models import ClinicalTreatment
from clinical_records.catalog import ToothLayer
from clinical_records.models import Odontogram

from .models import Patient


@dataclass(frozen=True)
class CatalogNames:
    treatments: dict[str, str]

    @classmethod
    def load(cls) -> "CatalogNames":
        """Una consulta para toda la respuesta, no una por fila."""
        return cls(
            treatments=dict(ClinicalTreatment.objects.values_list("slug", "name")),
        )


def indicated_practices(patient: Patient, names: CatalogNames) -> list[dict]:
    """[{"tooth": 18, "treatment": "endodoncia_monorradicular",
    "label": "18 · Endodoncia monorradicular"}, ...] en orden FDI."""
    try:
        teeth = patient.odontogram.teeth or []
    except Odontogram.DoesNotExist:
        return []
    practices = []
    for tooth in teeth:
        for mark in tooth.get("marks") or []:
            treatment = mark.get("treatment")
            if mark.get("layer") != ToothLayer.PLAN or not treatment:
                continue
            name = names.treatments.get(treatment, treatment)
            practices.append(
                {
                    "tooth": tooth["fdi"],
                    "treatment": treatment,
                    "label": f"{tooth['fdi']} · {name}",
                }
            )
    return sorted(practices, key=lambda item: item["tooth"])
