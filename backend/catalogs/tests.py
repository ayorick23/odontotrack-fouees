from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from accounts.services import sync_acl
from catalogs.models import ClinicalArea, ClinicalTreatment
from catalogs.seed import CLINICAL_CATALOG


class ClinicalCatalogApiTests(APITestCase):
    def setUp(self):
        sync_acl()
        self.admin = User.objects.create_user(
            username="admin-cat",
            password="pass12345",
            role=User.Role.ADMIN,
        )
        self.recepcion = User.objects.create_user(
            username="recepcion-cat",
            password="pass12345",
            role=User.Role.RECEPCION,
        )
        self.estudiante = User.objects.create_user(
            username="estudiante-cat",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
        )

    def test_seed_creates_official_catalog(self):
        self.assertEqual(ClinicalArea.objects.count(), len(CLINICAL_CATALOG))
        diagnostico = ClinicalArea.objects.get(slug="diagnostico")
        self.assertEqual(diagnostico.treatments.count(), 4)
        self.assertTrue(
            ClinicalTreatment.objects.filter(
                slug="diagnostico_con_rx_panoramica",
            ).exists()
        )

    def test_recepcion_can_list_catalog(self):
        self.client.force_authenticate(user=self.recepcion)
        response = self.client.get("/api/catalogs/clinical-areas/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = [row["slug"] for row in response.json()]
        self.assertIn("diagnostico", slugs)
        diagnostico = next(row for row in response.json() if row["slug"] == "diagnostico")
        self.assertGreaterEqual(len(diagnostico["treatments"]), 4)

    def test_estudiante_cannot_create_area(self):
        self.client.force_authenticate(user=self.estudiante)
        response = self.client.post(
            "/api/catalogs/clinical-areas/",
            {"name": "Implantología"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_add_area_and_treatment(self):
        self.client.force_authenticate(user=self.admin)
        area_response = self.client.post(
            "/api/catalogs/clinical-areas/",
            {"name": "Implantología"},
            format="json",
        )
        self.assertEqual(area_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(area_response.json()["slug"], "implantologia")
        area_id = area_response.json()["id"]

        treatment_response = self.client.post(
            "/api/catalogs/clinical-treatments/",
            {"name": "Implante unitario", "area": area_id},
            format="json",
        )
        self.assertEqual(treatment_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(treatment_response.json()["slug"], "implante-unitario")
        self.assertEqual(treatment_response.json()["area"], area_id)
