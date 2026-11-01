"""Consultas sobre las marcas Plan del odontograma.

Una marca Plan con tratamiento del tarifario es una práctica que el
paciente necesita: es lo que el banco de pacientes lista y filtra. Al
pasar a Hecho deja de contar.

Las marcas viven anidadas en `teeth[].marks[]`. La contención JSON
(`@>`) no puede expresar "tiene un tratamiento, el que sea" ni "uno de
estos tratamientos", así que se usa `jsonb_path_exists` de Postgres.
"""

import json
from collections.abc import Iterable

from django.db.models import BooleanField, F, Func, Q, TextField, Value

from .models import Odontogram


class _CastTo(Func):
    def __init__(self, expression, pg_type: str):
        super().__init__(
            expression,
            template=f"(%(expressions)s)::{pg_type}",
            output_field=TextField(),
        )


class JsonbPathExists(Func):
    function = "jsonb_path_exists"
    output_field = BooleanField()


def planned_practice_q(
    *,
    tooth: int | None = None,
    treatments: Iterable[str] | None = None,
) -> Q:
    """Q de Patient: tiene una marca Plan con tratamiento.

    `tooth` exige que sea en esa pieza; `treatments`, que sea uno de esos
    slugs (lista vacía: ninguno). Pieza y tratamiento deben coincidir en
    la misma marca de la misma pieza.
    """
    conditions = ['@.layer == "plan"']
    variables: dict = {}
    if treatments is None:
        conditions.append('@.treatment.type() == "string"')
    else:
        slugs = sorted(set(treatments))
        if not slugs:
            return Q(pk__in=[])
        # Comparar contra una secuencia es existencial: basta uno igual.
        conditions.append("@.treatment == $treatments[*]")
        variables["treatments"] = slugs
    tooth_condition = ""
    if tooth is not None:
        tooth_condition = " && @.fdi == $fdi"
        variables["fdi"] = tooth
    path = (
        f"$[*] ? (exists(@.marks[*] ? ({' && '.join(conditions)}))"
        f"{tooth_condition})"
    )
    odontograms = (
        Odontogram.objects.alias(
            planned=JsonbPathExists(
                F("teeth"),
                _CastTo(Value(path), "jsonpath"),
                _CastTo(Value(json.dumps(variables)), "jsonb"),
            )
        )
        .filter(planned=True)
        .values("patient_id")
    )
    return Q(pk__in=odontograms)
