"""Búsqueda del directorio: nombre, documento, teléfono y prácticas indicadas."""

from functools import reduce
from operator import or_

from django.db.models import Q
from rest_framework.filters import SearchFilter

from catalogs.models import ClinicalTreatment
from clinical_records.catalog import is_fdi_tooth
from clinical_records.queries import planned_practice_q

NAME_FIELDS = ("first_name__unaccent", "last_name__unaccent")
# Solo con 4 o más caracteres: "18" no debe traer a cualquiera cuyo DUI
# o teléfono contenga 18; con números cortos se busca la pieza.
CONTACT_FIELDS = ("dui", "guardian_dui", "phone_number")
MIN_CONTACT_TERM = 4


def tooth_in_term(term: str) -> int | None:
    """El término como número de pieza FDI ("18"), si lo es."""
    if term.isdigit() and is_fdi_tooth(int(term)):
        return int(term)
    return None


def treatments_matching(term: str) -> list[str]:
    """Slugs de los tratamientos cuyo nombre o área contiene `term`
    ("endo", "monorra"), sin acentos."""
    return list(
        ClinicalTreatment.objects.filter(
            Q(name__unaccent__icontains=term) | Q(area__name__unaccent__icontains=term)
        ).values_list("slug", flat=True)
    )


def practice_q(term: str) -> Q:
    """Pacientes con una práctica planificada que coincide con `term`: el
    número de pieza o un tratamiento (ver `treatments_matching`)."""
    conditions = [planned_practice_q(treatments=treatments_matching(term))]
    tooth = tooth_in_term(term)
    if tooth is not None:
        conditions.append(planned_practice_q(tooth=tooth))
    return reduce(or_, conditions)


class PatientSearchFilter(SearchFilter):
    """Cada palabra debe coincidir con algo; las palabras se suman (AND),
    igual que el SearchFilter de DRF."""

    def filter_queryset(self, request, queryset, view):
        for term in self.get_search_terms(request):
            fields = NAME_FIELDS
            if len(term) >= MIN_CONTACT_TERM:
                fields += CONTACT_FIELDS
            matches = [Q(**{f"{field}__icontains": term}) for field in fields]
            queryset = queryset.filter(reduce(or_, matches) | practice_q(term))
        return queryset
