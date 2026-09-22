from django.db import models

FDI_TOOTH_NUMBERS: tuple[int, ...] = (
    18, 17, 16, 15, 14, 13, 12, 11,
    21, 22, 23, 24, 25, 26, 27, 28,
    48, 47, 46, 45, 44, 43, 42, 41,
    31, 32, 33, 34, 35, 36, 37, 38,
)

FDI_TOOTH_NUMBER_SET = frozenset(FDI_TOOTH_NUMBERS)


class ToothStatus(models.TextChoices):
    SANO = "sano", "Sano"
    CARIES = "caries", "Caries"
    OBTURADO = "obturado", "Obturado"
    EXTRAIDO = "extraido", "Extraído"
    CORONA = "corona", "Corona"
    IMPLANTE = "implante", "Implante"


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
    ToothStatus.IMPLANTE,
    ToothStatus.CORONA,
    ToothStatus.CARIES,
    ToothStatus.OBTURADO,
    ToothStatus.SANO,
)


def is_fdi_permanent_tooth(number: int) -> bool:
    return number in FDI_TOOTH_NUMBER_SET


def combine_tooth_statuses(status: str, statuses: list[str] | None) -> list[str]:
    combined: list[str] = []
    for value in [*(statuses or []), status]:
        if value and value != ToothStatus.SANO and value not in combined:
            combined.append(value)
    if ToothStatus.EXTRAIDO in combined:
        return [ToothStatus.EXTRAIDO]
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


def default_tooth_findings() -> list[dict]:
    return [
        {
            "fdi": number,
            "status": ToothStatus.SANO,
            "statuses": [],
            "surfaces": [],
        }
        for number in FDI_TOOTH_NUMBERS
    ]
