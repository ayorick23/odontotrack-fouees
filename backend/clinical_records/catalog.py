from django.db import models

FDI_TOOTH_NUMBERS: tuple[int, ...] = (
    18, 17, 16, 15, 14, 13, 12, 11,
    21, 22, 23, 24, 25, 26, 27, 28,
    48, 47, 46, 45, 44, 43, 42, 41,
    31, 32, 33, 34, 35, 36, 37, 38,
)

FDI_PRIMARY_TOOTH_NUMBERS: tuple[int, ...] = (
    55, 54, 53, 52, 51, 61, 62, 63, 64, 65,
    85, 84, 83, 82, 81, 71, 72, 73, 74, 75,
)

FDI_TOOTH_NUMBER_SET = frozenset(FDI_TOOTH_NUMBERS)
FDI_PRIMARY_TOOTH_NUMBER_SET = frozenset(FDI_PRIMARY_TOOTH_NUMBERS)
FDI_ALL_TOOTH_NUMBER_SET = FDI_TOOTH_NUMBER_SET | FDI_PRIMARY_TOOTH_NUMBER_SET

SURFACE_CODE_ORDER: tuple[str, ...] = (
    "mesial",
    "oclusal",
    "distal",
    "vestibular",
    "lingual",
)


class ToothLayer(models.TextChoices):
    HALLAZGO = "hallazgo", "Hallazgo"
    PLAN = "plan", "Plan"
    HECHO = "hecho", "Hecho"


class ToothStatus(models.TextChoices):
    SANO = "sano", "Sano"
    CARIES = "caries", "Caries"
    FRACTURA = "fractura", "Fractura"
    OBTURADO = "obturado", "Obturado"
    SELLANTE = "sellante", "Sellante"
    RESTAURACION_TEMPORAL = "restauracion_temporal", "Restauración temporal"
    ENDODONCIA = "endodoncia", "Endodoncia"
    PULPOTOMIA = "pulpotomia", "Pulpotomía"
    CORONA = "corona", "Corona"
    PUENTE = "puente", "Puente"
    IMPLANTE = "implante", "Implante"
    EXTRAIDO = "extraido", "Extraído"
    RAIZ_RETENIDA = "raiz_retenida", "Raíz retenida"
    NO_ERUPCIONADO = "no_erupcionado", "No erupcionado"
    AUSENTE_CONGENITO = "ausente_congenito", "Ausente congénito"


class OralGeneralMark(models.TextChoices):
    PLACA = "placa", "Placa"
    SANGRADO = "sangrado", "Sangrado"
    SARRO = "sarro", "Sarro"


class ToothSurface(models.TextChoices):
    MESIAL = "mesial", "Mesial"
    DISTAL = "distal", "Distal"
    VESTIBULAR = "vestibular", "Vestibular"
    LINGUAL = "lingual", "Lingual"
    OCLUSAL = "oclusal", "Oclusal"


TOOTH_STATUS_PRIORITY: tuple[str, ...] = (
    ToothStatus.EXTRAIDO,
    ToothStatus.AUSENTE_CONGENITO,
    ToothStatus.NO_ERUPCIONADO,
    ToothStatus.RAIZ_RETENIDA,
    ToothStatus.IMPLANTE,
    ToothStatus.PUENTE,
    ToothStatus.CORONA,
    ToothStatus.ENDODONCIA,
    ToothStatus.PULPOTOMIA,
    ToothStatus.FRACTURA,
    ToothStatus.CARIES,
    ToothStatus.RESTAURACION_TEMPORAL,
    ToothStatus.SELLANTE,
    ToothStatus.OBTURADO,
    ToothStatus.SANO,
)

WHOLE_TOOTH_STATUSES = frozenset(
    {
        ToothStatus.EXTRAIDO,
        ToothStatus.IMPLANTE,
        ToothStatus.PUENTE,
        ToothStatus.RAIZ_RETENIDA,
        ToothStatus.NO_ERUPCIONADO,
        ToothStatus.AUSENTE_CONGENITO,
    }
)

def is_fdi_permanent_tooth(number: int) -> bool:
    return number in FDI_TOOTH_NUMBER_SET


def is_fdi_primary_tooth(number: int) -> bool:
    return number in FDI_PRIMARY_TOOTH_NUMBER_SET


def is_fdi_tooth(number: int) -> bool:
    return number in FDI_ALL_TOOTH_NUMBER_SET


def empty_oral_marks() -> dict:
    return {"placa": False, "sangrado": False, "sarro": False}


