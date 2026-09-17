from django.conf import settings
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
