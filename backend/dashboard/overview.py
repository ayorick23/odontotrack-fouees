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

from assignments.models import Appointment, Assignment
from catalogs.models import ClinicalArea, ClinicalTreatment
from clinical_records.catalog import ToothLayer
from clinical_records.models import Diagnostico, Odontogram
from patients.models import Patient

from .indicators import build_indicators
from .scoping import dashboard_scope_for

User = get_user_model()

UPCOMING_DAYS = 7
# Espera promedio: pacientes registrados en este lapso (lo reciente es lo
# que refleja cómo funciona hoy el banco).
WAIT_WINDOW_DAYS = 182
BANK_DEMAND_LIMIT = 10


def _patient_name(patient: Patient) -> str:
    return f"{patient.first_name} {patient.last_name}".strip()


def _user_name(user) -> str:
    return user.get_full_name() or user.username


def _local_day_bounds(day) -> tuple[datetime, datetime]:
    start = timezone.make_aware(datetime.combine(day, time.min))
    return start, start + timedelta(days=1)


def _appointment_row(appointment: Appointment, *, with_student: bool) -> dict:
    patient = appointment.assignment.patient
    row = {
        "id": appointment.id,
        "starts_at": appointment.starts_at,
        "patient_id": patient.id,
        "patient_name": _patient_name(patient),
    }
    if with_student:
        row["student_name"] = _user_name(appointment.assignment.student)
    return row


def takes_cases(user) -> bool:
    return user.has_acl("assignments.claim") and not user.has_acl(
        "assignments.assign_student"
    )


def _done_by(odontograms, user) -> int:
    """Tratamientos del plan que `user` marcó como realizados (doneBy)."""
    total = 0
    for teeth in odontograms.values_list("teeth", flat=True):
        for tooth in teeth or []:
            total += sum(
                1
                for mark in tooth.get("marks") or []
                if mark.get("layer") == ToothLayer.HECHO
                and mark.get("doneBy") == user.pk
            )
    return total


def my_cases(user) -> dict:
    now = timezone.now()
    active = list(
        Assignment.objects.filter(
            student=user, status=Assignment.AssignmentStatus.ACTIVA
        ).select_related("patient", "student")
    )
    upcoming = list(
        Appointment.objects.filter(
            assignment__in=active,
            status=Appointment.Status.PROGRAMADA,
            starts_at__gte=now,
        )
        .select_related("assignment__patient", "assignment__student")
        .order_by("starts_at")
    )
    next_by_assignment: dict[int, datetime] = {}
    for appointment in upcoming:
        next_by_assignment.setdefault(appointment.assignment_id, appointment.starts_at)

    cases = [
        {
            "patient_id": assignment.patient_id,
            "patient_name": _patient_name(assignment.patient),
            "next_appointment": next_by_assignment.get(assignment.id),
        }
        for assignment in active
    ]
    # Primero los que tienen cita más pronto; sin cita, al final.
    cases.sort(
        key=lambda case: (
            case["next_appointment"] is None,
            case["next_appointment"] or now,
            case["patient_name"],
        )
    )
    week_end = now + timedelta(days=UPCOMING_DAYS)
    # Cualquier paciente que tuvo: lo realizado cuenta aunque lo liberara.
    own_patients = Assignment.objects.filter(student=user).values("patient_id")
    return {
        "cases": cases,
        "upcoming_appointments": [
            _appointment_row(appointment, with_student=False)
            for appointment in upcoming
            if appointment.starts_at < week_end
        ],
        "diagnoses_awaiting_validation": Diagnostico.objects.filter(
            student=user, is_validated=False
        ).count(),
        "bank_available": Patient.objects.available().count(),
        "my_done_treatments": _done_by(
            Odontogram.objects.filter(patient_id__in=own_patients), user
        ),
    }


def supervision(user) -> dict:
    scope = dashboard_scope_for(user)
    return {
        # Misma cola que la pantalla de Supervisión (?is_validated=false).
        "diagnoses_to_validate": scope.diagnoses.filter(is_validated=False).count(),
        "cases_in_progress": scope.patients.filter(
            case_status=Patient.CaseStatus.EN_PROCESO
        ).count(),
        "students_with_active_cases": scope.assignments.filter(
            status=Assignment.AssignmentStatus.ACTIVA
        )
        .values("student")
        .distinct()
        .count(),
        "indicators": build_indicators(scope),
    }


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


def bank(user) -> dict:
    today = timezone.localdate()
    day_start, day_end = _local_day_bounds(today)
    month_start, _ = _local_day_bounds(today.replace(day=1))
    appointments = (
        Appointment.objects.filter(
            status=Appointment.Status.PROGRAMADA,
            starts_at__gte=day_start,
            starts_at__lt=day_end,
        )
        .select_related("assignment__patient", "assignment__student")
        .order_by("starts_at")
    )
    return {
        "unassigned": Patient.objects.available().count(),
        "registered_this_month": Patient.objects.filter(
            created_at__gte=month_start
        ).count(),
        "today_appointments": [
            _appointment_row(appointment, with_student=True)
            for appointment in appointments
        ],
        "average_wait_days": average_wait_days(
            Patient.objects.filter(
                created_at__gte=timezone.now() - timedelta(days=WAIT_WINDOW_DAYS)
            )
        ),
    }


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
    counts = Patient.objects.values("clinical_area__name", "case_status").annotate(
        total=Count("id")
    )
    for row in counts:
        area = row["clinical_area__name"] or "Sin área"
        rows.setdefault(area, dict(empty))[row["case_status"]] = row["total"]
    return sorted(
        ({"area": area, **statuses} for area, statuses in rows.items()),
        key=lambda row: -sum(row[status] for status in Patient.CaseStatus.values),
    )


def bank_demand() -> list[dict]:
    """Tratamientos planificados en los pacientes del banco (disponibles):
    qué prácticas tiene la facultad para ofrecer, de más a menos."""
    counts: Counter[str] = Counter()
    teeth_lists = Odontogram.objects.filter(
        patient__in=Patient.objects.available()
    ).values_list("teeth", flat=True)
    for teeth in teeth_lists:
        for tooth in teeth or []:
            for mark in tooth.get("marks") or []:
                if mark.get("layer") == ToothLayer.PLAN and mark.get("treatment"):
                    counts[mark["treatment"]] += 1
    top = counts.most_common(BANK_DEMAND_LIMIT)
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
    return {"by_area": patients_by_area(), "bank_demand": bank_demand()}


def accounts(user) -> dict:
    labels = dict(User.Role.choices)
    active = dict(
        User.objects.filter(is_active=True)
        .values_list("role")
        .annotate(total=Count("id"))
    )
    return {
        "active_by_role": [
            {"role": role, "label": label, "count": active.get(role, 0)}
            for role, label in labels.items()
        ],
        "inactive": User.objects.filter(is_active=False).count(),
    }


def build_overview(user) -> dict:
    return {
        "my_cases": my_cases(user) if takes_cases(user) else None,
        "supervision": supervision(user) if user.has_acl("diagnoses.validate") else None,
        "bank": bank(user) if user.has_acl("assignments.assign_student") else None,
        "faculty": faculty(user) if user.has_acl("dashboard.faculty") else None,
        "accounts": accounts(user) if user.has_acl("users.view") else None,
    }
