"""Datos ficticios para ver el dashboard y el banco con volumen.

Solo desarrollo (DEBUG). Se corre a mano:

    python manage.py seed_demo            # crea ~40 pacientes demo
    python manage.py seed_demo --clear    # borra solo los pacientes demo

Los pacientes demo se reconocen porque su documento empieza con "DEMO-";
al borrarlos se van en cascada sus asignaciones, citas, diagnósticos y
odontogramas. Los casos se reparten entre los estudiantes que ya existen
(p. ej. los de seed_users): no crea usuarios. Se crea con el ORM directo,
así que no dispara notificaciones.
"""

import random
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from assignments.models import Appointment, Assignment
from catalogs.models import ClinicalArea, ClinicalTreatment
from clinical_records.catalog import default_tooth_findings
from clinical_records.models import Diagnostico, Odontogram
from patients.models import Patient

DEMO_PREFIX = "DEMO-"
DEFAULT_COUNT = 40

FIRST_NAMES = (
    "Ana", "Carlos", "María", "José", "Sofía", "Luis", "Gabriela", "Jorge",
    "Daniela", "Miguel", "Valeria", "Ricardo", "Fernanda", "Óscar", "Karla",
    "Ernesto", "Andrea", "Mauricio", "Paola", "Rafael",
)
LAST_NAMES = (
    "Hernández", "Martínez", "López", "Rivera", "Flores", "Ramírez", "Cruz",
    "Mejía", "Guzmán", "Romero", "Alvarado", "Portillo", "Aguilar", "Ayala",
    "Rodríguez", "Pérez", "Castillo", "Méndez", "Orellana", "Chávez",
)
DIAGNOSES = (
    "Caries oclusal en molares inferiores.",
    "Pulpitis irreversible en pieza 36.",
    "Gingivitis generalizada asociada a placa.",
    "Fractura coronal en incisivo central.",
    "Periodontitis crónica localizada.",
)
FINDINGS = ("caries", "obturado", "fractura", "sellante")
TEETH = (16, 17, 18, 26, 27, 36, 37, 46, 47, 11, 21, 14, 24)


def _mark_teeth(rng, plan_treatments, *, done_share=0.0, student=None, day=None):
    """Odontograma con hallazgos y tratamientos del plan (algunos hechos)."""
    teeth = default_tooth_findings()
    by_fdi = {tooth["fdi"]: tooth for tooth in teeth}
    for fdi in rng.sample(TEETH, rng.randint(1, 3)):
        status = rng.choice(FINDINGS)
        by_fdi[fdi]["marks"].append(
            {"layer": "hallazgo", "status": status, "surfaces": ["oclusal"]}
        )
    for treatment in rng.sample(plan_treatments, rng.randint(1, 3)):
        status = treatment.odontogram_status or None
        mark = {
            "layer": "hecho" if rng.random() < done_share else "plan",
            "status": status,
            "surfaces": ["oclusal"] if status in ("obturado", "sellante") else [],
            "treatment": treatment.slug,
        }
        if mark["layer"] == "hecho" and student is not None:
            # Como lo haría stamp_done_marks al guardar.
            mark.update(
                {
                    "doneBy": student.pk,
                    "doneByName": student.get_full_name() or student.username,
                    "doneAt": day.isoformat(),
                }
            )
        by_fdi[rng.choice(TEETH)]["marks"].append(mark)
    return teeth


