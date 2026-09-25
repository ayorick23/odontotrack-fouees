from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from accounts.models import Role, User
from accounts.services import sync_acl
from clinical_records.models import Diagnostico
from patients.models import Patient

from .models import Appointment, Assignment
from .services import can_transition, transition_case_status


class AssignmentModelTests(APITestCase):
    def setUp(self):
        sync_acl()
        self.student = User.objects.create_user(
            username="estudiante-asg",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
        )
        self.patient = Patient.objects.create(
            first_name="Ana",
            last_name="Casos",
            dui="ASG-CASO-001",
        )

    def test_appointment_number_is_sequential_per_patient(self):
        first = Assignment.objects.create(
            patient=self.patient,
            student=self.student,
            reason="Primera cita",
            status=Assignment.AssignmentStatus.FINALIZADA,
        )
        second = Assignment.objects.create(
            patient=self.patient,
            student=self.student,
            reason="Segunda cita",
        )
        self.assertEqual(first.appointment_number, 1)
        self.assertEqual(second.appointment_number, 2)

    def test_appointment_number_does_not_mix_between_patients(self):
        other_patient = Patient.objects.create(
            first_name="Luis",
            last_name="Otro",
            dui="ASG-CASO-002",
        )
        Assignment.objects.create(
            patient=self.patient, student=self.student, reason="Cita"
        )
        first_for_other = Assignment.objects.create(
            patient=other_patient, student=self.student, reason="Cita"
        )
        self.assertEqual(first_for_other.appointment_number, 1)

    def test_creating_active_assignment_moves_patient_to_en_proceso(self):
        self.assertEqual(self.patient.case_status, Patient.CaseStatus.PENDIENTE)
        Assignment.objects.create(
            patient=self.patient, student=self.student, reason="Cita"
        )
        self.patient.refresh_from_db()
        self.assertEqual(self.patient.case_status, Patient.CaseStatus.EN_PROCESO)

    def test_creating_cancelled_assignment_does_not_change_case_status(self):
        Assignment.objects.create(
            patient=self.patient,
            student=self.student,
            reason="Cita",
            status=Assignment.AssignmentStatus.CANCELADA,
        )
        self.patient.refresh_from_db()
        self.assertEqual(self.patient.case_status, Patient.CaseStatus.PENDIENTE)

    def test_does_not_downgrade_a_case_already_in_proceso_or_finalizado(self):
        self.patient.case_status = Patient.CaseStatus.FINALIZADO
        self.patient.save(update_fields=["case_status"])
        Assignment.objects.create(
            patient=self.patient, student=self.student, reason="Cita de control"
        )
        self.patient.refresh_from_db()
        self.assertEqual(self.patient.case_status, Patient.CaseStatus.FINALIZADO)


