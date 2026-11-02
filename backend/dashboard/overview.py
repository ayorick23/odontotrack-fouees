"""Dashboard por rol: lo que cada usuario tiene que hacer hoy.

Un solo endpoint arma bloques; cada bloque sale solo si el usuario tiene
el permiso ACL que lo habilita (si no, va en None y el frontend no lo
dibuja). Se decide por permiso y no por nombre de rol, como el resto del
sistema: un rol nuevo ve lo que sus permisos le permiten.

- my_cases (assignments.claim sin assignments.assign_student): quien toma
  casos para sí mismo, no quien asigna a otros. Hoy, el estudiante. El
  admin tiene ambos permisos y no lo ve: no atiende pacientes.
- supervision (diagnoses.validate): docente y admin.
- bank (assignments.assign_student): recepción y admin.
- faculty (dashboard.faculty): estadísticas de toda la facultad; admin.
- accounts (users.view): soporte y admin. Soporte no ve pacientes (no
  tiene patients.view), así que su dashboard son las cuentas.

Cada bloque trae `kpis` ({value, trend, trend_label, spark}, ver
metrics.py) para las tarjetas de arriba y los datos de sus gráficas.
"""

from collections import Counter
from datetime import datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.db.models import (
    Avg,
    Count,
    DurationField,
    ExpressionWrapper,
    F,
    OuterRef,
    Subquery,
)
from django.utils import timezone

from accounts.models import Role
from assignments.models import Appointment, Assignment
from catalogs.models import ClinicalArea, ClinicalTreatment
from clinical_records.catalog import ToothLayer
from clinical_records.models import Diagnostico, Odontogram
from patients.models import Patient

from . import metrics
from .indicators import build_indicators
from .scoping import dashboard_scope_for

User = get_user_model()

UPCOMING_DAYS = 7
# Espera promedio: pacientes registrados en este lapso (lo reciente es lo
# que refleja cómo funciona hoy el banco).
WAIT_WINDOW_DAYS = 182
BANK_DEMAND_LIMIT = 10
TASKS_LIMIT = 5
QUEUE_LIMIT = 4
TOP_LIMIT = 4
OCCUPANCY_DAYS = ("Lun", "Mar", "Mié", "Jue", "Vie")
OCCUPANCY_SLOTS = ((7, 9), (9, 11), (11, 13), (13, 15), (15, 17))


def _patient_name(patient: Patient) -> str:
    return f"{patient.first_name} {patient.last_name}".strip()


def _user_name(user) -> str:
    return user.get_full_name() or user.username


def _local_day_bounds(day) -> tuple[datetime, datetime]:
    start = timezone.make_aware(datetime.combine(day, time.min))
    return start, start + timedelta(days=1)


def _labelled(metric: dict, label: str) -> dict:
    return {**metric, "trend_label": label}


MONTH = "vs mes anterior"


def takes_cases(user) -> bool:
    return user.has_acl("assignments.claim") and not user.has_acl(
        "assignments.assign_student"
    )


def _case_status_counts(patients) -> dict:
    rows = dict(patients.values_list("case_status").annotate(total=Count("id")))
    return {status: rows.get(status, 0) for status in Patient.CaseStatus.values}


def _treatment_marks(teeth):
    for tooth in teeth or []:
        for mark in tooth.get("marks") or []:
            if mark.get("treatment"):
                yield mark


def _appointments_per_week(appointments, weeks: int = metrics.SPARK_MONTHS) -> list[int]:
    """Citas de cada una de las últimas semanas (la actual al final)."""
    today = timezone.localdate()
    monday = today - timedelta(days=today.weekday())
    values = []
    for back in range(weeks - 1, -1, -1):
        start, _ = _local_day_bounds(monday - timedelta(weeks=back))
        values.append(appointments.filter(starts_at__gte=start, starts_at__lt=start + timedelta(days=7)).count())
    return values


def _appointments_same_weekday(appointments, weeks: int = metrics.SPARK_MONTHS) -> list[int]:
    """Citas de hoy y del mismo día de las semanas anteriores."""
    today = timezone.localdate()
    values = []
    for back in range(weeks - 1, -1, -1):
        start, end = _local_day_bounds(today - timedelta(weeks=back))
        values.append(appointments.filter(starts_at__gte=start, starts_at__lt=end).count())
    return values


