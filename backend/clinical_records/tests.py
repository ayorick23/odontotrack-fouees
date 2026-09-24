from django.test import SimpleTestCase
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import AclPermission, Role, User
from accounts.services import sync_acl
from assignments.models import Assignment
from catalogs.models import ClinicalArea, ClinicalTreatment
from clinical_records.catalog import (
    FDI_TOOTH_NUMBERS,
    OralGeneralMark,
    ToothLayer,
    ToothStatus,
    combine_tooth_statuses,
    default_tooth_findings,
    is_fdi_permanent_tooth,
    is_fdi_tooth,
    normalize_tooth,
    primary_tooth_status,
)
from clinical_records.models import OdontogramRevision
from clinical_records.models import Diagnostico, EvolucionClinica, Tratamiento
from patients.models import Patient


class OdontogramCatalogTests(SimpleTestCase):
    def test_tooth_status_is_closed(self):
        self.assertEqual(
            list(ToothStatus.values),
            [
                ToothStatus.SANO,
                ToothStatus.CARIES,
                ToothStatus.FRACTURA,
                ToothStatus.OBTURADO,
                ToothStatus.SELLANTE,
                ToothStatus.RESTAURACION_TEMPORAL,
                ToothStatus.ENDODONCIA,
                ToothStatus.PULPOTOMIA,
                ToothStatus.CORONA,
                ToothStatus.PUENTE,
                ToothStatus.IMPLANTE,
                ToothStatus.EXTRAIDO,
                ToothStatus.RAIZ_RETENIDA,
                ToothStatus.NO_ERUPCIONADO,
                ToothStatus.AUSENTE_CONGENITO,
            ],
        )

    def test_fdi_has_thirty_two_unique_permanent_teeth(self):
        self.assertEqual(len(FDI_TOOTH_NUMBERS), 32)
        self.assertEqual(len(set(FDI_TOOTH_NUMBERS)), 32)
        for number in FDI_TOOTH_NUMBERS:
            self.assertTrue(is_fdi_permanent_tooth(number))

    def test_rejects_numbers_outside_fdi_permanent_set(self):
        self.assertFalse(is_fdi_permanent_tooth(8))
        self.assertFalse(is_fdi_permanent_tooth(51))
        self.assertFalse(is_fdi_permanent_tooth(19))
        self.assertTrue(is_fdi_tooth(51))
        self.assertTrue(is_fdi_tooth(16))

    def test_oral_general_marks_are_boolean_flags(self):
        self.assertEqual(
            list(OralGeneralMark.values),
            [
                OralGeneralMark.PLACA,
                OralGeneralMark.SANGRADO,
                OralGeneralMark.SARRO,
            ],
        )

    def test_combines_caries_and_obturado_and_keeps_extraction_exclusive(self):
        self.assertEqual(
            combine_tooth_statuses(
                ToothStatus.CARIES,
                [ToothStatus.OBTURADO],
            ),
            [ToothStatus.CARIES, ToothStatus.OBTURADO],
        )
        self.assertEqual(
            primary_tooth_status([ToothStatus.CARIES, ToothStatus.OBTURADO]),
            ToothStatus.CARIES,
        )
        self.assertEqual(
            combine_tooth_statuses(
                ToothStatus.EXTRAIDO,
                [ToothStatus.CARIES],
            ),
            [ToothStatus.EXTRAIDO],
        )

    def test_normalizes_legacy_tooth_into_layered_marks(self):
        tooth = normalize_tooth(
            {
                "fdi": 16,
                "status": ToothStatus.CARIES,
                "statuses": [ToothStatus.CARIES, ToothStatus.OBTURADO],
                "surfaces": ["mesial", "oclusal"],
            }
        )
        self.assertEqual(
            tooth["marks"],
            [
                {
                    "layer": ToothLayer.HALLAZGO,
                    "status": ToothStatus.CARIES,
                    "surfaces": ["mesial", "oclusal"],
                },
                {
                    "layer": ToothLayer.HECHO,
                    "status": ToothStatus.OBTURADO,
                    "surfaces": ["mesial", "oclusal"],
                },
            ],
        )


