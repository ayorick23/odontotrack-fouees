from dataclasses import dataclass

from django.db.models import QuerySet

from accounts.models import User
from assignments.models import Assignment
from clinical_records.models import Diagnostico, EvolucionClinica, Tratamiento
from patients.models import Patient


@dataclass
class DashboardScope:
    """Querysets de base que puede contar el dashboard de un usuario."""

    patients: QuerySet
    assignments: QuerySet
    diagnoses: QuerySet
    treatments: QuerySet
    evolutions: QuerySet


def dashboard_scope_for(user: User) -> DashboardScope:
    """
    Alcance de los KPIs según quién pregunta (ODO-36). El mismo endpoint
    sirve a todos los roles; aquí solo cambia qué filas se cuentan:

    - Estudiante: solo sus casos (pacientes con una asignación suya, activa
      o finalizada). No cuenta los pacientes disponibles para elegir: no los
      atiende, solo los podría tomar.
    - Sin `clinical_records.view` (hoy recepción y soporte): los conteos
      clínicos salen en 0, porque el expediente no es su módulo. Se decide
      por permiso ACL y no por rol, igual que el resto del sistema.
    - Admin y docente: todo. No existe una relación docente-estudiante, así
      que "su supervisión" es hoy la facultad completa.
    """
    patients = Patient.objects.all()
    assignments = Assignment.objects.all()
    diagnoses = Diagnostico.objects.all()
    treatments = Tratamiento.objects.all()
    evolutions = EvolucionClinica.objects.all()

    if user.role == User.Role.ESTUDIANTE:
        assignments = assignments.filter(student=user)
        patients = patients.filter(id__in=assignments.values("patient_id"))
        diagnoses = diagnoses.filter(patient__in=patients)
        treatments = treatments.filter(patient__in=patients)
        evolutions = evolutions.filter(patient__in=patients)

    if not user.has_acl("clinical_records.view"):
        diagnoses = diagnoses.none()
        treatments = treatments.none()
        evolutions = evolutions.none()

    return DashboardScope(patients, assignments, diagnoses, treatments, evolutions)