def occupancy(appointments) -> dict:
    """Citas de la semana por día (lun-vie) y franja de 2 horas. En fin de
    semana ya pasó la semana hábil: se muestra la que empieza."""
    today = timezone.localdate()
    monday = today - timedelta(days=today.weekday())
    if today.weekday() >= 5:
        monday += timedelta(weeks=1)
    start, _ = _local_day_bounds(monday)
    cells = [[0] * len(OCCUPANCY_SLOTS) for _ in OCCUPANCY_DAYS]
    week = appointments.filter(
        starts_at__gte=start,
        starts_at__lt=start + timedelta(days=5),
    ).exclude(status=Appointment.Status.CANCELADA)
    for starts_at in week.values_list("starts_at", flat=True):
        local = timezone.localtime(starts_at)
        for index, (begin, end) in enumerate(OCCUPANCY_SLOTS):
            if begin <= local.hour < end:
                cells[local.weekday()][index] += 1
    return {
        "label": "Próxima semana" if today.weekday() >= 5 else "Esta semana",
        "days": list(OCCUPANCY_DAYS),
        "slots": [f"{begin}–{end}" for begin, end in OCCUPANCY_SLOTS],
        "cells": cells,
    }


# --- Mis casos (estudiante) ------------------------------------------------


def _done_by_dates(odontograms, user) -> list[str]:
    """Fechas en que `user` marcó tratamientos como realizados (doneAt)."""
    dates = []
    for teeth in odontograms.values_list("teeth", flat=True):
        for mark in _treatment_marks(teeth):
            if mark.get("layer") == ToothLayer.HECHO and mark.get("doneBy") == user.pk:
                dates.append(mark.get("doneAt"))
    return [value for value in dates if value]


def my_cases(user) -> dict:
    now = timezone.now()
    today = timezone.localdate()
    mine = Assignment.objects.filter(student=user)
    active = list(
        mine.filter(status=Assignment.AssignmentStatus.ACTIVA).select_related("patient")
    )
    upcoming = list(
        Appointment.objects.filter(
            assignment__in=active,
            status=Appointment.Status.PROGRAMADA,
            starts_at__gte=now,
        )
        .select_related("assignment__patient")
        .order_by("starts_at")
    )
    next_by_assignment: dict[int, datetime] = {}
    for appointment in upcoming:
        next_by_assignment.setdefault(appointment.assignment_id, appointment.starts_at)

    teeth_by_patient = dict(
        Odontogram.objects.filter(patient__in=[a.patient_id for a in active]).values_list(
            "patient_id", "teeth"
        )
    )
    cases = []
    for assignment in active:
        marks = [
            mark
            for mark in _treatment_marks(teeth_by_patient.get(assignment.patient_id))
            if mark.get("layer") in (ToothLayer.PLAN, ToothLayer.HECHO)
        ]
        cases.append(
            {
                "patient_id": assignment.patient_id,
                "patient_name": _patient_name(assignment.patient),
                "next_appointment": next_by_assignment.get(assignment.id),
                "plan_done": sum(1 for mark in marks if mark["layer"] == ToothLayer.HECHO),
                "plan_total": len(marks),
            }
        )
    # Primero los que tienen cita más pronto; sin cita, al final.
    cases.sort(
        key=lambda case: (
            case["next_appointment"] is None,
            case["next_appointment"] or now,
            case["patient_name"],
        )
    )

    pending = Diagnostico.objects.filter(student=user, is_validated=False).select_related("patient")
    tasks = []
    for case in cases:
        if case["next_appointment"] is None:
            tasks.append(
                {
                    "kind": "schedule",
                    "title": f"Agendar cita para {case['patient_name']}",
                    "detail": "Caso sin cita",
                    "patient_id": case["patient_id"],
                }
            )
    for diagnosis in pending.order_by("created_at"):
        tasks.append(
            {
                "kind": "diagnosis",
                "title": f"Diagnóstico de {_patient_name(diagnosis.patient)}",
                "detail": "Esperando validación del docente",
                "patient_id": diagnosis.patient_id,
            }
        )
    for appointment in upcoming:
        day = timezone.localtime(appointment.starts_at).date()
        if day > today + timedelta(days=1):
            break
        tasks.append(
            {
                "kind": "appointment",
                "title": f"Cita con {_patient_name(appointment.assignment.patient)}",
                "detail": "Hoy" if day == today else "Mañana",
                "starts_at": appointment.starts_at,
                "patient_id": appointment.assignment.patient_id,
            }
        )

    week_end = now + timedelta(days=UPCOMING_DAYS)
    # Cualquier paciente que tuvo: lo realizado cuenta aunque lo liberara.
    own_odontograms = Odontogram.objects.filter(patient_id__in=mine.values("patient_id"))
    done_dates = _done_by_dates(own_odontograms, user)
    mine_appointments = Appointment.objects.filter(assignment__student=user).exclude(
        status=Appointment.Status.CANCELADA
    )
    done_ends = metrics.month_ends()
    return {
        "kpis": {
            "active_cases": _labelled(
                metrics.stock(lambda moment: metrics.active_assignments_at(mine, moment).count()),
                MONTH,
            ),
            "week_appointments": _labelled(
                metrics.metric(_appointments_per_week(mine_appointments)), "vs semana anterior"
            ),
            "pending_diagnoses": _labelled(
                metrics.stock(
                    lambda moment: metrics.pending_diagnoses_at(
                        Diagnostico.objects.filter(student=user), moment
                    ).count()
                ),
                MONTH,
            ),
            "done_treatments": _labelled(
                metrics.metric(
                    [
                        sum(1 for value in done_dates if value <= timezone.localtime(end).date().isoformat())
                        for end in done_ends
                    ]
                ),
                MONTH,
            ),
        },
        "cases": cases,
        "tasks": tasks[:TASKS_LIMIT],
        "upcoming_appointments": [
            {
                "id": appointment.id,
                "starts_at": appointment.starts_at,
                "patient_id": appointment.assignment.patient_id,
                "patient_name": _patient_name(appointment.assignment.patient),
            }
            for appointment in upcoming
            if appointment.starts_at < week_end
        ],
        "done_by_month": metrics.per_month(
            datetime.fromisoformat(value).date() for value in done_dates
        ),
        "bank_available": Patient.objects.available().count(),
        "bank_top": bank_demand()[:3],
    }


