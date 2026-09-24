from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from accounts.services import sync_acl
from patients.models import Patient

from .models import Assignment


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
