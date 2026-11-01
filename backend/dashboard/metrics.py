"""Series en el tiempo para el dashboard: mini curvas y tendencias.

Dos clases de número:

- Existencias ("cuántos hay"): casos activos, pacientes en el banco,
  diagnósticos por validar. La curva muestra el valor al cierre de cada uno
  de los últimos meses, reconstruido desde las fechas guardadas.
- Flujos ("cuántos pasaron"): registrados, validados, realizados. La curva
  muestra el total de cada mes.

La tendencia compara el valor actual con el del cierre del mes anterior.

Aproximación documentada: una asignación no guarda cuándo terminó; se usa
su `updated_at` (la última modificación, que es la de finalizar o liberar).
"""

from collections import Counter
from datetime import date, datetime, time, timedelta

from django.db.models import Q, QuerySet
from django.utils import timezone

from assignments.models import Assignment

SPARK_MONTHS = 6
CHART_MONTHS = 12
MONTH_LABELS = ("", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic")


def month_start(day: date) -> date:
    return day.replace(day=1)


def _prev_month(day: date) -> date:
    first = month_start(day)
    return month_start(first - timedelta(days=1))


def recent_months(count: int) -> list[date]:
    """Primer día de los últimos `count` meses, del más viejo al actual."""
    months = [month_start(timezone.localdate())]
    while len(months) < count:
        months.insert(0, _prev_month(months[0]))
    return months


def _aware(day: date) -> datetime:
    return timezone.make_aware(datetime.combine(day, time.min))


def month_ends(count: int = SPARK_MONTHS) -> list[datetime]:
    """Cierre de cada uno de los últimos meses; el último es "ahora"."""
    ends = []
    for start in recent_months(count)[1:]:
        ends.append(_aware(start))  # el inicio de un mes es el cierre del anterior
    ends.append(timezone.now())
    return ends


def trend(values: list[float]) -> float | None:
    """% de cambio del último valor contra el anterior; None sin base."""
    if len(values) < 2 or not values[-2]:
        return None
    return round((values[-1] - values[-2]) * 100 / values[-2])


def metric(values: list[float], *, unit: str = "") -> dict:
    """{value, trend, spark}: valor actual (el último), tendencia y curva."""
    return {
        "value": values[-1] if values else 0,
        "trend": trend(values),
        "spark": values,
        **({"unit": unit} if unit else {}),
    }


def stock(count_at) -> dict:
    """Existencia: `count_at(momento)` evaluado en cada cierre de mes."""
    return metric([count_at(moment) for moment in month_ends()])


# --- Existencias en un momento dado ---------------------------------------


def active_assignments_at(assignments: QuerySet, moment: datetime) -> QuerySet:
    """Asignaciones vigentes en `moment` (ver aproximación arriba)."""
    return assignments.filter(created_at__lte=moment).filter(
        Q(status=Assignment.AssignmentStatus.ACTIVA) | Q(updated_at__gt=moment)
    )


def bank_at(patients: QuerySet, moment: datetime) -> QuerySet:
    """Pacientes registrados en `moment` que no tenían una asignación
    vigente ni un caso cerrado: los disponibles en el banco."""
    taken = Assignment.objects.filter(created_at__lte=moment).exclude(
        status=Assignment.AssignmentStatus.CANCELADA, updated_at__lte=moment
    )
    return patients.filter(created_at__lte=moment).exclude(
        id__in=taken.values("patient_id")
    )


def pending_diagnoses_at(diagnoses: QuerySet, moment: datetime) -> QuerySet:
    return diagnoses.filter(created_at__lte=moment).filter(
        Q(is_validated=False) | Q(validated_at__gt=moment)
    )


# --- Flujos por mes --------------------------------------------------------


def per_month(dates, count: int = CHART_MONTHS) -> list[dict]:
    """[{month: "2026-11", label: "Nov", count}] de los últimos `count`
    meses, a partir de fechas sueltas (date o datetime)."""
    months = recent_months(count)
    tally = Counter()
    for value in dates:
        if value is None:
            continue
        if isinstance(value, datetime):
            value = timezone.localtime(value).date() if timezone.is_aware(value) else value.date()
        tally[month_start(value)] += 1
    return [
        {"month": start.isoformat()[:7], "label": MONTH_LABELS[start.month], "count": tally[start]}
        for start in months
    ]


def counts(rows: list[dict]) -> list[int]:
    return [row["count"] for row in rows]
