from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from accounts.services import sync_acl
from assignments.models import Assignment
from clinical_records.models import Diagnostico, EvolucionClinica, Odontogram
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

    def test_series_groups_patients_and_assignments_by_month(self):
        recent = Patient.objects.create(
            first_name="Reciente",
            last_name="Hoy",
            dui="SER-REC-001",
            case_status=Patient.CaseStatus.PENDIENTE,
        )
        old = Patient.objects.create(
            first_name="Antigua",
            last_name="Año",
            dui="SER-OLD-001",
            case_status=Patient.CaseStatus.FINALIZADO,
        )
        Patient.objects.filter(pk=old.pk).update(
            created_at=timezone.now() - timedelta(days=40),
        )
        Assignment.objects.create(
            patient=recent,
            student=self.student,
            reason="Control de caries",
        )

        response = self.client.get("/api/dashboard/series/", {"period": "1m"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()

        months = {row["month"]: row for row in body["months"]}
        this_month = timezone.localdate().replace(day=1).isoformat()[:7]
        self.assertIn(this_month, months)
        self.assertEqual(months[this_month]["patients"], 1)
        self.assertEqual(months[this_month][Patient.CaseStatus.PENDIENTE], 0)
        self.assertEqual(months[this_month][Patient.CaseStatus.EN_PROCESO], 1)
        self.assertEqual(months[this_month][Patient.CaseStatus.FINALIZADO], 0)
        self.assertEqual(months[this_month]["assignments"], 1)
        self.assertTrue(all("label" in row for row in body["months"]))

        by_status = {row["status"]: row["count"] for row in body["by_status"]}
        self.assertEqual(by_status[Patient.CaseStatus.PENDIENTE], 0)
        self.assertEqual(by_status[Patient.CaseStatus.EN_PROCESO], 1)
        self.assertEqual(by_status[Patient.CaseStatus.FINALIZADO], 0)

    def test_series_without_period_covers_last_year(self):
        response = self.client.get("/api/dashboard/series/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        months = response.json()["months"]
        self.assertGreaterEqual(len(months), 12)
        self.assertLessEqual(len(months), 13)
        self.assertEqual(
            months[-1]["month"],
            timezone.localdate().replace(day=1).isoformat()[:7],
        )


class DashboardRoleScopeTests(APITestCase):
    """ODO-36: el mismo endpoint cuenta distinto según quién pregunta."""

    def setUp(self):
        sync_acl()
        self.admin = self._user("admin", User.Role.ADMIN)
        self.docente = self._user("docente", User.Role.DOCENTE)
        self.recepcion = self._user("recepcion", User.Role.RECEPCION)
        self.student = self._user("est1", User.Role.ESTUDIANTE)
        other_student = self._user("est2", User.Role.ESTUDIANTE)

        mine_active = self._patient("MINE-ACT")
        mine_done = self._patient("MINE-FIN", Patient.CaseStatus.FINALIZADO)
        others = self._patient("OTHER-ACT")
        self._patient("FREE-001")  # disponible, sin asignación

        Assignment.objects.create(patient=mine_active, student=self.student)
        Assignment.objects.create(
            patient=mine_done,
            student=self.student,
            status=Assignment.AssignmentStatus.FINALIZADA,
        )
        Assignment.objects.create(patient=others, student=other_student)

        Diagnostico.objects.create(
            patient=mine_active, student=self.student, content="Caries en 16."
        )
        Diagnostico.objects.create(
            patient=others, student=other_student, content="Fractura en 21."
        )

    def _user(self, username, role):
        return User.objects.create_user(
            username=username, password="pass12345", role=role
        )

    def _patient(self, dui, case_status=Patient.CaseStatus.PENDIENTE):
        return Patient.objects.create(
            first_name="Paciente", last_name=dui, dui=dui, case_status=case_status
        )

    def _summary(self, user):
        self.client.force_authenticate(user=user)
        response = self.client.get("/api/dashboard/summary/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.json()

    def test_admin_and_docente_see_everything(self):
        for user in (self.admin, self.docente):
            with self.subTest(role=user.role):
                body = self._summary(user)
                self.assertEqual(body["total_patients"], 4)
                self.assertEqual(body["total_assignments"], 3)
                self.assertEqual(body["total_clinical_records"], 2)

    def test_student_sees_only_own_cases(self):
        body = self._summary(self.student)
        self.assertEqual(body["total_patients"], 2)
        self.assertEqual(body["total_assignments"], 2)
        self.assertEqual(body["total_clinical_records"], 1)
        # Los disponibles (pendientes sin asignar) no cuentan como suyos.
        self.assertEqual(
            body["patients_by_status"],
            {Patient.CaseStatus.EN_PROCESO: 1, Patient.CaseStatus.FINALIZADO: 1},
        )

    def test_recepcion_sees_registration_volume_without_clinical(self):
        body = self._summary(self.recepcion)
        self.assertEqual(body["total_patients"], 4)
        self.assertEqual(body["total_assignments"], 3)
        self.assertEqual(body["total_clinical_records"], 0)

    def test_series_are_scoped_for_student(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.get("/api/dashboard/series/", {"period": "1m"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(sum(row["count"] for row in body["by_status"]), 2)
        self.assertEqual(sum(month["assignments"] for month in body["months"]), 2)


class DashboardIndicatorsTests(APITestCase):
    """ODO-37: fórmulas de los indicadores y su alcance por rol."""

    URL = "/api/dashboard/indicators/"

    def setUp(self):
        sync_acl()
        self.admin = self._user("admin", User.Role.ADMIN)
        self.docente = self._user("docente", User.Role.DOCENTE)
        self.recepcion = self._user("recepcion", User.Role.RECEPCION)
        self.student = self._user("est1", User.Role.ESTUDIANTE)
        other = self._user("est2", User.Role.ESTUDIANTE)
        en_proceso = Patient.CaseStatus.EN_PROCESO

        # A: caso del estudiante con diagnóstico validado.
        a = self._patient("A", en_proceso)
        Assignment.objects.create(patient=a, student=self.student)
        Diagnostico.objects.create(
            patient=a, student=self.student, content="Caries.", is_validated=True
        )
        # B: caso de otro estudiante con diagnóstico sin validar.
        b = self._patient("B", en_proceso)
        Assignment.objects.create(patient=b, student=other)
        Diagnostico.objects.create(patient=b, student=other, content="Fractura.")
        # C: caso finalizado del estudiante, solo con evolución.
        c = self._patient("C", Patient.CaseStatus.FINALIZADO)
        Assignment.objects.create(
            patient=c,
            student=self.student,
            status=Assignment.AssignmentStatus.FINALIZADA,
        )
        EvolucionClinica.objects.create(
            patient=c, student=self.student, date=timezone.localdate(), note="Ok."
        )
        # D: odontograma guardado. E: odontograma solo abierto. F: nada.
        d = self._patient("D")
        Odontogram.objects.create(patient=d, updated_by=self.docente)
        e = self._patient("E")
        Odontogram.objects.create(patient=e)
        self._patient("F")

    def _user(self, username, role):
        return User.objects.create_user(
            username=username, password="pass12345", role=role
        )

    def _patient(self, dui, case_status=Patient.CaseStatus.PENDIENTE):
        return Patient.objects.create(
            first_name="Paciente", last_name=dui, dui=dui, case_status=case_status
        )

    def _indicators(self, user):
        self.client.force_authenticate(user=user)
        response = self.client.get(self.URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.json()

    def test_formulas_for_admin(self):
        body = self._indicators(self.admin)
        # A, B, C y D tienen expediente; E solo abrió el odontograma.
        self.assertEqual(
            body["digitalization"], {"percent": 66.7, "count": 4, "total": 6}
        )
        self.assertEqual(
            body["validated_diagnoses"], {"percent": 50.0, "count": 1, "total": 2}
        )
        # Casos en proceso o finalizados: A, B y C; solo A tiene validado.
        self.assertEqual(
            body["cases_with_validated_diagnosis"],
            {"percent": 33.3, "count": 1, "total": 3},
        )

    def test_student_indicators_cover_only_own_cases(self):
        body = self._indicators(self.student)
        self.assertEqual(
            body["digitalization"], {"percent": 100.0, "count": 2, "total": 2}
        )
        self.assertEqual(
            body["validated_diagnoses"], {"percent": 100.0, "count": 1, "total": 1}
        )
        self.assertEqual(
            body["cases_with_validated_diagnosis"],
            {"percent": 50.0, "count": 1, "total": 2},
        )

    def test_recepcion_gets_no_clinical_indicators(self):
        body = self._indicators(self.recepcion)
        self.assertEqual(
            body,
            {
                "digitalization": None,
                "validated_diagnoses": None,
                "cases_with_validated_diagnosis": None,
            },
        )

    def test_percent_is_none_without_base(self):
        newcomer = self._user("est3", User.Role.ESTUDIANTE)
        body = self._indicators(newcomer)
        self.assertEqual(
            body["digitalization"], {"percent": None, "count": 0, "total": 0}
        )



class DashboardOverviewTests(APITestCase):
    """Dashboard por rol: cada bloque sale según los permisos ACL."""

    URL = "/api/dashboard/overview/"
    BLOCKS = ("my_cases", "supervision", "bank", "faculty", "accounts")

    def setUp(self):
        from assignments.models import Appointment
        from catalogs.models import ClinicalTreatment

        sync_acl()
        self.student = self._user("est-ov", User.Role.ESTUDIANTE, "Lucía", "Zepeda")
        self.other = self._user("est-ov-2", User.Role.ESTUDIANTE, "Mario", "Ruiz")

        # Caso activo con cita en 2 días y otro sin cita.
        self.soon = Patient.objects.create(first_name="Ana", last_name="Pronto", dui="OV-1")
        self.later = Patient.objects.create(first_name="Beto", last_name="Sincita", dui="OV-2")
        soon_assignment = Assignment.objects.create(patient=self.soon, student=self.student)
        Assignment.objects.create(patient=self.later, student=self.student)
        now = timezone.now()
        Appointment.objects.create(assignment=soon_assignment, starts_at=now + timedelta(days=2))
        # Fuera de los 7 días: cuenta como próxima cita del caso, no en la semana.
        Appointment.objects.create(assignment=soon_assignment, starts_at=now + timedelta(days=20))
        Diagnostico.objects.create(patient=self.soon, student=self.student, content="Caries.")
        Diagnostico.objects.create(
            patient=self.soon, student=self.student, content="Ok.", is_validated=True
        )
        # Lo del otro estudiante no cuenta como suyo.
        others = Patient.objects.create(first_name="Otro", last_name="Caso", dui="OV-3")
        Assignment.objects.create(patient=others, student=self.other)
        Diagnostico.objects.create(patient=others, student=self.other, content="X.")
        Odontogram.objects.create(
            patient=self.soon,
            teeth=[
                {"fdi": 16, "marks": [
                    {"layer": "hecho", "status": "obturado", "surfaces": ["oclusal"],
                     "treatment": "resina", "doneBy": self.student.pk},
                    # Lo hizo otro: no cuenta para ella.
                    {"layer": "hecho", "status": "sellante", "surfaces": ["oclusal"],
                     "treatment": "sellante", "doneBy": self.other.pk},
                    {"layer": "plan", "status": "endodoncia", "surfaces": [],
                     "treatment": "endo"},
                ]},
            ],
        )

        # Banco: dos disponibles con plan; un plan "hecho" no es demanda.
        self.endo = ClinicalTreatment.objects.filter(odontogram_status="endodoncia").first()
        for index in range(2):
            patient = Patient.objects.create(
                first_name="Banco", last_name=str(index), dui=f"OV-B{index}"
            )
            Odontogram.objects.create(
                patient=patient,
                teeth=[{"fdi": 18, "marks": [
                    {"layer": "plan", "status": "endodoncia", "surfaces": [],
                     "treatment": self.endo.slug},
                ]}],
            )

    def _user(self, username, role, first="", last=""):
        return User.objects.create_user(
            username=username, password="pass12345", role=role,
            first_name=first, last_name=last,
        )

    def get(self, user):
        self.client.force_authenticate(user=user)
        response = self.client.get(self.URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.json()

    def visible(self, body):
        return {block for block in self.BLOCKS if body[block] is not None}

    def test_each_role_sees_its_blocks(self):
        expected = {
            User.Role.ESTUDIANTE: {"my_cases"},
            User.Role.DOCENTE: {"supervision"},
            User.Role.RECEPCION: {"bank"},
            User.Role.SOPORTE: {"accounts"},
            # Admin no atiende casos: todo menos "mis casos".
            User.Role.ADMIN: {"supervision", "bank", "faculty", "accounts"},
        }
        for role, blocks in expected.items():
            user = self.student if role == User.Role.ESTUDIANTE else self._user(f"ov-{role}", role)
            self.assertEqual(self.visible(self.get(user)), blocks, role)

    def test_my_cases(self):
        block = self.get(self.student)["my_cases"]
        # El que tiene cita va primero; la próxima cita es la más cercana.
        self.assertEqual(
            [case["patient_name"] for case in block["cases"]], ["Ana Pronto", "Beto Sincita"]
        )
        self.assertIsNotNone(block["cases"][0]["next_appointment"])
        self.assertIsNone(block["cases"][1]["next_appointment"])
        self.assertEqual(len(block["upcoming_appointments"]), 1)
        self.assertEqual(block["upcoming_appointments"][0]["patient_id"], self.soon.id)
        self.assertEqual(block["diagnoses_awaiting_validation"], 1)
        self.assertEqual(block["bank_available"], 2)
        self.assertEqual(block["my_done_treatments"], 1)

    def test_supervision_counts_the_validation_queue(self):
        block = self.get(self._user("doc-ov", User.Role.DOCENTE))["supervision"]
        self.assertEqual(block["diagnoses_to_validate"], 2)
        self.assertEqual(block["cases_in_progress"], 3)
        self.assertEqual(block["students_with_active_cases"], 2)
        self.assertEqual(block["indicators"]["validated_diagnoses"]["count"], 1)

    def test_bank(self):
        from assignments.models import Appointment

        today = timezone.localtime().replace(hour=23, minute=0)
        Appointment.objects.create(
            assignment=Assignment.objects.get(patient=self.later), starts_at=today
        )
        block = self.get(self._user("rec-ov", User.Role.RECEPCION))["bank"]
        self.assertEqual(block["unassigned"], 2)
        self.assertEqual(block["registered_this_month"], Patient.objects.count())
        self.assertEqual(
            [row["student_name"] for row in block["today_appointments"]], ["Lucía Zepeda"]
        )
        # Asignados al momento de registrarse: espera ~0 días.
        self.assertEqual(block["average_wait_days"], 0.0)

    def test_faculty_bank_demand_counts_only_available_patients(self):
        block = self.get(self._user("adm-ov", User.Role.ADMIN))["faculty"]
        # El plan del caso asignado ("endo" de Ana) no está en el banco.
        self.assertEqual(
            block["bank_demand"],
            [{"treatment": self.endo.slug, "name": self.endo.name,
              "area": self.endo.area.name, "count": 2}],
        )
        sin_area = next(row for row in block["by_area"] if row["area"] == "Sin área")
        self.assertEqual(sin_area["pendiente"] + sin_area["en_proceso"], Patient.objects.count())

    def test_accounts_by_role(self):
        inactive = self._user("inactivo", User.Role.RECEPCION)
        inactive.is_active = False
        inactive.save(update_fields=["is_active"])
        block = self.get(self._user("sop-ov", User.Role.SOPORTE))["accounts"]
        by_role = {row["role"]: row["count"] for row in block["active_by_role"]}
        self.assertEqual(by_role[User.Role.ESTUDIANTE], 2)
        self.assertEqual(block["inactive"], 1)

    def test_series_all_time(self):
        old = Patient.objects.create(first_name="Viejo", last_name="Registro", dui="OV-OLD")
        Patient.objects.filter(pk=old.pk).update(
            created_at=timezone.now() - timedelta(days=800)
        )
        self.client.force_authenticate(user=self._user("adm-series", User.Role.ADMIN))
        months = self.client.get("/api/dashboard/series/", {"period": "todos"}).json()["months"]
        self.assertGreater(len(months), 24)
        self.assertEqual(sum(month["patients"] for month in months), Patient.objects.count())
