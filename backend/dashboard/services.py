from datetime import date, datetime, timedelta

from django.db.models import Count
from django.db.models.functions import TruncMonth
from django.utils import timezone

from assignments.models import Assignment
from patients.models import PERIOD_DAYS, Patient

DEFAULT_SERIES_DAYS = PERIOD_DAYS["1a"]
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


def _period_start(period: str | None):
    days = PERIOD_DAYS.get(period or "", DEFAULT_SERIES_DAYS)
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


def _status_counts_by_month(queryset) -> dict[date, dict[str, int]]:
    rows = (
        queryset.annotate(bucket=TruncMonth("created_at"))
        .values("bucket", "case_status")
        .annotate(total=Count("id"))
    )
    empty = {status: 0 for status in Patient.CaseStatus.values}
    counts: dict[date, dict[str, int]] = {}
    for row in rows:
        bucket = row["bucket"]
        if bucket is None:
            continue
        month = _month_start(bucket)
        month_counts = counts.setdefault(month, dict(empty))
        month_counts[row["case_status"]] = row["total"]
    return counts


def build_dashboard_series(period: str | None) -> dict:
    start = _period_start(period)
    start_date = _as_local_date(start)
    today = timezone.localdate()

    patients = Patient.objects.filter(created_at__gte=start)
    assignments = Assignment.objects.filter(created_at__gte=start)

    assignment_counts = _counts_by_month(assignments, "created_at")
    status_by_month = _status_counts_by_month(patients)
    empty_status = {status: 0 for status in Patient.CaseStatus.values}

    months = []
    for month in _iter_months(start_date, today):
        status_counts = status_by_month.get(month, empty_status)
        pendiente = status_counts[Patient.CaseStatus.PENDIENTE]
        en_proceso = status_counts[Patient.CaseStatus.EN_PROCESO]
        finalizado = status_counts[Patient.CaseStatus.FINALIZADO]
        months.append(
            {
                "month": month.isoformat()[:7],
                "label": f"{MONTH_LABELS[month.month]} {str(month.year)[2:]}",
                "patients": pendiente + en_proceso + finalizado,
                "pendiente": pendiente,
                "en_proceso": en_proceso,
                "finalizado": finalizado,
                "assignments": assignment_counts.get(month, 0),
            }
        )

    status_rows = {
        row["case_status"]: row["total"]
        for row in patients.values("case_status").annotate(total=Count("id"))
    }
    by_status = [
        {
            "status": status,
            "label": label,
            "count": status_rows.get(status, 0),
        }
        for status, label in Patient.CaseStatus.choices
    ]
    return {"months": months, "by_status": by_status}
