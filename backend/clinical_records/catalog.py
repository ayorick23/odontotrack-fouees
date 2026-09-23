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

HECHO_STATUSES = frozenset(
    {
        ToothStatus.OBTURADO,
        ToothStatus.SELLANTE,
        ToothStatus.RESTAURACION_TEMPORAL,
        ToothStatus.ENDODONCIA,
        ToothStatus.PULPOTOMIA,
        ToothStatus.CORONA,
        ToothStatus.PUENTE,
        ToothStatus.IMPLANTE,
        ToothStatus.EXTRAIDO,
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


def empty_practice() -> dict:
    return {"indicated": False, "clinicalArea": None}


def normalize_oral_marks(raw: dict | None) -> dict:
    source = raw or {}
    return {
        "placa": bool(source.get("placa")),
        "sangrado": bool(source.get("sangrado")),
        "sarro": bool(source.get("sarro")),
    }


def normalize_practice(raw: dict | None) -> dict:
    source = raw or {}
    indicated = bool(source.get("indicated"))
    area = source.get("clinicalArea") or source.get("clinical_area")
    if indicated and isinstance(area, str) and area.strip():
        return {"indicated": True, "clinicalArea": area.strip()}
    return empty_practice()


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
        practice = tooth.get("practice") or {}
        if practice.get("indicated"):
            return True
    return False


def default_layer_for_status(status: str) -> str:
    if status in HECHO_STATUSES:
        return ToothLayer.HECHO
    return ToothLayer.HALLAZGO


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


def normalize_tooth_mark(raw: dict) -> dict | None:
    status = raw.get("status") or ToothStatus.SANO
    if status == ToothStatus.SANO:
        return None
    layer = raw.get("layer") or default_layer_for_status(status)
    if layer not in ToothLayer.values:
        layer = default_layer_for_status(status)
    surfaces = (
        []
        if status in WHOLE_TOOTH_STATUSES
        else _unique_surfaces(raw.get("surfaces"))
    )
    return {"layer": layer, "status": status, "surfaces": surfaces}


def _mark_key(mark: dict) -> tuple[str, str, tuple[str, ...]]:
    return (mark["layer"], mark["status"], tuple(mark["surfaces"]))


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
    seen: set[tuple[str, str, tuple[str, ...]]] = set()
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
                "layer": default_layer_for_status(status),
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
        "practice": normalize_practice(raw.get("practice")),
    }


def empty_tooth(number: int) -> dict:
    return {
        "fdi": number,
        "marks": [],
        "oralMarks": empty_oral_marks(),
        "practice": empty_practice(),
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
    return [mark["status"] for mark in tooth.get("marks") or []]