# --- Supervisión (docente) -------------------------------------------------


def supervision(user) -> dict:
    scope = dashboard_scope_for(user)
    pending = scope.diagnoses.filter(is_validated=False)

    def validated_ratio_at(moment):
        total = scope.diagnoses.filter(created_at__lte=moment).count()
        validated = scope.diagnoses.filter(validated_at__lte=moment, is_validated=True).count()
        return round(validated * 100 / total) if total else 0

    def in_process(moment):
        return (
            metrics.active_assignments_at(scope.assignments, moment)
            .values("patient")
            .distinct()
            .count()
        )

    top = (
        scope.assignments.filter(status=Assignment.AssignmentStatus.ACTIVA)
        .values("student")
        .annotate(total=Count("id"))
        .order_by("-total")[:TOP_LIMIT]
    )
    students = User.objects.in_bulk([row["student"] for row in top])
    return {
        "kpis": {
            "pending_diagnoses": _labelled(
                metrics.stock(lambda moment: metrics.pending_diagnoses_at(scope.diagnoses, moment).count()),
                MONTH,
            ),
            "cases_in_progress": _labelled(metrics.stock(in_process), MONTH),
            "students_active": _labelled(
                metrics.stock(
                    lambda moment: metrics.active_assignments_at(scope.assignments, moment)
                    .values("student")
                    .distinct()
                    .count()
                ),
                MONTH,
            ),
            "validated_ratio": _labelled(
                {**metrics.stock(validated_ratio_at), "unit": "%"}, MONTH
            ),
        },
        # Los que más esperan primero.
        "queue": [
            {
                "id": diagnosis.id,
                "content": diagnosis.content,
                "patient_id": diagnosis.patient_id,
                "patient_name": _patient_name(diagnosis.patient),
                "student_name": _user_name(diagnosis.student),
                "created_at": diagnosis.created_at,
            }
            for diagnosis in pending.select_related("patient", "student").order_by("created_at")[:QUEUE_LIMIT]
        ],
        "diagnoses_to_validate": pending.count(),
        "indicators": build_indicators(scope),
        "validated_by_month": metrics.per_month(
            scope.diagnoses.filter(is_validated=True).values_list("validated_at", flat=True)
        ),
        "top_students": [
            {"name": _user_name(students[row["student"]]), "count": row["total"]}
            for row in top
            if row["student"] in students
        ],
        "status": _case_status_counts(scope.patients),
    }