class Command(BaseCommand):
    help = "Crea (o borra con --clear) pacientes ficticios DEMO- para probar el dashboard. Solo desarrollo."

    def add_arguments(self, parser):
        parser.add_argument("--clear", action="store_true", help="Borra los pacientes DEMO-.")
        parser.add_argument("--count", type=int, default=DEFAULT_COUNT)

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Comando no disponible en producción.")

        demo = Patient.objects.filter(dui__startswith=DEMO_PREFIX)
        if options["clear"]:
            deleted = demo.count()
            demo.delete()
            self.stdout.write(self.style.SUCCESS(f"Se borraron {deleted} pacientes demo."))
            return
        if demo.exists():
            raise CommandError("Ya hay pacientes demo. Bórralos antes con --clear.")

        students = list(User.objects.filter(role=User.Role.ESTUDIANTE, is_active=True))
        if not students:
            raise CommandError("No hay estudiantes activos. Corre antes seed_users.")
        docente = User.objects.filter(role=User.Role.DOCENTE, is_active=True).first()
        areas = list(ClinicalArea.objects.filter(is_active=True))
        treatments = list(
            ClinicalTreatment.objects.filter(is_active=True).select_related("area")
        )
        if not treatments:
            raise CommandError("El tarifario está vacío.")

        with transaction.atomic():
            created = self._create(options["count"], students, docente, areas, treatments)
        self.stdout.write(self.style.SUCCESS(f"Se crearon {created} pacientes demo."))

    def _create(self, count, students, docente, areas, treatments):
        rng = random.Random(2026)
        now = timezone.now()
        for index in range(count):
            registered = now - timedelta(days=rng.randint(0, 420), hours=rng.randint(0, 23))
            # ~40 % en el banco, ~45 % en proceso, ~15 % finalizados.
            roll = rng.random()
            state = "banco" if roll < 0.4 else "proceso" if roll < 0.85 else "finalizado"
            patient = Patient.objects.create(
                first_name=rng.choice(FIRST_NAMES),
                last_name=f"{rng.choice(LAST_NAMES)} {rng.choice(LAST_NAMES)}",
                dui=f"{DEMO_PREFIX}{index + 1:03d}",
                phone_number=f"7{rng.randint(0, 9999999):07d}",
                clinical_area=rng.choice(areas) if areas else None,
            )
            Patient.objects.filter(pk=patient.pk).update(created_at=registered)

            if state == "banco":
                Odontogram.objects.create(
                    patient=patient, teeth=_mark_teeth(rng, treatments)
                )
                continue

            student = rng.choice(students)
            assigned_at = min(registered + timedelta(days=rng.randint(0, 25)), now)
            assignment = Assignment.objects.create(
                patient=patient,
                student=student,
                status=(
                    Assignment.AssignmentStatus.ACTIVA
                    if state == "proceso"
                    else Assignment.AssignmentStatus.FINALIZADA
                ),
            )
            Assignment.objects.filter(pk=assignment.pk).update(created_at=assigned_at)
            if state == "finalizado":
                Patient.objects.filter(pk=patient.pk).update(
                    case_status=Patient.CaseStatus.FINALIZADO
                )

            Odontogram.objects.create(
                patient=patient,
                teeth=_mark_teeth(
                    rng,
                    treatments,
                    done_share=1.0 if state == "finalizado" else 0.4,
                    student=student,
                    day=timezone.localdate(assigned_at),
                ),
                updated_by=student,
            )
            validated = state == "finalizado" or rng.random() < 0.5
            Diagnostico.objects.create(
                patient=patient,
                student=student,
                content=rng.choice(DIAGNOSES),
                is_validated=validated and docente is not None,
                validated_by=docente if validated else None,
                validated_at=now if validated and docente else None,
            )

            if state == "proceso":
                # Una cita atendida en el pasado y otra próxima (algunas hoy).
                Appointment.objects.create(
                    assignment=assignment,
                    starts_at=assigned_at + timedelta(days=2, hours=9),
                    status=Appointment.Status.ATENDIDA,
                )
                days_ahead = rng.choice((0, 0, 1, 2, 3, 5, 6, 9, 12))
                # Horario de clínica en hora local, no UTC.
                starts_at = timezone.localtime(now + timedelta(days=days_ahead)).replace(
                    hour=rng.choice((8, 9, 10, 13, 14, 15)), minute=0, second=0, microsecond=0
                )
                if starts_at < now:
                    starts_at += timedelta(days=1)
                Appointment.objects.create(assignment=assignment, starts_at=starts_at)
        return count