class OdontogramApiTests(APITestCase):
    def setUp(self):
        sync_acl()
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
        self.patient = Patient.objects.create(
            first_name="Ana",
            last_name="Lopez",
            dui="ODONTO01",
        )
        self.url = f"/api/clinical-records/odontogram/{self.patient.id}/"
        self.client.force_authenticate(user=self.admin)

    def test_get_creates_empty_odontogram_with_thirty_two_teeth(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(len(body["teeth"]), 32)
        self.assertEqual(body["teeth"][0]["fdi"], 18)
        self.assertFalse(body["placa"])
        self.assertEqual(body["teeth"][0]["marks"], [])

    def test_put_persists_findings_and_oral_marks(self):
        teeth = default_tooth_findings()
        for finding in teeth:
            if finding["fdi"] == 16:
                finding["marks"] = [
                    {
                        "layer": ToothLayer.HALLAZGO,
                        "status": ToothStatus.CARIES,
                        "surfaces": ["mesial", "oclusal"],
                    },
                    {
                        "layer": ToothLayer.PLAN,
                        "status": ToothStatus.OBTURADO,
                        "surfaces": ["mesial", "oclusal"],
                    },
                ]
        payload = {
            "placa": True,
            "sangrado": False,
            "sarro": True,
            "teeth": teeth,
            "visual_snapshot": {"version": 2.2, "teeth": {"16": {"toothSelection": "tooth-base"}}},
        }
        saved = self.client.put(self.url, payload, format="json")
        self.assertEqual(saved.status_code, status.HTTP_200_OK)
        loaded = self.client.get(self.url)
        body = loaded.json()
        tooth_16 = next(item for item in body["teeth"] if item["fdi"] == 16)
        self.assertEqual(
            tooth_16["marks"],
            [
                {
                    "layer": ToothLayer.HALLAZGO,
                    "status": ToothStatus.CARIES,
                    "surfaces": ["mesial", "oclusal"],
                },
                {
                    "layer": ToothLayer.PLAN,
                    "status": ToothStatus.OBTURADO,
                    "surfaces": ["mesial", "oclusal"],
                },
            ],
        )
        self.assertTrue(body["placa"])
        self.assertTrue(body["sarro"])
        self.assertEqual(body["visual_snapshot"]["version"], 2.2)

    def test_put_rejects_invalid_fdi(self):
        payload = {
            "placa": False,
            "sangrado": False,
            "sarro": False,
            "teeth": [{"fdi": 99, "status": ToothStatus.SANO, "surfaces": []}],
        }
        response = self.client.put(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_student_with_permission_can_view_and_update_unassigned_patient(self):
        self.client.force_authenticate(user=self.student)
        loaded = self.client.get(self.url)
        self.assertEqual(loaded.status_code, status.HTTP_200_OK)
        saved = self.client.put(self.url, self._payload(placa=True), format="json")
        self.assertEqual(saved.status_code, status.HTTP_200_OK)
        self.assertTrue(saved.json()["placa"])

    def test_role_without_update_permission_cannot_edit(self):
        docente = User.objects.create_user(
            username="docente",
            password="pass12345",
            role=User.Role.DOCENTE,
        )
        self.client.force_authenticate(user=docente)
        response = self.client.put(self.url, self._payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_any_role_with_update_permission_can_edit(self):
        docente = User.objects.create_user(
            username="docente",
            password="pass12345",
            role=User.Role.DOCENTE,
        )
        role = Role.objects.get(slug=User.Role.DOCENTE)
        role.permissions.add(AclPermission.objects.get(name="odontogram.update"))
        self.client.force_authenticate(user=docente)
        response = self.client.put(self.url, self._payload(placa=True), format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.json()["placa"])

    def _payload(self, *, placa: bool = False) -> dict:
        return {
            "placa": placa,
            "sangrado": False,
            "sarro": False,
            "teeth": default_tooth_findings(),
        }

    def test_put_combines_caries_and_obturado_on_the_same_tooth(self):
        teeth = default_tooth_findings()
        for finding in teeth:
            if finding["fdi"] == 26:
                finding["status"] = ToothStatus.CARIES
                finding["statuses"] = [ToothStatus.CARIES, ToothStatus.OBTURADO]
                finding["surfaces"] = ["oclusal", "mesial"]
        response = self.client.put(
            self.url,
            {
                "placa": False,
                "sangrado": False,
                "sarro": False,
                "teeth": teeth,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        tooth_26 = next(
            item for item in response.json()["teeth"] if item["fdi"] == 26
        )
        self.assertEqual(
            tooth_26["marks"],
            [
                {
                    "layer": ToothLayer.HALLAZGO,
                    "status": ToothStatus.CARIES,
                    "surfaces": ["mesial", "oclusal"],
                },
                {
                    "layer": ToothLayer.HECHO,
                    "status": ToothStatus.OBTURADO,
                    "surfaces": ["mesial", "oclusal"],
                },
            ],
        )

    def test_put_accepts_primary_teeth_and_per_tooth_oral_marks(self):
        teeth = default_tooth_findings(include_primary=True)
        for finding in teeth:
            if finding["fdi"] == 51:
                finding["oralMarks"] = {"placa": True, "sangrado": False, "sarro": True}
                finding["practice"] = {
                    "indicated": True,
                    "clinicalArea": "operatoria",
                }
        response = self.client.put(
            self.url,
            {
                "placa": False,
                "sangrado": False,
                "sarro": False,
                "teeth": teeth,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(len(body["teeth"]), 52)
        tooth_51 = next(item for item in body["teeth"] if item["fdi"] == 51)
        self.assertTrue(tooth_51["oralMarks"]["placa"])
        self.assertTrue(tooth_51["practice"]["indicated"])
        self.assertEqual(tooth_51["practice"]["clinicalArea"], "operatoria")
        self.assertTrue(body["placa"])
        self.assertTrue(body["sarro"])

    def test_put_records_history_of_previous_content(self):
        first_teeth = default_tooth_findings()
        for finding in first_teeth:
            if finding["fdi"] == 16:
                finding["marks"] = [
                    {
                        "layer": ToothLayer.HALLAZGO,
                        "status": ToothStatus.CARIES,
                        "surfaces": ["oclusal"],
                    }
                ]
        first = self.client.put(
            self.url,
            {"placa": False, "sangrado": False, "sarro": False, "teeth": first_teeth},
            format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK)

        second_teeth = default_tooth_findings()
        for finding in second_teeth:
            if finding["fdi"] == 16:
                finding["marks"] = [
                    {
                        "layer": ToothLayer.HECHO,
                        "status": ToothStatus.OBTURADO,
                        "surfaces": ["oclusal"],
                    }
                ]
        second = self.client.put(
            self.url,
            {"placa": False, "sangrado": False, "sarro": False, "teeth": second_teeth},
            format="json",
        )
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        history = self.client.get(f"{self.url}history/")
        self.assertEqual(history.status_code, status.HTTP_200_OK)
        self.assertEqual(len(history.json()), 1)
        revision_16 = next(
            item for item in history.json()[0]["teeth"] if item["fdi"] == 16
        )
        self.assertEqual(revision_16["marks"][0]["status"], ToothStatus.CARIES)
        self.assertEqual(OdontogramRevision.objects.count(), 1)


class DiagnosisApiTests(APITestCase):
    def setUp(self):
        sync_acl()
        self.student = User.objects.create_user(
            username="estudiante-dx",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
        )
        self.docente = User.objects.create_user(
            username="docente-dx",
            password="pass12345",
            role=User.Role.DOCENTE,
        )
        self.patient = Patient.objects.create(
            first_name="Ana",
            last_name="Diagnostico",
            dui="DX-001",
        )
        self.url = "/api/clinical-records/diagnoses/"

    def test_student_can_create_and_list_own_diagnosis(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            self.url,
            {
                "patient": self.patient.id,
                "student": self.student.id,
                "content": "Caries en pieza 16.",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertFalse(body["is_validated"])
        self.assertIsNone(body["validated_by"])

        listing = self.client.get(self.url)
        self.assertEqual(listing.json()["count"], 1)
        self.assertEqual(listing.json()["results"][0]["student_name"], self.student.username)

    def test_list_filters_by_patient(self):
        other = Patient.objects.create(
            first_name="Otra",
            last_name="Ficha",
            dui="DX-002",
        )
        Diagnostico.objects.create(
            patient=self.patient,
            student=self.student,
            content="Caries en 16.",
        )
        Diagnostico.objects.create(
            patient=other,
            student=self.student,
            content="Fractura en 21.",
        )
        self.client.force_authenticate(user=self.student)
        response = self.client.get(self.url, {"patient": self.patient.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["count"], 1)
        self.assertEqual(body["results"][0]["content"], "Caries en 16.")

    def test_is_validated_is_read_only(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            self.url,
            {
                "patient": self.patient.id,
                "student": self.student.id,
                "content": "Caries en pieza 16.",
                "is_validated": True,
                "validated_by": self.docente.id,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.json()["is_validated"])

    def test_docente_can_view_but_not_create(self):
        self.client.force_authenticate(user=self.docente)
        listing = self.client.get(self.url)
        self.assertEqual(listing.status_code, status.HTTP_200_OK)

        response = self.client.post(
            self.url,
            {
                "patient": self.patient.id,
                "student": self.student.id,
                "content": "Intento de docente.",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_docente_can_validate_diagnosis(self):
        diagnosis = Diagnostico.objects.create(
            patient=self.patient,
            student=self.student,
            content="Caries en 16.",
        )
        self.client.force_authenticate(user=self.docente)
        response = self.client.post(f"{self.url}{diagnosis.id}/validate/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertTrue(body["is_validated"])
        self.assertEqual(body["validated_by"], self.docente.id)
        self.assertIsNotNone(body["validated_at"])

    def test_student_cannot_validate_diagnosis(self):
        diagnosis = Diagnostico.objects.create(
            patient=self.patient,
            student=self.student,
            content="Caries en 16.",
        )
        self.client.force_authenticate(user=self.student)
        response = self.client.post(f"{self.url}{diagnosis.id}/validate/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        diagnosis.refresh_from_db()
        self.assertFalse(diagnosis.is_validated)

    def test_cannot_validate_twice(self):
        diagnosis = Diagnostico.objects.create(
            patient=self.patient,
            student=self.student,
            content="Caries en 16.",
        )
        self.client.force_authenticate(user=self.docente)
        self.client.post(f"{self.url}{diagnosis.id}/validate/")
        response = self.client.post(f"{self.url}{diagnosis.id}/validate/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TreatmentApiTests(APITestCase):
    def setUp(self):
        sync_acl()
        self.student = User.objects.create_user(
            username="estudiante-tx",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
        )
        self.patient = Patient.objects.create(
            first_name="Luis",
            last_name="Tratamiento",
            dui="TX-001",
        )
        self.area = ClinicalArea.objects.get(slug="endodoncia")
        self.treatment = ClinicalTreatment.objects.filter(area=self.area).first()
        self.other_area = ClinicalArea.objects.exclude(id=self.area.id).first()
        self.url = "/api/clinical-records/treatments/"
        self.client.force_authenticate(user=self.student)

    def test_student_can_create_treatment(self):
        response = self.client.post(
            self.url,
            {
                "patient": self.patient.id,
                "clinical_area": self.area.id,
                "clinical_treatment": self.treatment.id,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Tratamiento.objects.count(), 1)

    def test_rejects_treatment_from_a_different_area(self):
        response = self.client.post(
            self.url,
            {
                "patient": self.patient.id,
                "clinical_area": self.other_area.id,
                "clinical_treatment": self.treatment.id,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ClinicalEvolutionApiTests(APITestCase):
    def setUp(self):
        sync_acl()
        self.student = User.objects.create_user(
            username="estudiante-evo",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
        )
        self.recepcion = User.objects.create_user(
            username="recepcion-evo",
            password="pass12345",
            role=User.Role.RECEPCION,
        )
        self.patient = Patient.objects.create(
            first_name="Marta",
            last_name="Evolucion",
            dui="EVO-001",
        )
        self.url = "/api/clinical-records/evolution/"

    def test_student_can_create_evolution_note(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            self.url,
            {
                "patient": self.patient.id,
                "student": self.student.id,
                "date": "2026-09-22",
                "note": "Paciente sin dolor, continúa tratamiento.",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(EvolucionClinica.objects.count(), 1)

    def test_admin_uses_assigned_student_when_creating_evolution(self):
        admin = User.objects.create_user(
            username="admin-evo",
            password="pass12345",
            role=User.Role.ADMIN,
        )
        Assignment.objects.create(
            patient=self.patient,
            student=self.student,
            reason="Control",
        )
        self.client.force_authenticate(user=admin)
        response = self.client.post(
            self.url,
            {
                "patient": self.patient.id,
                "date": "2026-09-22",
                "note": "Nota creada por administración.",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["student"], self.student.id)

    def test_admin_cannot_create_evolution_without_assigned_student(self):
        admin = User.objects.create_user(
            username="admin-evo-sin",
            password="pass12345",
            role=User.Role.ADMIN,
        )
        self.client.force_authenticate(user=admin)
        response = self.client.post(
            self.url,
            {
                "patient": self.patient.id,
                "date": "2026-09-22",
                "note": "No hay estudiante asignado.",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("student", response.json())

    def test_recepcion_has_no_clinical_write_access(self):
        self.client.force_authenticate(user=self.recepcion)
        response = self.client.post(
            self.url,
            {
                "patient": self.patient.id,
                "student": self.student.id,
                "date": "2026-09-22",
                "note": "No debería poder crear esto.",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
