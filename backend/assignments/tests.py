from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from accounts.models import User
from accounts.services import sync_acl
from clinical_records.models import Diagnostico
from patients.models import Patient

from .models import Assignment
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

    def test_create_requires_reason(self):
        response = self.client.post(
            self.url,
            {"patient": self.patient.id, "student": self.student.id},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reason", response.json())

    def test_create_rejects_invalid_priority(self):
        response = self.client.post(
            self.url,
            {
                "patient": self.patient.id,
                "student": self.student.id,
                "reason": "Dolor agudo",
                "priority": "urgente",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_returns_appointment_number_as_read_only(self):
        response = self.client.post(
            self.url,
            {
                "patient": self.patient.id,
                "student": self.student.id,
                "reason": "Dolor agudo",
                "priority": Assignment.Priority.ALTA,
                "appointment_number": 99,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertEqual(body["appointment_number"], 1)
        self.assertEqual(body["priority"], Assignment.Priority.ALTA)


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