def normalize_oral_marks(raw: dict | None) -> dict:
    source = raw or {}
    return {
        "placa": bool(source.get("placa")),
        "sangrado": bool(source.get("sangrado")),
        "sarro": bool(source.get("sarro")),
    }


def derive_oral_marks(teeth: list[dict]) -> dict:
    marks = empty_oral_marks()
    for tooth in teeth:
        tooth_marks = tooth.get("oralMarks") or empty_oral_marks()
        for key in marks:
            marks[key] = marks[key] or bool(tooth_marks.get(key))
    return marks


def has_clinical_content(teeth: list[dict] | None) -> bool:
    for tooth in teeth or []:
        if tooth.get("marks"):
            return True
        oral = tooth.get("oralMarks") or {}
        if any(oral.get(key) for key in ("placa", "sangrado", "sarro")):
            return True
    return False


def combine_tooth_statuses(status: str, statuses: list[str] | None) -> list[str]:
    combined: list[str] = []
    for value in [*(statuses or []), status]:
        if value and value != ToothStatus.SANO and value not in combined:
            combined.append(value)
    if ToothStatus.EXTRAIDO in combined:
        return [ToothStatus.EXTRAIDO]
    if ToothStatus.AUSENTE_CONGENITO in combined:
        return [ToothStatus.AUSENTE_CONGENITO]
    if ToothStatus.NO_ERUPCIONADO in combined:
        return [ToothStatus.NO_ERUPCIONADO]
    if ToothStatus.IMPLANTE in combined:
        return [ToothStatus.IMPLANTE]
    return [
        value
        for value in TOOTH_STATUS_PRIORITY
        if value in combined and value != ToothStatus.SANO
    ]


def primary_tooth_status(statuses: list[str]) -> str:
    for value in TOOTH_STATUS_PRIORITY:
        if value in statuses:
            return value
    return ToothStatus.SANO


def _unique_surfaces(surfaces: list[str] | None) -> list[str]:
    allowed = set(ToothSurface.values)
    seen: list[str] = []
    for surface in surfaces or []:
        if surface in allowed and surface not in seen:
            seen.append(surface)
    return [surface for surface in SURFACE_CODE_ORDER if surface in seen]


# Capas en las que una marca lleva tratamiento del tarifario. En Plan es
# lo que el estudiante va a practicar (y lo que lista el banco de
# pacientes); en Hecho queda como historial de qué se hizo.
TREATMENT_LAYERS = frozenset({ToothLayer.PLAN, ToothLayer.HECHO})


def _treatment_slug(raw: dict) -> str | None:
    value = raw.get("treatment")
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


DONE_KEYS = ("doneBy", "doneByName", "doneAt")


def stamp_done_marks(previous_teeth, teeth, user, day) -> None:
    """Pone autor y fecha a los tratamientos que se marcan como realizados.

    Una marca hecho que ya lo estaba (misma pieza y tratamiento) conserva
    su autor original aunque guarde otro usuario; una que recién pasa a
    hecho queda a nombre de quien guarda. Lo que mande el cliente en esas
    claves no se usa.
    """
    before = {
        (tooth.get("fdi"), mark.get("treatment")): mark
        for tooth in previous_teeth or []
        for mark in tooth.get("marks") or []
        if mark.get("layer") == ToothLayer.HECHO and mark.get("treatment")
    }
    name = user.get_full_name() or user.username
    for tooth in teeth:
        for mark in tooth.get("marks") or []:
            if mark.get("layer") != ToothLayer.HECHO or not mark.get("treatment"):
                continue
            for key in DONE_KEYS:
                mark.pop(key, None)
            previous = before.get((tooth["fdi"], mark["treatment"]))
            if previous and previous.get("doneBy") is not None:
                for key in DONE_KEYS:
                    if previous.get(key) is not None:
                        mark[key] = previous[key]
            elif previous:
                # Marcado como hecho antes de que existiera el autor: no
                # se le atribuye a quien guarda ahora.
                continue
            else:
                mark.update(
                    {"doneBy": user.pk, "doneByName": name, "doneAt": day.isoformat()}
                )