# --- Banco y agenda (recepción) -------------------------------------------


def average_wait_days(patients) -> float | None:
    """Días promedio entre el registro del paciente y su primera
    asignación. Solo cuenta pacientes asignados alguna vez; None si no hay.

    Idea de la rama feature/dashboard-metricas (Rodrigo).
    """
    first_assignment = (
        Assignment.objects.filter(patient=OuterRef("pk"))
        .order_by("created_at")
        .values("created_at")[:1]
    )
    average = (
        patients.annotate(first_assignment=Subquery(first_assignment))
        .exclude(first_assignment=None)
        .aggregate(
            average=Avg(
                ExpressionWrapper(
                    F("first_assignment") - F("created_at"),
                    output_field=DurationField(),
                )
            )
        )["average"]
    )
    if average is None:
        return None
    return round(average.total_seconds() / 86400, 1)


def _wait_metric() -> dict:
    """Valor: espera de los últimos 6 meses. Curva: espera de los pacientes
    registrados en cada mes (los meses sin asignaciones repiten el valor
    anterior para no dibujar caídas a cero)."""
    values = []
    for start in metrics.recent_months(metrics.SPARK_MONTHS):
        begin, _ = _local_day_bounds(start)
        end_month = metrics.month_start(start + timedelta(days=32))
        end, _ = _local_day_bounds(end_month)
        month_value = average_wait_days(Patient.objects.filter(created_at__gte=begin, created_at__lt=end))
        values.append(month_value if month_value is not None else (values[-1] if values else 0))
    window = average_wait_days(
        Patient.objects.filter(created_at__gte=timezone.now() - timedelta(days=WAIT_WINDOW_DAYS))
    )
    return {
        **metrics.metric(values),
        "value": window,
        "unit": "días",
        "trend_label": MONTH,
    }


def bank(user) -> dict:
    today = timezone.localdate()
    day_start, day_end = _local_day_bounds(today)
    appointments = Appointment.objects.exclude(status=Appointment.Status.CANCELADA)
    today_rows = (
        appointments.filter(starts_at__gte=day_start, starts_at__lt=day_end)
        .select_related("assignment__patient", "assignment__student")
        .order_by("starts_at")
    )
    registered = metrics.per_month(Patient.objects.values_list("created_at", flat=True))
    return {
        "kpis": {
            "unassigned": _labelled(
                metrics.stock(lambda moment: metrics.bank_at(Patient.objects.all(), moment).count()),
                MONTH,
            ),
            "today_appointments": _labelled(
                metrics.metric(_appointments_same_weekday(appointments)), "vs mismo día semana pasada"
            ),
            "registered_month": metrics.month_to_date(Patient.objects.all(), "created_at"),
            "wait_days": _wait_metric(),
        },
        "today": [
            {
                "id": appointment.id,
                "starts_at": appointment.starts_at,
                "duration_minutes": appointment.duration_minutes,
                "status": appointment.status,
                "patient_id": appointment.assignment.patient_id,
                "patient_name": _patient_name(appointment.assignment.patient),
                "student_name": _user_name(appointment.assignment.student),
            }
            for appointment in today_rows
        ],
        "occupancy": occupancy(appointments),
        "registered_by_month": registered,
    }


# --- Facultad (admin) -------------------------------------------------------


