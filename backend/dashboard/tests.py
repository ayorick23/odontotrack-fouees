from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from accounts.services import sync_acl
from patients.models import Patient


class DashboardSummaryTests(APITestCase):
    def setUp(self):
        sync_acl()
        self.admin = User.objects.create_user(
            username="admin",
            password="pass12345",
            role=User.Role.ADMIN,
        )
        self.client.force_authenticate(user=self.admin)

    def test_summary_counts_patients_by_status(self):
        Patient.objects.create(
            first_name="Ana",
            last_name="Pendiente",
            document_id="PEND-001",
            case_status=Patient.CaseStatus.PENDIENTE,
        )
        Patient.objects.create(
            first_name="Luis",
            last_name="Asignado",
            document_id="PROC-001",
            case_status=Patient.CaseStatus.EN_PROCESO,
        )
        Patient.objects.create(
            first_name="María",
            last_name="Cerrada",
            document_id="FIN-001",
            case_status=Patient.CaseStatus.FINALIZADO,
        )

        response = self.client.get("/api/dashboard/summary/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["total_patients"], 3)
        self.assertEqual(body["patients_by_status"][Patient.CaseStatus.PENDIENTE], 1)
        self.assertEqual(body["patients_by_status"][Patient.CaseStatus.EN_PROCESO], 1)
        self.assertEqual(body["patients_by_status"][Patient.CaseStatus.FINALIZADO], 1)

    def test_summary_period_1m_excludes_older_patients(self):
        recent = Patient.objects.create(
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

        response = self.client.get("/api/dashboard/summary/", {"period": "1m"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["total_patients"], 1)
        self.assertEqual(recent.document_id, "REC-001")
