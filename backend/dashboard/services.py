from datetime import date, datetime, timedelta

from django.db.models import Count
from django.db.models.functions import TruncMonth
from django.utils import timezone

from assignments.models import Assignment
from patients.models import PERIOD_DAYS, Patient

MONTH_LABELS = (
    "",
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
)


def period_start(period: str | None) -> datetime | None:
    """Inicio del período; None significa "todos" (sin filtro)."""
    days = PERIOD_DAYS.get(period or "")
    if days is None:
        return None
    return timezone.now() - timedelta(days=days)


def _as_local_date(value: datetime | date) -> date:
    if isinstance(value, datetime):
        if timezone.is_aware(value):
            value = timezone.localtime(value)
        return value.date()
    return value


def _month_start(value: datetime | date) -> date:
    local = _as_local_date(value)
    return date(local.year, local.month, 1)


def _iter_months(start: date, end: date):
    current = date(start.year, start.month, 1)
    last = date(end.year, end.month, 1)
    while current <= last:
        yield current
        if current.month == 12:
            current = date(current.year + 1, 1, 1)
        else:
            current = date(current.year, current.month + 1, 1)


def _counts_by_month(queryset, field: str) -> dict[date, int]:
    rows = (
        queryset.annotate(bucket=TruncMonth(field))
        .values("bucket")
        .annotate(total=Count("id"))
    )
    counts: dict[date, int] = {}
    for row in rows:
        bucket = row["bucket"]
        if bucket is None:
            continue
        counts[_month_start(bucket)] = row["total"]
    return counts


def build_dashboard_series(period: str | None) -> dict:
    start = period_start(period)
    today = timezone.localdate()

    patients = Patient.objects.all()
    assignments = Assignment.objects.all()
    if start is not None:
        patients = patients.filter(created_at__gte=start)
        assignments = assignments.filter(created_at__gte=start)

    patient_counts = _counts_by_month(patients, "created_at")
    assignment_counts = _counts_by_month(assignments, "created_at")
    if start is not None:
        first_month = _month_start(start)
    else:
        first_month = min([*patient_counts, *assignment_counts], default=today)

    months = [
        {
            "month": month.isoformat()[:7],
            "label": f"{MONTH_LABELS[month.month]} {str(month.year)[2:]}",
            "patients": patient_counts.get(month, 0),
            "assignments": assignment_counts.get(month, 0),
        }
        for month in _iter_months(first_month, today)
    ]
    return {"months": months}