def patients_by_area() -> list[dict]:
    """Pacientes por área clínica de la ficha y estado, de mayor a menor.

    Salen todas las áreas activas, también las vacías. Idea de la rama
    feature/dashboard-metricas (Rodrigo).
    """
    empty = {status: 0 for status in Patient.CaseStatus.values}
    rows = {
        area.name: dict(empty)
        for area in ClinicalArea.objects.filter(is_active=True).order_by("sort_order")
    }
    totals = Patient.objects.values("clinical_area__name", "case_status").annotate(
        total=Count("id")
    )
    for row in totals:
        area = row["clinical_area__name"] or "Sin área"
        rows.setdefault(area, dict(empty))[row["case_status"]] = row["total"]
    return sorted(
        ({"area": area, **statuses} for area, statuses in rows.items()),
        key=lambda row: -sum(row[status] for status in Patient.CaseStatus.values),
    )


def bank_demand() -> list[dict]:
    """Tratamientos planificados en los pacientes del banco (disponibles):
    qué prácticas tiene la facultad para ofrecer, de más a menos."""
    tally: Counter[str] = Counter()
    teeth_lists = Odontogram.objects.filter(
        patient__in=Patient.objects.available()
    ).values_list("teeth", flat=True)
    for teeth in teeth_lists:
        for mark in _treatment_marks(teeth):
            if mark.get("layer") == ToothLayer.PLAN:
                tally[mark["treatment"]] += 1
    top = tally.most_common(BANK_DEMAND_LIMIT)
    names = {
        row["slug"]: row
        for row in ClinicalTreatment.objects.filter(
            slug__in=[slug for slug, _ in top]
        ).values("slug", "name", "area__name")
    }
    return [
        {
            "treatment": slug,
            "name": names.get(slug, {}).get("name", slug),
            "area": names.get(slug, {}).get("area__name", ""),
            "count": count,
        }
        for slug, count in top
    ]


def faculty(user) -> dict:
    return {
        "by_area": patients_by_area(),
        "bank_demand": bank_demand(),
        "status": _case_status_counts(Patient.objects.all()),
        "occupancy": occupancy(Appointment.objects.all()),
    }


# --- Cuentas (soporte) ------------------------------------------------------


def accounts(user) -> dict:
    labels = dict(User.Role.choices)
    active = dict(
        User.objects.filter(is_active=True)
        .values_list("role")
        .annotate(total=Count("id"))
    )
    return {
        "kpis": {
            # Aproximación: no se guarda cuándo se desactivó una cuenta.
            "active": _labelled(
                metrics.stock(
                    lambda moment: User.objects.filter(is_active=True, date_joined__lte=moment).count()
                ),
                MONTH,
            ),
            "new_month": metrics.month_to_date(User.objects.all(), "date_joined"),
            "inactive": {"value": User.objects.filter(is_active=False).count(), "trend": None, "spark": []},
            "roles": {"value": Role.objects.count(), "trend": None, "spark": []},
        },
        "active_by_role": [
            {"role": role, "label": label, "count": active.get(role, 0)}
            for role, label in labels.items()
        ],
        "inactive": User.objects.filter(is_active=False).count(),
        "new_by_month": metrics.per_month(User.objects.values_list("date_joined", flat=True)),
        "recent": [
            {
                "id": account.id,
                "name": _user_name(account),
                "role_label": labels.get(account.role, account.role),
                "date_joined": account.date_joined,
            }
            for account in User.objects.order_by("-date_joined")[:QUEUE_LIMIT]
        ],
    }


def build_overview(user) -> dict:
    return {
        "my_cases": my_cases(user) if takes_cases(user) else None,
        "supervision": supervision(user) if user.has_acl("diagnoses.validate") else None,
        "bank": bank(user) if user.has_acl("assignments.assign_student") else None,
        "faculty": faculty(user) if user.has_acl("dashboard.faculty") else None,
        "accounts": accounts(user) if user.has_acl("users.view") else None,
    }


def menu_counters(user) -> dict:
    """Contadores livianos del menú lateral (dos COUNT), para pedirlos en
    cada navegación sin calcular todo el dashboard. None = no aplica."""
    takes_or_assigns = user.has_acl("assignments.claim") or user.has_acl(
        "assignments.assign_student"
    )
    return {
        "supervision": (
            dashboard_scope_for(user).diagnoses.filter(is_validated=False).count()
            if user.has_acl("diagnoses.validate")
            else None
        ),
        "assignments": (
            Patient.objects.available().count() if takes_or_assigns else None
        ),
    }
