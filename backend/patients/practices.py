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

from .filters import tooth_in_term, treatments_matching
from .models import Patient, parse_fdi


@dataclass(frozen=True)
class CatalogNames:
    treatments: dict[str, str]

    @classmethod
    def load(cls) -> "CatalogNames":
        """Una consulta para toda la respuesta, no una por fila."""
        return cls(
            treatments=dict(ClinicalTreatment.objects.values_list("slug", "name")),
        )


@dataclass(frozen=True)
class PracticeMatch:
    """Qué prácticas coinciden con la búsqueda o los filtros del directorio.

    El directorio muestra pocas etiquetas por fila: las que coinciden van
    primero y resaltadas, para que lo buscado no quede escondido en "+N".
    Usa las mismas reglas que la búsqueda (`patients.filters`).
    """

    # Búsqueda libre: cualquier palabra que coincida basta.
    teeth: frozenset[int] = frozenset()
    treatments: frozenset[str] = frozenset()
    # Filtro ?tooth=&treatment=: con los dos, en la misma pieza.
    tooth: int | None = None
    treatment: str | None = None
    # Filtro ?clinical_area=: tratamientos del área.
    area_treatments: frozenset[str] = frozenset()

    @classmethod
    def from_request(cls, params, search_terms: list[str]) -> "PracticeMatch":
        teeth = {tooth_in_term(term) for term in search_terms} - {None}
        treatments = {slug for term in search_terms for slug in treatments_matching(term)}
        area = params.get("clinical_area")
        area_treatments = (
            ClinicalTreatment.objects.filter(area__slug=area).values_list("slug", flat=True)
            if area
            else []
        )
        return cls(
            teeth=frozenset(teeth),
            treatments=frozenset(treatments),
            tooth=parse_fdi(params.get("tooth")),
            treatment=params.get("treatment") or None,
            area_treatments=frozenset(area_treatments),
        )

    def __call__(self, tooth: int, treatment: str) -> bool:
        if tooth in self.teeth or treatment in self.treatments:
            return True
        if treatment in self.area_treatments:
            return True
        if self.tooth is None and self.treatment is None:
            return False
        return (self.tooth is None or tooth == self.tooth) and (
            self.treatment is None or treatment == self.treatment
        )


NO_MATCH = PracticeMatch()


def indicated_practices(
    patient: Patient, names: CatalogNames, match: PracticeMatch = NO_MATCH
) -> list[dict]:
    """[{"tooth": 18, "treatment": "endodoncia_monorradicular",
    "label": "18 · Endodoncia monorradicular", "matched": False}, ...]

    En orden FDI, con las que coinciden con `match` primero."""
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
                    "matched": match(tooth["fdi"], treatment),
                }
            )
    return sorted(practices, key=lambda item: (not item["matched"], item["tooth"]))
