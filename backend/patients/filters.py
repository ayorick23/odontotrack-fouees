"""Búsqueda del directorio: nombre, documento, teléfono y prácticas indicadas."""

from functools import reduce
from operator import or_

from django.db.models import Q
from rest_framework.filters import SearchFilter

from catalogs.models import ClinicalArea, ClinicalTreatment
from clinical_records.catalog import is_fdi_tooth

NAME_FIELDS = ("first_name__unaccent", "last_name__unaccent")
# Solo con 4 o más caracteres: "18" no debe traer a cualquiera cuyo DUI
# o teléfono contenga 18; con números cortos se busca la pieza.
CONTACT_FIELDS = ("dui", "guardian_dui", "phone_number")
MIN_CONTACT_TERM = 4


def _indicated(**practice) -> Q:
    return Q(odontogram__teeth__contains=[{"practice": {"indicated": True, **practice}}])


def practice_q(term: str) -> Q:
    """Pacientes con una pieza indicada que coincide con `term`: el número
    de pieza ("18") o parte del nombre del tratamiento o del área
    ("endo", "monorra"), sin acentos."""
    conditions = []
    if term.isdigit() and is_fdi_tooth(int(term)):
        conditions.append(
            Q(odontogram__teeth__contains=[{"fdi": int(term), "practice": {"indicated": True}}])
        )
    treatments = ClinicalTreatment.objects.filter(name__unaccent__icontains=term)
    conditions += [_indicated(clinicalTreatment=slug) for slug in treatments.values_list("slug", flat=True)]
    areas = ClinicalArea.objects.filter(name__unaccent__icontains=term)
    conditions += [_indicated(clinicalArea=slug) for slug in areas.values_list("slug", flat=True)]
    return reduce(or_, conditions, Q(pk__in=[]))


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
