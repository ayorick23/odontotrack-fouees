"""Prácticas indicadas por pieza (columna "pieza + tratamiento" del directorio).

Salen del odontograma: cada pieza marcada "indicada para práctica" con
su área y tratamiento del catálogo. Observación de la demo: el estudiante
busca pacientes por la pieza y el tratamiento que necesita practicar.
"""

from dataclasses import dataclass

from catalogs.models import ClinicalArea, ClinicalTreatment
from clinical_records.models import Odontogram

from .models import Patient


@dataclass(frozen=True)
class CatalogNames:
    areas: dict[str, str]
    treatments: dict[str, str]

    @classmethod
    def load(cls) -> "CatalogNames":
        """Dos consultas para toda la respuesta, no una por fila."""
        return cls(
            areas=dict(ClinicalArea.objects.values_list("slug", "name")),
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
        practice = tooth.get("practice") or {}
        if not practice.get("indicated"):
            continue
        treatment = practice.get("clinicalTreatment")
        area = practice.get("clinicalArea")
        # Piezas guardadas antes de elegir tratamiento: se ve el área.
        name = names.treatments.get(treatment) or names.areas.get(area) or ""
        practices.append(
            {
                "tooth": tooth["fdi"],
                "treatment": treatment,
                "label": f"{tooth['fdi']} · {name}".rstrip(" ·"),
            }
        )
    return sorted(practices, key=lambda item: item["tooth"])
