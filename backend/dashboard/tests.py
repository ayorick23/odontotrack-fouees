from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from accounts.services import sync_acl
from assignments.models import Assignment
from catalogs.models import ClinicalArea
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

    def _student(self):
        return User.objects.create_user(
            username="estudiante-espera",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
        )

    def test_summary_average_wait_until_first_assignment(self):
        student = self._student()
        waited = Patient.objects.create(
            first_name="Espera",
            last_name="Diez",
            dui="WAIT-001",
        )
        Patient.objects.filter(pk=waited.pk).update(
            created_at=timezone.now() - timedelta(days=10),
        )
        Patient.objects.create(first_name="Sin", last_name="Asignar", dui="WAIT-002")
        Assignment.objects.create(patient=waited, student=student, reason="")

        response = self.client.get("/api/dashboard/summary/", {"period": "1m"})
        self.assertEqual(response.json()["average_wait_days"], 10.0)

    def test_summary_without_assignments_has_no_wait(self):
        Patient.objects.create(first_name="Sin", last_name="Asignar", dui="WAIT-003")
        response = self.client.get("/api/dashboard/summary/")
        self.assertIsNone(response.json()["average_wait_days"])

    def test_summary_counts_assignments_of_the_period(self):
        student = self._student()
        Assignment.objects.create(
            patient=Patient.objects.create(first_name="A", last_name="B", dui="ASG-P-1"),
            student=student,
            reason="",
        )
        old = Assignment.objects.create(
            patient=Patient.objects.create(first_name="C", last_name="D", dui="ASG-P-2"),
            student=student,
            reason="",
        )
        Assignment.objects.filter(pk=old.pk).update(
            created_at=timezone.now() - timedelta(days=40),
        )

        response = self.client.get("/api/dashboard/summary/", {"period": "1m"})
        self.assertEqual(response.json()["total_assignments"], 1)


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

    def test_series_splits_patients_by_area_and_status(self):
        endo = ClinicalArea.objects.get(name="Endodoncia")
        for dui, case_status in (
            ("AREA-1", Patient.CaseStatus.PENDIENTE),
            ("AREA-2", Patient.CaseStatus.PENDIENTE),
            ("AREA-3", Patient.CaseStatus.FINALIZADO),
        ):
            self._patient(dui, clinical_area=endo, case_status=case_status)

        response = self.client.get("/api/dashboard/series/")
        by_area = response.json()["by_area"]
        self.assertEqual(
            by_area[0],
            {"area": "Endodoncia", "pendiente": 2, "en_proceso": 0, "finalizado": 1},
        )
        active_areas = ClinicalArea.objects.filter(is_active=True).count()
        self.assertEqual(len(by_area), active_areas)