def normalize_tooth_mark(raw: dict) -> dict | None:
    """Una marca: capa + estado (símbolo) + superficies [+ tratamiento].

    Con tratamiento, el estado puede faltar: el tratamiento no tiene
    dibujo (diagnóstico, profilaxis...) y solo se lista. Sin tratamiento,
    una marca sin estado o "sano" no aporta nada y se descarta.
    """
    status = raw.get("status") or None
    if status == ToothStatus.SANO:
        status = None
    layer = raw.get("layer")
    if layer not in ToothLayer.values:
        layer = ToothLayer.HALLAZGO if status else ToothLayer.PLAN
    treatment = _treatment_slug(raw) if layer in TREATMENT_LAYERS else None
    if layer == ToothLayer.HECHO and treatment is None:
        # "Hecho" es un tratamiento del plan ya realizado. Lo que el
        # paciente trae de antes (una corona de otra clínica) es parte del
        # diagnóstico: así no hay dos lugares para marcar lo mismo.
        layer = ToothLayer.HALLAZGO
    if status is None and treatment is None:
        return None
    surfaces = (
        []
        if status is None or status in WHOLE_TOOTH_STATUSES
        else _unique_surfaces(raw.get("surfaces"))
    )
    mark = {"layer": layer, "status": status, "surfaces": surfaces}
    if treatment:
        mark["treatment"] = treatment
    if layer == ToothLayer.HECHO and treatment:
        # Quién lo realizó y cuándo. Lo pone el servidor al guardar
        # (stamp_done_marks), nunca el cliente; aquí solo se conserva.
        for key in DONE_KEYS:
            if raw.get(key) is not None:
                mark[key] = raw[key]
    return mark


def _mark_key(mark: dict) -> tuple:
    return (
        mark["layer"],
        mark["status"],
        tuple(mark["surfaces"]),
        mark.get("treatment"),
    )


def apply_layer_exclusivity(marks: list[dict]) -> list[dict]:
    exclusive_by_layer: dict[str, dict] = {}
    kept: list[dict] = []
    for mark in marks:
        if mark["status"] in WHOLE_TOOTH_STATUSES:
            exclusive_by_layer[mark["layer"]] = mark
        else:
            kept.append(mark)
    if not exclusive_by_layer:
        return kept
    return [
        mark
        for mark in kept
        if mark["layer"] not in exclusive_by_layer
    ] + list(exclusive_by_layer.values())


def normalize_tooth_marks(raw_marks: list[dict] | None) -> list[dict]:
    marks: list[dict] = []
    seen: set[tuple] = set()
    for raw in raw_marks or []:
        mark = normalize_tooth_mark(raw)
        if mark is None:
            continue
        key = _mark_key(mark)
        if key in seen:
            continue
        seen.add(key)
        marks.append(mark)
    return apply_layer_exclusivity(marks)


def migrate_legacy_tooth(raw: dict) -> list[dict]:
    statuses = combine_tooth_statuses(
        raw.get("status") or ToothStatus.SANO,
        raw.get("statuses"),
    )
    surfaces = _unique_surfaces(raw.get("surfaces"))
    return normalize_tooth_marks(
        [
            {
                "layer": ToothLayer.HALLAZGO,
                "status": status,
                "surfaces": [] if status in WHOLE_TOOTH_STATUSES else surfaces,
            }
            for status in statuses
        ]
    )


def normalize_tooth(raw: dict) -> dict:
    fdi = raw["fdi"]
    marks = raw.get("marks")
    if marks:
        normalized_marks = normalize_tooth_marks(marks)
    elif raw.get("status") or raw.get("statuses"):
        normalized_marks = migrate_legacy_tooth(raw)
    else:
        normalized_marks = []
    return {
        "fdi": fdi,
        "marks": normalized_marks,
        "oralMarks": normalize_oral_marks(
            raw.get("oralMarks") or raw.get("oral_marks")
        ),
    }


def empty_tooth(number: int) -> dict:
    return {
        "fdi": number,
        "marks": [],
        "oralMarks": empty_oral_marks(),
    }


def default_tooth_findings(*, include_primary: bool = False) -> list[dict]:
    numbers = FDI_TOOTH_NUMBERS + (
        FDI_PRIMARY_TOOTH_NUMBERS if include_primary else ()
    )
    return [empty_tooth(number) for number in numbers]


def pad_teeth(teeth: list[dict]) -> list[dict]:
    by_fdi = {tooth["fdi"]: tooth for tooth in teeth}
    include_primary = any(is_fdi_primary_tooth(number) for number in by_fdi)
    numbers = FDI_TOOTH_NUMBERS + (
        FDI_PRIMARY_TOOTH_NUMBERS if include_primary else ()
    )
    return [by_fdi.get(number, empty_tooth(number)) for number in numbers]


def tooth_statuses(tooth: dict) -> list[str]:
    return [mark["status"] for mark in tooth.get("marks") or [] if mark["status"]]
