from django.test import SimpleTestCase
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import AclPermission, Role, User
from accounts.services import sync_acl
from clinical_records.catalog import (
    FDI_TOOTH_NUMBERS,
    OralGeneralMark,
    ToothStatus,
    combine_tooth_statuses,
    default_tooth_findings,
    is_fdi_permanent_tooth,
    primary_tooth_status,
)
from patients.models import Patient


class OdontogramCatalogTests(SimpleTestCase):
    def test_tooth_status_is_closed(self):
        self.assertEqual(
            list(ToothStatus.values),
            [
                ToothStatus.SANO,
                ToothStatus.CARIES,
                ToothStatus.OBTURADO,
                ToothStatus.EXTRAIDO,
                ToothStatus.CORONA,
                ToothStatus.IMPLANTE,
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
        self.assertEqual(body["teeth"][0]["status"], ToothStatus.SANO)

    def test_put_persists_findings_and_oral_marks(self):
        teeth = default_tooth_findings()
        for finding in teeth:
            if finding["fdi"] == 16:
                finding["status"] = ToothStatus.CARIES
                finding["surfaces"] = ["oclusal"]
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
        self.assertEqual(tooth_16["status"], ToothStatus.CARIES)
        self.assertEqual(tooth_16["statuses"], [ToothStatus.CARIES])
        self.assertEqual(tooth_16["surfaces"], ["oclusal"])
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
        self.assertEqual(tooth_26["status"], ToothStatus.CARIES)
        self.assertEqual(
            tooth_26["statuses"],
            [ToothStatus.CARIES, ToothStatus.OBTURADO],
        )