class AssignmentApiTests(APITestCase):
    def setUp(self):
        sync_acl()
        self.recepcion = User.objects.create_user(
            username="recepcion-asg",
            password="pass12345",
            role=User.Role.RECEPCION,
        )
        self.student = User.objects.create_user(
            username="estudiante-asg-api",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
        )
        self.patient = Patient.objects.create(
            first_name="Marta",
            last_name="Api",
            dui="ASG-API-001",
        )
        self.url = "/api/assignments/"
        self.client.force_authenticate(user=self.recepcion)

    def test_create_allows_empty_reason(self):
        response = self.client.post(
            self.url,
            {"patient": self.patient.id, "student": self.student.id},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["reason"], "")

    def test_create_returns_appointment_number_as_read_only(self):
        response = self.client.post(
            self.url,
            {
                "patient": self.patient.id,
                "student": self.student.id,
                "reason": "Dolor agudo",
                "appointment_number": 99,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["appointment_number"], 1)

    def test_create_rejects_patient_with_active_assignment(self):
        other = User.objects.create_user(
            username="estudiante-asg-otro",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
        )
        Assignment.objects.create(
            patient=self.patient, student=other, reason="Ya asignado"
        )
        response = self.client.post(
            self.url,
            {
                "patient": self.patient.id,
                "student": self.student.id,
                "reason": "Dolor agudo",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("patient", response.json())
        self.assertEqual(
            self.patient.assignments.filter(
                status=Assignment.AssignmentStatus.ACTIVA
            ).count(),
            1,
        )

    def test_create_reassigns_case_without_active_assignment(self):
        Assignment.objects.create(
            patient=self.patient,
            student=self.student,
            reason="Primera cita",
            status=Assignment.AssignmentStatus.CANCELADA,
        )
        self.patient.case_status = Patient.CaseStatus.EN_PROCESO
        self.patient.save(update_fields=["case_status"])
        response = self.client.post(
            self.url,
            {
                "patient": self.patient.id,
                "student": self.student.id,
                "reason": "Cambio de estudiante",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["appointment_number"], 2)

    def test_create_only_assigns_students(self):
        docente = User.objects.create_user(
            username="docente-asg",
            password="pass12345",
            role=User.Role.DOCENTE,
        )
        response = self.client.post(
            self.url,
            {
                "patient": self.patient.id,
                "student": docente.id,
                "reason": "Dolor agudo",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("student", response.json())
        self.assertFalse(self.patient.has_active_assignment())


class ClaimAvailablePatientTests(APITestCase):
    def setUp(self):
        sync_acl()
        self.student = User.objects.create_user(
            username="estudiante-claim",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
        )
        self.other = User.objects.create_user(
            username="estudiante-claim-otro",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
        )
        self.recepcion = User.objects.create_user(
            username="recepcion-claim",
            password="pass12345",
            role=User.Role.RECEPCION,
        )
        self.patient = Patient.objects.create(
            first_name="Ana",
            last_name="Disponible",
            dui="CLAIM-001",
        )
        self.url = "/api/assignments/claim/"

    def _second_patient(self):
        return Patient.objects.create(
            first_name="Luis",
            last_name="Disponible",
            dui="CLAIM-002",
        )

    def test_student_claims_available_patient_and_opens_case(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            self.url,
            {"patients": [self.patient.id], "reason": "Dolor en molar"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        [body] = response.json()
        self.assertEqual(body["student"], self.student.id)
        self.assertEqual(body["appointment_number"], 1)
        self.patient.refresh_from_db()
        self.assertEqual(self.patient.case_status, Patient.CaseStatus.EN_PROCESO)
        self.assertTrue(self.patient.has_active_assignment())

    def test_student_claims_several_patients_at_once(self):
        second = self._second_patient()
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            self.url,
            {"patients": [self.patient.id, second.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            [row["patient"] for row in response.json()],
            [self.patient.id, second.id],
        )
        self.assertEqual(Assignment.objects.filter(student=self.student).count(), 2)

    def test_claim_allows_empty_reason(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            self.url,
            {"patients": [self.patient.id], "reason": "   "},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()[0]["reason"], "")

    def test_cannot_claim_a_patient_already_taken(self):
        Assignment.objects.create(
            patient=self.patient,
            student=self.other,
            reason="Ya asignado",
        )
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            self.url,
            {"patients": [self.patient.id], "reason": "Quiero este caso"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Assignment.objects.filter(student=self.student).count(), 0)

    def test_claim_is_all_or_nothing(self):
        second = self._second_patient()
        Assignment.objects.create(patient=second, student=self.other, reason="")
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            self.url,
            {"patients": [self.patient.id, second.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Luis Disponible", response.json()["patient"])
        self.assertFalse(self.patient.has_active_assignment())

    def test_recepcion_cannot_claim(self):
        self.client.force_authenticate(user=self.recepcion)
        response = self.client.post(
            self.url,
            {"patients": [self.patient.id], "reason": "Desde recepción"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_recepcion_assigns_several_patients_to_a_student(self):
        second = self._second_patient()
        self.client.force_authenticate(user=self.recepcion)
        response = self.client.post(
            "/api/assignments/assign/",
            {"patients": [self.patient.id, second.id], "student": self.student.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            {row["student"] for row in response.json()},
            {self.student.id},
        )
        self.assertEqual(Assignment.objects.filter(student=self.student).count(), 2)

    def test_student_cannot_assign_to_others(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            "/api/assignments/",
            {
                "patient": self.patient.id,
                "student": self.other.id,
                "reason": "Asignar a otro",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        response = self.client.post(
            "/api/assignments/assign/",
            {"patients": [self.patient.id], "student": self.other.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class AssignableStudentsTests(APITestCase):
    def setUp(self):
        sync_acl()
        self.recepcion = User.objects.create_user(
            username="recepcion-combo",
            password="pass12345",
            role=User.Role.RECEPCION,
        )
        self.maria = User.objects.create_user(
            username="mlopez",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
            first_name="Maria",
            last_name="Lopez",
        )
        self.jose = User.objects.create_user(
            username="jramirez",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
            first_name="Jose",
            last_name="Ramirez",
        )
        User.objects.create_user(
            username="inactivo",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
            first_name="Maria",
            last_name="Inactiva",
            is_active=False,
        )
        User.objects.create_user(
            username="docente-combo",
            password="pass12345",
            role=User.Role.DOCENTE,
            first_name="Maria",
            last_name="Docente",
        )
        patient = Patient.objects.create(
            first_name="Ana",
            last_name="Carga",
            dui="COMBO-001",
        )
        Assignment.objects.create(patient=patient, student=self.maria, reason="Cita")
        self.url = "/api/assignments/students/"

    def test_lists_active_students_with_their_load(self):
        self.client.force_authenticate(user=self.recepcion)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json(),
            [
                {"id": self.maria.id, "name": "Maria Lopez", "active_cases": 1},
                {"id": self.jose.id, "name": "Jose Ramirez", "active_cases": 0},
            ],
        )

    def test_search_matches_every_term(self):
        self.client.force_authenticate(user=self.recepcion)
        response = self.client.get(self.url, {"search": "mar lop"})
        self.assertEqual(
            [row["id"] for row in response.json()],
            [self.maria.id],
        )

    def test_student_cannot_list_assignable_students(self):
        self.client.force_authenticate(user=self.jose)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class CaseTransitionTests(APITestCase):
    def setUp(self):
        sync_acl()
        self.admin = User.objects.create_user(
            username="admin-casos",
            password="pass12345",
            role=User.Role.ADMIN,
        )
        self.docente = User.objects.create_user(
            username="docente-casos",
            password="pass12345",
            role=User.Role.DOCENTE,
        )
        self.recepcion = User.objects.create_user(
            username="recepcion-casos",
            password="pass12345",
            role=User.Role.RECEPCION,
        )
        self.student = User.objects.create_user(
            username="estudiante-casos",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
        )
        self.patient = Patient.objects.create(
            first_name="Rosa",
            last_name="Transicion",
            dui="ASG-TRANS-001",
        )
        self.assignment = Assignment.objects.create(
            patient=self.patient, student=self.student, reason="Cita"
        )
        self.finalize_url = f"/api/assignments/{self.assignment.id}/finalize/"

    def _validated_diagnosis(self):
        return Diagnostico.objects.create(
            patient=self.patient,
            student=self.student,
            content="Caries en 16.",
            is_validated=True,
            validated_by=self.docente,
        )

    def test_only_forward_transitions_are_allowed(self):
        pendiente = Patient.CaseStatus.PENDIENTE
        en_proceso = Patient.CaseStatus.EN_PROCESO
        finalizado = Patient.CaseStatus.FINALIZADO
        self.assertTrue(can_transition(pendiente, en_proceso))
        self.assertTrue(can_transition(en_proceso, finalizado))
        self.assertFalse(can_transition(pendiente, finalizado))
        self.assertFalse(can_transition(en_proceso, pendiente))
        self.assertFalse(can_transition(finalizado, en_proceso))

    def test_transition_case_status_rejects_invalid_jump(self):
        other = Patient.objects.create(
            first_name="Sin",
            last_name="Asignar",
            dui="ASG-TRANS-002",
        )
        with self.assertRaises(ValidationError):
            transition_case_status(other, Patient.CaseStatus.FINALIZADO)
        other.refresh_from_db()
        self.assertEqual(other.case_status, Patient.CaseStatus.PENDIENTE)

    def test_cannot_finalize_without_validated_diagnosis(self):
        Diagnostico.objects.create(
            patient=self.patient,
            student=self.student,
            content="Sin validar.",
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.finalize_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assignment.refresh_from_db()
        self.patient.refresh_from_db()
        self.assertEqual(self.assignment.status, Assignment.AssignmentStatus.ACTIVA)
        self.assertEqual(self.patient.case_status, Patient.CaseStatus.EN_PROCESO)

    def test_finalize_with_validated_diagnosis_closes_case(self):
        self._validated_diagnosis()
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.finalize_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["status"], Assignment.AssignmentStatus.FINALIZADA)
        self.patient.refresh_from_db()
        self.assertEqual(self.patient.case_status, Patient.CaseStatus.FINALIZADO)

    def test_cannot_finalize_twice(self):
        self._validated_diagnosis()
        self.client.force_authenticate(user=self.admin)
        self.client.post(self.finalize_url)
        response = self.client.post(self.finalize_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_role_without_change_status_cannot_finalize(self):
        self._validated_diagnosis()
        self.client.force_authenticate(user=self.recepcion)
        response = self.client.post(self.finalize_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_status_cannot_be_changed_by_patch(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/assignments/{self.assignment.id}/",
            {"status": Assignment.AssignmentStatus.FINALIZADA},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assignment.refresh_from_db()
        self.assertEqual(self.assignment.status, Assignment.AssignmentStatus.ACTIVA)


class AppointmentApiTests(APITestCase):
    url = "/api/appointments/"

    def setUp(self):
        sync_acl()
        self.admin = self._user("admin-citas", User.Role.ADMIN)
        self.recepcion = self._user("recepcion-citas", User.Role.RECEPCION)
        self.docente = self._user("docente-citas", User.Role.DOCENTE)
        self.maria = self._user("maria-citas", User.Role.ESTUDIANTE)
        self.jose = self._user("jose-citas", User.Role.ESTUDIANTE)
        self.case_maria = self._assign("CITA-1", self.maria)
        self.other_case_maria = self._assign("CITA-2", self.maria)
        self.case_jose = self._assign("CITA-3", self.jose)
        tomorrow = timezone.localtime() + timedelta(days=1)
        self.ten = tomorrow.replace(hour=10, minute=0, second=0, microsecond=0)

    def _user(self, username, role):
        return User.objects.create_user(username=username, password="pass12345", role=role)

    def _assign(self, dui, student):
        patient = Patient.objects.create(first_name="Paciente", last_name=dui, dui=dui)
        return Assignment.objects.create(patient=patient, student=student, reason="")

    def _schedule(self, user, assignment, starts_at, duration=60):
        self.client.force_authenticate(user=user)
        return self.client.post(
            self.url,
            {
                "assignment": assignment.id,
                "starts_at": starts_at.isoformat(),
                "duration_minutes": duration,
            },
            format="json",
        )

    def test_recepcion_schedules_an_appointment(self):
        response = self._schedule(self.recepcion, self.case_maria, self.ten)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertEqual(body["patient"]["name"], "Paciente CITA-1")
        self.assertEqual(body["student"]["id"], self.maria.id)
        self.assertEqual(body["status"], Appointment.Status.PROGRAMADA)

    def test_student_cannot_have_two_overlapping_appointments(self):
        self._schedule(self.recepcion, self.case_maria, self.ten)
        response = self._schedule(
            self.recepcion, self.other_case_maria, self.ten + timedelta(minutes=30)
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ya tiene una cita", response.json()["starts_at"])

    def test_back_to_back_appointments_are_allowed(self):
        self._schedule(self.recepcion, self.case_maria, self.ten)
        response = self._schedule(
            self.recepcion, self.other_case_maria, self.ten + timedelta(hours=1)
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_cannot_schedule_in_the_past(self):
        response = self._schedule(
            self.recepcion, self.case_maria, timezone.now() - timedelta(hours=1)
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("starts_at", response.json())

    def test_cannot_schedule_on_an_inactive_assignment(self):
        self.case_maria.status = Assignment.AssignmentStatus.CANCELADA
        self.case_maria.save(update_fields=["status"])
        response = self._schedule(self.recepcion, self.case_maria, self.ten)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("assignment", response.json())

    def test_view_permission_alone_cannot_schedule(self):
        response = self._schedule(self.docente, self.case_maria, self.ten)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_student_sees_only_appointments_of_own_cases(self):
        self._schedule(self.recepcion, self.case_maria, self.ten)
        self._schedule(self.recepcion, self.case_jose, self.ten)
        self.client.force_authenticate(user=self.maria)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [row["student"]["id"] for row in response.json()],
            [self.maria.id],
        )

    def test_list_only_returns_the_visible_range(self):
        self._schedule(self.recepcion, self.case_maria, self.ten)
        self._schedule(self.recepcion, self.case_jose, self.ten + timedelta(days=10))
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            self.url,
            {
                "start": (self.ten - timedelta(days=1)).isoformat(),
                "end": (self.ten + timedelta(days=1)).isoformat(),
            },
        )
        self.assertEqual(len(response.json()), 1)

    def test_permission_decides_even_for_students(self):
        # Con calendar.create, el estudiante agenda, pero solo en sus casos.
        Role.objects.get(slug="estudiante").permissions.add(
            *Role.objects.get(slug="admin").permissions.filter(name="calendar.create")
        )
        own = self._schedule(self.maria, self.case_maria, self.ten)
        other = self._schedule(self.maria, self.case_jose, self.ten)
        self.assertEqual(own.status_code, status.HTTP_201_CREATED)
        self.assertEqual(other.status_code, status.HTTP_400_BAD_REQUEST)

    def test_editing_requires_the_edit_permission(self):
        appointment_id = self._schedule(self.recepcion, self.case_maria, self.ten).json()["id"]
        response = self.client.patch(
            f"{self.url}{appointment_id}/",
            {"starts_at": (self.ten + timedelta(hours=2)).isoformat()},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_reschedule_then_cancel_frees_the_slot(self):
        appointment_id = self._schedule(self.admin, self.case_maria, self.ten).json()["id"]
        later = self.ten + timedelta(hours=2)
        moved = self.client.patch(
            f"{self.url}{appointment_id}/",
            {"starts_at": later.isoformat(), "duration_minutes": 30},
            format="json",
        )
        self.assertEqual(moved.status_code, status.HTTP_200_OK)
        self.assertEqual(moved.json()["duration_minutes"], 30)

        cancelled = self.client.post(
            f"{self.url}{appointment_id}/status/", {"status": "cancelada"}, format="json"
        )
        self.assertEqual(cancelled.json()["status"], Appointment.Status.CANCELADA)
        again = self.client.patch(
            f"{self.url}{appointment_id}/", {"notes": "tarde"}, format="json"
        )
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)
        reused = self._schedule(self.admin, self.other_case_maria, later)
        self.assertEqual(reused.status_code, status.HTTP_201_CREATED)

    def test_schedulable_lists_active_cases_with_search(self):
        self.client.force_authenticate(user=self.recepcion)
        everyone = self.client.get(f"{self.url}schedulable/")
        self.assertEqual(len(everyone.json()), 3)
        found = self.client.get(f"{self.url}schedulable/", {"search": "cita-3"})
        self.assertEqual([row["id"] for row in found.json()], [self.case_jose.id])
