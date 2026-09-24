from datetime import timedelta
from io import BytesIO

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from accounts.services import sync_acl
from assignments.models import Assignment
from catalogs.models import ClinicalArea, ClinicalTreatment
from patients.models import Patient

PAGE_SIZE = settings.REST_FRAMEWORK["PAGE_SIZE"]


def clinical_area(slug: str) -> ClinicalArea:
    return ClinicalArea.objects.get(slug=slug)


def clinical_treatment(slug: str) -> ClinicalTreatment:
    return ClinicalTreatment.objects.get(slug=slug)


class ListingPaginationTests(APITestCase):
    def setUp(self):
        sync_acl()
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
                dui=f"DUI{index:03d}",
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
                dui=f"ASG{index:03d}",
            )
            Assignment.objects.create(patient=patient, student=student)
        self._assert_paginated_list("/api/assignments/", expected_count=PAGE_SIZE + 1)


class PatientDirectoryTests(APITestCase):
    def setUp(self):
        sync_acl()
        self.admin = User.objects.create_user(
            username="admin",
            password="pass12345",
            role=User.Role.ADMIN,
        )
        self.client.force_authenticate(user=self.admin)

    def test_search_matches_last_name_not_dui(self):
        Patient.objects.create(
            first_name="María",
            last_name="Gómez",
            dui="01234567-8",
        )
        Patient.objects.create(
            first_name="Luis",
            last_name="Pérez",
            dui="99999999-9",
        )

        by_name = self.client.get("/api/patients/", {"search": "Gómez"})
        self.assertEqual(by_name.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [row["last_name"] for row in by_name.json()["results"]],
            ["Gómez"],
        )

        by_document = self.client.get("/api/patients/", {"search": "99999999-9"})
        self.assertEqual(by_document.status_code, status.HTTP_200_OK)
        self.assertEqual(by_document.json()["results"], [])

    def test_filter_by_clinical_area(self):
        Patient.objects.create(
            first_name="Ana",
            last_name="Endodoncia",
            dui="END-001",
            clinical_area=clinical_area("endodoncia"),
        )
        Patient.objects.create(
            first_name="Luis",
            last_name="Operatoria",
            dui="OPE-001",
            clinical_area=clinical_area("operatoria"),
        )

        response = self.client.get(
            "/api/patients/",
            {"clinical_area": "endodoncia"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["count"], 1)
        self.assertEqual(body["results"][0]["dui"], "END-001")
        self.assertEqual(
            body["results"][0]["clinical_area"],
            "endodoncia",
        )

    def test_filter_by_assigned_to_unassigned_and_student(self):
        student = User.objects.create_user(
            username="estudiante-filtro",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
            first_name="Diego",
            last_name="Ramírez",
        )
        other = User.objects.create_user(
            username="estudiante-otro",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
            first_name="Laura",
            last_name="Rivas",
        )
        free = Patient.objects.create(
            first_name="Ana",
            last_name="Libre",
            dui="ASG-FREE",
        )
        diego_patient = Patient.objects.create(
            first_name="Luis",
            last_name="DeDiego",
            dui="ASG-DIEGO",
        )
        Patient.objects.create(
            first_name="Marta",
            last_name="DeLaura",
            dui="ASG-LAURA",
        )
        Assignment.objects.create(patient=diego_patient, student=student)
        Assignment.objects.create(
            patient=Patient.objects.get(dui="ASG-LAURA"),
            student=other,
        )

        unassigned = self.client.get(
            "/api/patients/",
            {"assigned_to": "unassigned"},
        )
        self.assertEqual(unassigned.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [row["dui"] for row in unassigned.json()["results"]],
            [free.dui],
        )

        by_student = self.client.get(
            "/api/patients/",
            {"assigned_to": student.id},
        )
        self.assertEqual(by_student.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [row["dui"] for row in by_student.json()["results"]],
            [diego_patient.dui],
        )

    def test_estudiante_can_combine_unassigned_and_pendiente_filters(self):
        student = User.objects.create_user(
            username="estudiante-disponibles",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
        )
        other = User.objects.create_user(
            username="estudiante-otro-disponibles",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
        )
        available = Patient.objects.create(
            first_name="Ana",
            last_name="Disponible",
            dui="DISP-001",
            case_status=Patient.CaseStatus.PENDIENTE,
        )
        Patient.objects.create(
            first_name="Luis",
            last_name="EnProceso",
            dui="DISP-002",
            case_status=Patient.CaseStatus.EN_PROCESO,
        )
        assigned_pendiente = Patient.objects.create(
            first_name="Marta",
            last_name="Asignada",
            dui="DISP-003",
            case_status=Patient.CaseStatus.PENDIENTE,
        )
        Assignment.objects.create(patient=assigned_pendiente, student=other)

        self.client.force_authenticate(user=student)
        response = self.client.get(
            "/api/patients/",
            {"assigned_to": "unassigned", "case_status": "pendiente"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [row["dui"] for row in response.json()["results"]],
            [available.dui],
        )

        dedicated = self.client.get("/api/patients/available/")
        self.assertEqual(dedicated.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [row["dui"] for row in dedicated.json()["results"]],
            [available.dui],
        )

    def test_available_requires_claim_or_assign_permission(self):
        docente = User.objects.create_user(
            username="docente-disponibles",
            password="pass12345",
            role=User.Role.DOCENTE,
        )
        recepcion = User.objects.create_user(
            username="recepcion-disponibles",
            password="pass12345",
            role=User.Role.RECEPCION,
        )
        self.client.force_authenticate(user=docente)
        response = self.client.get("/api/patients/available/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=recepcion)
        response = self.client.get("/api/patients/available/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_assignees_lists_students_with_active_assignment(self):
        assigned = User.objects.create_user(
            username="estudiante-activo",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
            first_name="Diego",
            last_name="Ramírez",
        )
        User.objects.create_user(
            username="estudiante-libre",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
            first_name="Laura",
            last_name="Rivas",
        )
        patient = Patient.objects.create(
            first_name="Luis",
            last_name="Caso",
            dui="ASG-LIST",
        )
        Assignment.objects.create(patient=patient, student=assigned)

        response = self.client.get("/api/patients/assignees/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json(),
            [{"id": assigned.id, "name": "Diego Ramírez"}],
        )

    def test_filter_by_case_status(self):
        Patient.objects.create(
            first_name="Ana",
            last_name="Pendiente",
            dui="PEND-001",
            case_status=Patient.CaseStatus.PENDIENTE,
        )
        Patient.objects.create(
            first_name="Luis",
            last_name="Cerrado",
            dui="FIN-001",
            case_status=Patient.CaseStatus.FINALIZADO,
        )

        response = self.client.get(
            "/api/patients/",
            {"case_status": Patient.CaseStatus.FINALIZADO},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["count"], 1)
        self.assertEqual(body["results"][0]["dui"], "FIN-001")

    def test_list_is_ordered_by_id(self):
        Patient.objects.create(
            first_name="Zaira",
            last_name="Zelaya",
            dui="ZEL-001",
        )
        Patient.objects.create(
            first_name="Ana",
            last_name="Ábrego",
            dui="ABR-001",
        )

        response = self.client.get("/api/patients/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in response.json()["results"]]
        self.assertEqual(ids, sorted(ids))

    def test_list_period_1m_excludes_older_patients(self):
        Patient.objects.create(
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

        response = self.client.get("/api/patients/", {"period": "1m"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["count"], 1)
        self.assertEqual(body["results"][0]["dui"], "REC-001")

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
            dui="ASG-001",
        )
        Assignment.objects.create(patient=patient, student=student)

        response = self.client.get("/api/patients/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = response.json()["results"][0]
        self.assertEqual(row["assigned_to"], "Ana López")
        self.assertEqual(row["clinical_area"], "")
        self.assertNotIn("address", row)


class PatientCompleteFieldsTests(APITestCase):
    def setUp(self):
        sync_acl()
        self.admin = User.objects.create_user(
            username="admin",
            password="pass12345",
            role=User.Role.ADMIN,
        )
        self.client.force_authenticate(user=self.admin)

    def test_create_patient_with_full_contact_data(self):
        payload = {
            "first_name": "Ana",
            "last_name": "Completa",
            "dui": "04512345-6",
            "phone_number": "7000-1111",
            "whatsapp_number": "7000-2222",
            "emergency_contact_name": "Marta Completa",
            "emergency_contact_phone": "7000-3333",
            "emergency_contact_relationship": Patient.EmergencyContactRelationship.MADRE,
        }
        response = self.client.post("/api/patients/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        patient = Patient.objects.get(dui="04512345-6")
        self.assertEqual(patient.whatsapp_number, "7000-2222")
        self.assertEqual(patient.emergency_contact_name, "Marta Completa")
        self.assertEqual(patient.emergency_contact_phone, "7000-3333")
        self.assertEqual(
            patient.emergency_contact_relationship,
            Patient.EmergencyContactRelationship.MADRE,
        )
        self.assertFalse(patient.photo)

    def test_new_contact_fields_are_optional(self):
        response = self.client.post(
            "/api/patients/",
            {"first_name": "Luis", "last_name": "Minimo", "dui": "MIN-001"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        patient = Patient.objects.get(dui="MIN-001")
        self.assertEqual(patient.whatsapp_number, "")
        self.assertEqual(patient.emergency_contact_name, "")
        self.assertEqual(patient.emergency_contact_phone, "")
        self.assertEqual(patient.emergency_contact_relationship, "")


class RecepcionPatientPermissionTests(APITestCase):
    def setUp(self):
        sync_acl()
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
            dui="LIB-001",
        )
        self.assigned = Patient.objects.create(
            first_name="Luis",
            last_name="Asignado",
            dui="ASG-002",
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


class PatientWriteTests(APITestCase):
    def setUp(self):
        sync_acl()
        self.recepcion = User.objects.create_user(
            username="recepcion-alta",
            password="pass12345",
            role=User.Role.RECEPCION,
        )
        self.admin = User.objects.create_user(
            username="admin-alta",
            password="pass12345",
            role=User.Role.ADMIN,
        )
        self.client.force_authenticate(user=self.recepcion)

    def test_create_starts_as_pendiente_and_ignores_case_status(self):
        response = self.client.post(
            "/api/patients/",
            {
                "first_name": "  Ana  ",
                "last_name": "López",
                "dui": "01234567-8",
                "phone_number": "7777-7777",
                "clinical_area": "operatoria",
                "case_status": Patient.CaseStatus.FINALIZADO,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertEqual(body["first_name"], "Ana")
        self.assertEqual(body["case_status"], Patient.CaseStatus.PENDIENTE)
        self.assertFalse(body["has_active_assignment"])
        self.assertEqual(body["clinical_area"], "operatoria")

    def test_duplicate_dui_is_rejected(self):
        Patient.objects.create(
            first_name="Luis",
            last_name="Pérez",
            dui="01234567-8",
        )
        response = self.client.post(
            "/api/patients/",
            {
                "first_name": "María",
                "last_name": "Gómez",
                "dui": "01234567-8",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("dui", response.data)

    def test_required_fields_are_validated(self):
        response = self.client.post(
            "/api/patients/",
            {"first_name": "   ", "last_name": "", "dui": ""},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("first_name", response.data)
        self.assertIn("last_name", response.data)
        self.assertIn("dui", response.data)

    def test_update_keeps_case_status(self):
        patient = Patient.objects.create(
            first_name="Carlos",
            last_name="Ruiz",
            dui="UPD-001",
            case_status=Patient.CaseStatus.EN_PROCESO,
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.put(
            f"/api/patients/{patient.id}/",
            {
                "first_name": "Carlos",
                "last_name": "Ruiz",
                "dui": "UPD-001",
                "date_of_birth": "1990-05-12",
                "phone_number": "7000-1111",
                "email": "carlos@example.com",
                "address": "San Salvador",
                "clinical_area": "endodoncia",
                "case_status": Patient.CaseStatus.FINALIZADO,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["phone_number"], "7000-1111")
        self.assertEqual(body["clinical_area"], "endodoncia")
        self.assertEqual(body["case_status"], Patient.CaseStatus.EN_PROCESO)
        self.assertEqual(body["date_of_birth"], "1990-05-12")

    def test_retrieve_includes_assignment_flag(self):
        student = User.objects.create_user(
            username="estudiante-ficha",
            password="pass12345",
            role=User.Role.ESTUDIANTE,
        )
        patient = Patient.objects.create(
            first_name="Marta",
            last_name="Rivas",
            dui="FIC-001",
        )
        Assignment.objects.create(patient=patient, student=student)

        response = self.client.get(f"/api/patients/{patient.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertTrue(body["has_active_assignment"])
        self.assertEqual(body["assigned_to"], "estudiante-ficha")
        self.assertEqual(body["dui"], "FIC-001")
        self.assertIn("address", body)
        self.assertIn("whatsapp_number", body)
        self.assertIn("emergency_contact_name", body)
        self.assertIn("emergency_contact_phone", body)
        self.assertIn("emergency_contact_relationship", body)
        self.assertIn("photo", body)

    def test_create_saves_reception_fields(self):
        response = self.client.post(
            "/api/patients/",
            {
                "first_name": "Ana",
                "last_name": "López",
                "dui": "REC-001",
                "whatsapp_number": "7777-8888",
                "emergency_contact_name": "Marta López",
                "emergency_contact_phone": "7000-3333",
                "emergency_contact_relationship": Patient.EmergencyContactRelationship.MADRE,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertEqual(body["whatsapp_number"], "7777-8888")
        self.assertEqual(body["emergency_contact_name"], "Marta López")
        self.assertEqual(body["emergency_contact_phone"], "7000-3333")
        self.assertEqual(
            body["emergency_contact_relationship"],
            Patient.EmergencyContactRelationship.MADRE,
        )

    def test_photo_upload_returns_url(self):
        response = self.client.post(
            "/api/patients/",
            {
                "first_name": "Ana",
                "last_name": "Foto",
                "dui": "FOTO-001",
                "photo": _jpeg_upload(),
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        photo = response.json()["photo"]
        self.assertIsNotNone(photo)
        self.assertIn("/media/", photo)

    def test_photo_rejects_non_image(self):
        response = self.client.post(
            "/api/patients/",
            {
                "first_name": "Ana",
                "last_name": "Archivo",
                "dui": "FOTO-BAD",
                "photo": SimpleUploadedFile(
                    "nota.txt",
                    b"no es una imagen",
                    content_type="text/plain",
                ),
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("photo", response.data)

    def test_photo_rejects_oversized_file(self):
        huge = SimpleUploadedFile(
            "grande.jpg",
            b"x" * (2 * 1024 * 1024 + 1),
            content_type="image/jpeg",
        )
        response = self.client.post(
            "/api/patients/",
            {
                "first_name": "Ana",
                "last_name": "Grande",
                "dui": "FOTO-BIG",
                "photo": huge,
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("photo", response.data)

    def test_create_accepts_diagnostico_area(self):
        response = self.client.post(
            "/api/patients/",
            {
                "first_name": "Ana",
                "last_name": "Dx",
                "dui": "DX-001",
                "clinical_area": "diagnostico",
                "clinical_subcategory": "diagnostico_con_rx_panoramica",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertEqual(body["clinical_area"], "diagnostico")
        self.assertEqual(
            body["clinical_subcategory"],
            "diagnostico_con_rx_panoramica",
        )

    def test_subcategory_must_match_clinical_area(self):
        response = self.client.post(
            "/api/patients/",
            {
                "first_name": "Ana",
                "last_name": "Cruz",
                "dui": "SUB-BAD",
                "clinical_area": "operatoria",
                "clinical_subcategory": "endodoncia_monorradicular",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("clinical_subcategory", response.data)

    def test_subcategory_requires_clinical_area(self):
        response = self.client.post(
            "/api/patients/",
            {
                "first_name": "Ana",
                "last_name": "Cruz",
                "dui": "SUB-NOAREA",
                "clinical_subcategory": "ameloplastia_adulto",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("clinical_subcategory", response.data)

    def test_patch_area_clears_incompatible_subcategory(self):
        patient = Patient.objects.create(
            first_name="Carlos",
            last_name="Ruiz",
            dui="SUB-PATCH",
            clinical_area=clinical_area("operatoria"),
            clinical_treatment=clinical_treatment("ameloplastia_adulto"),
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/patients/{patient.id}/",
            {"clinical_area": "endodoncia"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["clinical_area"], "endodoncia")
        self.assertEqual(body["clinical_subcategory"], "")


class ClinicalCatalogTests(TestCase):
    def test_mismatched_subcategory_fails_model_clean(self):
        patient = Patient(
            first_name="Ana",
            last_name="López",
            dui="CLEAN-001",
            clinical_area=clinical_area("operatoria"),
            clinical_treatment=clinical_treatment("endodoncia_monorradicular"),
        )
        with self.assertRaises(ValidationError) as caught:
            patient.clean()
        self.assertIn("clinical_subcategory", caught.exception.message_dict)


def _jpeg_upload(name="foto.jpg") -> SimpleUploadedFile:
    buffer = BytesIO()
    Image.new("RGB", (8, 8), color="#2ad4c5").save(buffer, format="JPEG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/jpeg")
