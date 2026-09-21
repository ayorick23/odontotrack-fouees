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


def is_fdi_permanent_tooth(number: int) -> bool:
    return number in FDI_TOOTH_NUMBER_SET
