from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from assignments.models import Assignment
from patients.models import Patient

PAGE_SIZE = settings.REST_FRAMEWORK["PAGE_SIZE"]


class ListingPaginationTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin",
            password="pass12345",
            role=User.Role.ADMIN,
        )
        self.client.force_authenticate(user=self.admin)

    def _assert_paginated_list(self, url, expected_count):
        first_page = self.client.get(url)
        self.assertEqual(first_page.status_code, status.HTTP_200_OK)
        body = first_page.json()
        self.assertEqual(body["count"], expected_count)
        self.assertEqual(len(body["results"]), PAGE_SIZE)
        self.assertIsNotNone(body["next"])
        self.assertIn("page=2", body["next"])

        second_page = self.client.get(url, {"page": 2})
        self.assertEqual(second_page.status_code, status.HTTP_200_OK)
        second_body = second_page.json()
        self.assertEqual(len(second_body["results"]), expected_count - PAGE_SIZE)
        self.assertIsNone(second_body["next"])
        self.assertIsNotNone(second_body["previous"])

    def test_patients_list_respects_page_query(self):
        for index in range(PAGE_SIZE + 1):
            Patient.objects.create(
                first_name="Ana",
                last_name=f"Paciente{index:02d}",
                document_id=f"DUI{index:03d}",
            )
        self._assert_paginated_list("/api/patients/", expected_count=PAGE_SIZE + 1)

    def test_users_list_respects_page_query(self):
        for index in range(PAGE_SIZE):
            User.objects.create_user(
                username=f"estudiante{index:02d}",
                password="pass12345",
                role=User.Role.ESTUDIANTE,
            )
        self._assert_paginated_list("/api/accounts/users/", expected_count=PAGE_SIZE + 1)

    def test_assignments_list_respects_page_query(self):
        student = User.objects.create_user(
            username="estudiante",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
        )
        for index in range(PAGE_SIZE + 1):
            patient = Patient.objects.create(
                first_name="Luis",
                last_name=f"Caso{index:02d}",
                document_id=f"ASG{index:03d}",
            )
            Assignment.objects.create(patient=patient, student=student)
        self._assert_paginated_list("/api/assignments/", expected_count=PAGE_SIZE + 1)


class PatientDirectoryTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin",
            password="pass12345",
            role=User.Role.ADMIN,
        )
        self.client.force_authenticate(user=self.admin)

    def test_search_matches_last_name_and_document(self):
        Patient.objects.create(
            first_name="María",
            last_name="Gómez",
            document_id="01234567-8",
        )
        Patient.objects.create(
            first_name="Luis",
            last_name="Pérez",
            document_id="99999999-9",
        )

        by_name = self.client.get("/api/patients/", {"search": "Gómez"})
        self.assertEqual(by_name.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [row["last_name"] for row in by_name.json()["results"]],
            ["Gómez"],
        )

        by_document = self.client.get("/api/patients/", {"search": "99999999-9"})
        self.assertEqual(by_document.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [row["document_id"] for row in by_document.json()["results"]],
            ["99999999-9"],
        )

    def test_filter_by_case_status(self):
        Patient.objects.create(
            first_name="Ana",
            last_name="Pendiente",
            document_id="PEND-001",
            case_status=Patient.CaseStatus.PENDIENTE,
        )
        Patient.objects.create(
            first_name="Luis",
            last_name="Cerrado",
            document_id="FIN-001",
            case_status=Patient.CaseStatus.FINALIZADO,
        )

        response = self.client.get(
            "/api/patients/",
            {"case_status": Patient.CaseStatus.FINALIZADO},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["count"], 1)
        self.assertEqual(body["results"][0]["document_id"], "FIN-001")

    def test_list_is_ordered_by_id(self):
        Patient.objects.create(
            first_name="Zaira",
            last_name="Zelaya",
            document_id="ZEL-001",
        )
        Patient.objects.create(
            first_name="Ana",
            last_name="Ábrego",
            document_id="ABR-001",
        )

        response = self.client.get("/api/patients/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in response.json()["results"]]
        self.assertEqual(ids, sorted(ids))

    def test_list_period_1m_excludes_older_patients(self):
        Patient.objects.create(
            first_name="Reciente",
            last_name="Hoy",
            document_id="REC-001",
        )
        old = Patient.objects.create(
            first_name="Antigua",
            last_name="Año",
            document_id="OLD-001",
        )
        Patient.objects.filter(pk=old.pk).update(
            created_at=timezone.now() - timedelta(days=40),
        )

        response = self.client.get("/api/patients/", {"period": "1m"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["count"], 1)
        self.assertEqual(body["results"][0]["document_id"], "REC-001")

    def test_list_includes_active_assignment_name(self):
        student = User.objects.create_user(
            username="estudiante",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
            first_name="Ana",
            last_name="López",
        )
        patient = Patient.objects.create(
            first_name="Carlos",
            last_name="Ruiz",
            document_id="ASG-001",
        )
        Assignment.objects.create(patient=patient, student=student)

        response = self.client.get("/api/patients/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = response.json()["results"][0]
        self.assertEqual(row["assigned_to"], "Ana López")
        self.assertNotIn("address", row)


class RecepcionPatientPermissionTests(APITestCase):
    def setUp(self):
        self.recepcion = User.objects.create_user(
            username="recepcion",
            password="pass12345",
            role=User.Role.RECEPCION,
        )
        self.admin = User.objects.create_user(
            username="admin",
            password="pass12345",
            role=User.Role.ADMIN,
        )
        self.student = User.objects.create_user(
            username="estudiante",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
        )
        self.unassigned = Patient.objects.create(
            first_name="Ana",
            last_name="Libre",
            document_id="LIB-001",
        )
        self.assigned = Patient.objects.create(
            first_name="Luis",
            last_name="Asignado",
            document_id="ASG-002",
        )
        Assignment.objects.create(patient=self.assigned, student=self.student)
        self.client.force_authenticate(user=self.recepcion)

    def test_recepcion_can_edit_unassigned_patient(self):
        response = self.client.patch(
            f"/api/patients/{self.unassigned.id}/",
            {"phone_number": "7777-7777"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.unassigned.refresh_from_db()
        self.assertEqual(self.unassigned.phone_number, "7777-7777")

    def test_recepcion_cannot_edit_assigned_patient(self):
        response = self.client.patch(
            f"/api/patients/{self.assigned.id}/",
            {"phone_number": "7777-7777"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("asignados", str(response.data).lower())

    def test_admin_can_edit_assigned_patient(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/patients/{self.assigned.id}/",
            {"phone_number": "7000-0000"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
