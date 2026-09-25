from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from accounts.services import sync_acl
from assignments.models import Assignment
from clinical_records.models import Diagnostico
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
            dui="PEND-001",
            case_status=Patient.CaseStatus.PENDIENTE,
        )
        Patient.objects.create(
            first_name="Luis",
            last_name="Asignado",
            dui="PROC-001",
            case_status=Patient.CaseStatus.EN_PROCESO,
        )
        Patient.objects.create(
            first_name="María",
            last_name="Cerrada",
            dui="FIN-001",
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
            dui="REC-001",
        )
        old = Patient.objects.create(
            first_name="Antigua",
            last_name="Año",
            dui="OLD-001",
        )
        Patient.objects.filter(pk=old.pk).update(
            created_at=timezone.now() - timedelta(days=40),
        )

        response = self.client.get("/api/dashboard/summary/", {"period": "1m"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["total_patients"], 1)
        self.assertEqual(recent.dui, "REC-001")

    def test_summary_counts_diagnoses_pending_validation(self):
        student = User.objects.create_user(
            username="estudiante-diag",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
        )
        patient = Patient.objects.create(
            first_name="Rosa",
            last_name="Diagnostico",
            dui="DIAG-001",
        )
        Diagnostico.objects.create(patient=patient, student=student, content="Caries")
        Diagnostico.objects.create(
            patient=patient,
            student=student,
            content="Gingivitis",
            is_validated=True,
        )

        response = self.client.get("/api/dashboard/summary/", {"period": "1m"})
        self.assertEqual(response.json()["pending_validations"], 1)


class DashboardSeriesTests(APITestCase):
    def setUp(self):
        sync_acl()
        self.admin = User.objects.create_user(
            username="admin-series",
            password="pass12345",
            role=User.Role.ADMIN,
        )
        self.student = User.objects.create_user(
            username="estudiante-series",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
        )
        self.client.force_authenticate(user=self.admin)

    def _patient(self, dui, **fields):
        return Patient.objects.create(
            first_name="Paciente",
            last_name=dui,
            dui=dui,
            **fields,
        )

    def test_series_groups_patients_and_assignments_by_month(self):
        recent = self._patient("SER-REC-001")
        old = self._patient("SER-OLD-001")
        Patient.objects.filter(pk=old.pk).update(
            created_at=timezone.now() - timedelta(days=40),
        )
        Assignment.objects.create(patient=recent, student=self.student, reason="")

        response = self.client.get("/api/dashboard/series/", {"period": "1m"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        months = {row["month"]: row for row in response.json()["months"]}
        this_month = timezone.localdate().replace(day=1).isoformat()[:7]
        self.assertEqual(months[this_month]["patients"], 1)
        self.assertEqual(months[this_month]["assignments"], 1)
        self.assertTrue(all("label" in row for row in months.values()))

    def test_series_without_period_covers_all_history(self):
        old = self._patient("SER-HIST-001")
        Patient.objects.filter(pk=old.pk).update(
            created_at=timezone.now() - timedelta(days=800),
        )

        response = self.client.get("/api/dashboard/series/")
        months = response.json()["months"]
        self.assertGreaterEqual(len(months), 26)
        self.assertEqual(sum(row["patients"] for row in months), 1)
        self.assertEqual(
            months[-1]["month"],
            timezone.localdate().replace(day=1).isoformat()[:7],
        )

    def test_series_without_data_has_only_current_month(self):
        response = self.client.get("/api/dashboard/series/")
        self.assertEqual(len(response.json()["months"]), 1)
