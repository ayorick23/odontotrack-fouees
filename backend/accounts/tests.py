from rest_framework import status
from rest_framework.test import APIRequestFactory, APITestCase

from accounts.models import Notification, Role, User
from accounts.permissions import (
    IsAdmin,
    IsAdminOrSoporte,
    IsDocente,
    IsEstudiante,
    IsRecepcion,
    IsSoporte,
)
from accounts.services import notify, sync_acl
from assignments.models import Assignment
from patients.models import Patient

TOKEN_URL = "/api/auth/token/"
TOKEN_REFRESH_URL = "/api/auth/token/refresh/"
USERS_URL = "/api/accounts/users/"
ME_URL = "/api/accounts/users/me/"
VALID_PASSWORD = "OdontoTrack2026!"


class LoginTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="mgomez",
            email="maria.gomez@fouees.edu.sv",
            password=VALID_PASSWORD,
            first_name="María",
            last_name="Gómez",
            role=User.Role.ESTUDIANTE,
        )

    def test_login_with_username_returns_tokens(self):
        response = self.client.post(
            TOKEN_URL,
            {"username": "mgomez", "password": VALID_PASSWORD},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_login_with_email_returns_tokens(self):
        response = self.client.post(
            TOKEN_URL,
            {"email": "maria.gomez@fouees.edu.sv", "password": VALID_PASSWORD},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_login_with_email_in_username_field_returns_tokens(self):
        response = self.client.post(
            TOKEN_URL,
            {
                "username": "maria.gomez@fouees.edu.sv",
                "password": VALID_PASSWORD,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    def test_login_with_wrong_password_returns_401(self):
        response = self.client.post(
            TOKEN_URL,
            {"username": "mgomez", "password": "clave-incorrecta"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_without_identifier_returns_400(self):
        response = self.client.post(
            TOKEN_URL,
            {"password": VALID_PASSWORD},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data)

    def test_refresh_returns_rotated_tokens(self):
        tokens = self.client.post(
            TOKEN_URL,
            {"username": "mgomez", "password": VALID_PASSWORD},
            format="json",
        ).data
        response = self.client.post(
            TOKEN_REFRESH_URL,
            {"refresh": tokens["refresh"]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertNotEqual(response.data["access"], tokens["access"])


class UserCreateTests(APITestCase):
    def setUp(self):
        sync_acl()
        self.admin = User.objects.create_user(
            username="admin",
            email="admin@fouees.edu.sv",
            password=VALID_PASSWORD,
            role=User.Role.ADMIN,
        )
        self.soporte = User.objects.create_user(
            username="soporte",
            email="soporte@fouees.edu.sv",
            password=VALID_PASSWORD,
            role=User.Role.SOPORTE,
        )
        self.estudiante = User.objects.create_user(
            username="estudiante",
            email="estudiante@fouees.edu.sv",
            password=VALID_PASSWORD,
            role=User.Role.ESTUDIANTE,
        )
        self.payload = {
            "username": "nlopez",
            "email": "nlopez@fouees.edu.sv",
            "password": VALID_PASSWORD,
            "first_name": "Nadia",
            "last_name": "López",
            "role": User.Role.ESTUDIANTE,
        }

    def test_admin_can_create_user_with_role(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(USERS_URL, self.payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["role"], User.Role.ESTUDIANTE)
        self.assertNotIn("password", response.data)
        created = User.objects.get(username="nlopez")
        self.assertTrue(created.check_password(VALID_PASSWORD))

    def test_soporte_can_create_user(self):
        self.client.force_authenticate(user=self.soporte)
        response = self.client.post(USERS_URL, self.payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_estudiante_cannot_create_user(self):
        self.client.force_authenticate(user=self.estudiante)
        response = self.client.post(USERS_URL, self.payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_cannot_create_user(self):
        response = self.client.post(USERS_URL, self.payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_required_fields_returns_400(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(USERS_URL, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        for field in ("username", "email", "password", "first_name", "last_name", "role"):
            self.assertIn(field, response.data)

    def test_invalid_role_returns_400(self):
        self.client.force_authenticate(user=self.admin)
        payload = {**self.payload, "role": "superadmin"}
        response = self.client.post(USERS_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", response.data)

    def test_duplicate_email_returns_400(self):
        self.client.force_authenticate(user=self.admin)
        payload = {**self.payload, "email": self.estudiante.email}
        response = self.client.post(USERS_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_soporte_cannot_create_admin(self):
        self.client.force_authenticate(user=self.soporte)
        payload = {**self.payload, "role": User.Role.ADMIN}
        response = self.client.post(USERS_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(User.objects.filter(username="nlopez").exists())

    def test_admin_can_create_admin(self):
        self.client.force_authenticate(user=self.admin)
        payload = {**self.payload, "role": User.Role.ADMIN}
        response = self.client.post(USERS_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class UserManagementTests(APITestCase):
    """ODO-64: edición, bloqueo, borrado y contraseña de cuentas ajenas."""

    def setUp(self):
        sync_acl()
        self.admin = self._user("admin-um", User.Role.ADMIN)
        self.soporte = self._user("soporte-um", User.Role.SOPORTE)
        self.docente = self._user("docente-um", User.Role.DOCENTE)
        self.student = self._user("est-um", User.Role.ESTUDIANTE, first_name="Nadia")

    def _user(self, username, role, **extra):
        return User.objects.create_user(
            username=username,
            email=f"{username}@fouees.edu.sv",
            password=VALID_PASSWORD,
            role=role,
            **extra,
        )

    def _url(self, user, suffix=""):
        return f"{USERS_URL}{user.pk}/{suffix}"

    def test_list_exposes_is_active_and_filters(self):
        self.student.is_active = False
        self.student.save()
        self.client.force_authenticate(user=self.soporte)
        response = self.client.get(USERS_URL, {"is_active": "false"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [row["username"] for row in response.data["results"]], ["est-um"]
        )
        self.assertFalse(response.data["results"][0]["is_active"])

        response = self.client.get(USERS_URL, {"search": "nadia"})
        self.assertEqual(
            [row["username"] for row in response.data["results"]], ["est-um"]
        )

    def test_soporte_deactivates_a_student_who_then_cannot_use_the_api(self):
        self.client.force_authenticate(user=self.soporte)
        response = self.client.patch(
            self._url(self.student), {"is_active": False}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.client.force_authenticate(user=None)

        login = self.client.post(
            TOKEN_URL,
            {"username": "est-um", "password": VALID_PASSWORD},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_stops_working_after_deactivation(self):
        access = self.client.post(
            TOKEN_URL,
            {"username": "est-um", "password": VALID_PASSWORD},
            format="json",
        ).data["access"]
        self.student.is_active = False
        self.student.save()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(
            self.client.get(ME_URL).status_code, status.HTTP_401_UNAUTHORIZED
        )

    def test_edit_rejects_email_of_another_user(self):
        self.client.force_authenticate(user=self.soporte)
        response = self.client.patch(
            self._url(self.student), {"email": self.docente.email}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_edit_keeps_own_email(self):
        self.client.force_authenticate(user=self.soporte)
        response = self.client.patch(
            self._url(self.student),
            {"email": self.student.email, "first_name": "Nadia María"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_soporte_cannot_promote_to_admin_or_touch_an_admin(self):
        self.client.force_authenticate(user=self.soporte)
        promote_self = self.client.patch(
            self._url(self.soporte), {"role": User.Role.ADMIN}, format="json"
        )
        self.assertEqual(promote_self.status_code, status.HTTP_403_FORBIDDEN)
        promote_other = self.client.patch(
            self._url(self.student), {"role": User.Role.ADMIN}, format="json"
        )
        self.assertEqual(promote_other.status_code, status.HTTP_403_FORBIDDEN)
        block_admin = self.client.patch(
            self._url(self.admin), {"is_active": False}, format="json"
        )
        self.assertEqual(block_admin.status_code, status.HTTP_403_FORBIDDEN)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)
        reset_admin = self.client.post(
            self._url(self.admin, "set-password/"),
            {"password": "OtraClave2026!"},
            format="json",
        )
        self.assertEqual(reset_admin.status_code, status.HTTP_403_FORBIDDEN)

    def test_soporte_changes_role_between_non_admin_roles(self):
        self.client.force_authenticate(user=self.soporte)
        response = self.client.patch(
            self._url(self.student), {"role": User.Role.DOCENTE}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["role"], User.Role.DOCENTE)

    def test_nobody_deactivates_or_demotes_themselves(self):
        self.client.force_authenticate(user=self.admin)
        deactivate = self.client.patch(
            self._url(self.admin), {"is_active": False}, format="json"
        )
        self.assertEqual(deactivate.status_code, status.HTTP_400_BAD_REQUEST)
        demote = self.client.patch(
            self._url(self.admin), {"role": User.Role.DOCENTE}, format="json"
        )
        self.assertEqual(demote.status_code, status.HTTP_400_BAD_REQUEST)
        rename = self.client.patch(
            self._url(self.admin), {"first_name": "Ana"}, format="json"
        )
        self.assertEqual(rename.status_code, status.HTTP_200_OK)

    def test_role_without_users_edit_cannot_edit(self):
        self.client.force_authenticate(user=self.docente)
        response = self.client.patch(
            self._url(self.student), {"is_active": False}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_only_without_clinical_history(self):
        self.client.force_authenticate(user=self.soporte)
        patient = Patient.objects.create(first_name="Rosa", last_name="Ruiz", dui="UM-1")
        Assignment.objects.create(patient=patient, student=self.student)
        with_history = self.client.delete(self._url(self.student))
        self.assertEqual(with_history.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(User.objects.filter(pk=self.student.pk).exists())
        self.assertTrue(Assignment.objects.filter(student=self.student).exists())

        unused = self._user("creada-por-error", User.Role.ESTUDIANTE)
        response = self.client.delete(self._url(unused))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_cannot_delete_yourself(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(self._url(self.admin))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_soporte_resets_a_student_password(self):
        self.client.force_authenticate(user=self.soporte)
        response = self.client.post(
            self._url(self.student, "set-password/"),
            {"password": "NuevaClave2026!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.student.refresh_from_db()
        self.assertTrue(self.student.check_password("NuevaClave2026!"))

    def test_reset_password_applies_validators(self):
        self.client.force_authenticate(user=self.soporte)
        response = self.client.post(
            self._url(self.student, "set-password/"),
            {"password": "123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)


class OwnPasswordTests(APITestCase):
    url = f"{ME_URL}password/"

    def setUp(self):
        sync_acl()
        self.user = User.objects.create_user(
            username="docente-pw",
            email="docente-pw@fouees.edu.sv",
            password=VALID_PASSWORD,
            role=User.Role.DOCENTE,
        )
        self.client.force_authenticate(user=self.user)

    def test_changes_own_password(self):
        response = self.client.post(
            self.url,
            {"current_password": VALID_PASSWORD, "new_password": "NuevaClave2026!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NuevaClave2026!"))

    def test_rejects_wrong_current_password(self):
        response = self.client.post(
            self.url,
            {"current_password": "no-es", "new_password": "NuevaClave2026!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("current_password", response.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(VALID_PASSWORD))

    def test_rejects_weak_or_similar_password(self):
        response = self.client.post(
            self.url,
            {"current_password": VALID_PASSWORD, "new_password": "docente-pw"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password", response.data)

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class CurrentUserTests(APITestCase):
    def setUp(self):
        sync_acl()
        self.user = User.objects.create_user(
            username="mgomez",
            email="maria.gomez@fouees.edu.sv",
            password=VALID_PASSWORD,
            first_name="María",
            last_name="Gómez",
            role=User.Role.ESTUDIANTE,
        )

    def test_me_returns_authenticated_user(self):
        tokens = self.client.post(
            TOKEN_URL,
            {"username": "mgomez", "password": VALID_PASSWORD},
            format="json",
        ).data
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        response = self.client.get(ME_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.user.id)
        self.assertEqual(response.data["username"], "mgomez")
        self.assertEqual(response.data["role"], User.Role.ESTUDIANTE)
        self.assertNotIn("password", response.data)
        self.assertIn("patients.view", response.data["permissions"])
        self.assertNotIn("users.create", response.data["permissions"])

    def test_me_requires_authentication(self):
        response = self.client.get(ME_URL)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class RolePermissionTests(APITestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = object()
        self.users = {
            role: User.objects.create_user(
                username=role,
                email=f"{role}@fouees.edu.sv",
                password=VALID_PASSWORD,
                role=role,
            )
            for role in User.Role.values
        }

    def _allows(self, permission, role):
        request = self.factory.get("/")
        request.user = self.users[role]
        return permission.has_permission(request, self.view)

    def test_is_admin_only_allows_admin(self):
        permission = IsAdmin()
        self.assertTrue(self._allows(permission, User.Role.ADMIN))
        self.assertFalse(self._allows(permission, User.Role.DOCENTE))
        self.assertFalse(self._allows(permission, User.Role.RECEPCION))

    def test_is_docente_only_allows_docente(self):
        permission = IsDocente()
        self.assertTrue(self._allows(permission, User.Role.DOCENTE))
        self.assertFalse(self._allows(permission, User.Role.ADMIN))

    def test_is_estudiante_only_allows_estudiante(self):
        permission = IsEstudiante()
        self.assertTrue(self._allows(permission, User.Role.ESTUDIANTE))
        self.assertFalse(self._allows(permission, User.Role.SOPORTE))

    def test_is_recepcion_only_allows_recepcion(self):
        permission = IsRecepcion()
        self.assertTrue(self._allows(permission, User.Role.RECEPCION))
        self.assertFalse(self._allows(permission, User.Role.ESTUDIANTE))

    def test_is_soporte_only_allows_soporte(self):
        permission = IsSoporte()
        self.assertTrue(self._allows(permission, User.Role.SOPORTE))
        self.assertFalse(self._allows(permission, User.Role.ADMIN))

    def test_is_admin_or_soporte_allows_both(self):
        permission = IsAdminOrSoporte()
        self.assertTrue(self._allows(permission, User.Role.ADMIN))
        self.assertTrue(self._allows(permission, User.Role.SOPORTE))
        self.assertFalse(self._allows(permission, User.Role.RECEPCION))


class AclSeedIsManualTests(APITestCase):
    def test_migrate_does_not_create_system_roles(self):
        from accounts.models import Role

        self.assertFalse(Role.objects.exists())


class AclMatrixTests(APITestCase):
    def setUp(self):
        sync_acl()
        self.admin = User.objects.create_user(
            username="admin",
            email="admin@fouees.edu.sv",
            password=VALID_PASSWORD,
            role=User.Role.ADMIN,
        )
        self.estudiante = User.objects.create_user(
            username="estudiante",
            email="estudiante@fouees.edu.sv",
            password=VALID_PASSWORD,
            role=User.Role.ESTUDIANTE,
        )
        self.recepcion = User.objects.create_user(
            username="recepcion",
            email="recepcion@fouees.edu.sv",
            password=VALID_PASSWORD,
            role=User.Role.RECEPCION,
        )

    def test_estudiante_inherits_role_permissions(self):
        self.assertTrue(self.estudiante.has_acl("patients.view"))
        self.assertTrue(self.estudiante.has_acl("assignments.claim"))
        self.assertTrue(self.estudiante.has_acl("clinical_records.create"))
        self.assertFalse(self.estudiante.has_acl("patients.create"))
        self.assertFalse(self.estudiante.has_acl("assignments.create"))
        self.assertFalse(self.estudiante.has_acl("roles.edit"))

    def test_recepcion_can_create_patients_not_clinical(self):
        self.assertTrue(self.recepcion.has_acl("patients.create"))
        self.assertTrue(self.recepcion.has_acl("assignments.assign_student"))
        self.assertFalse(self.recepcion.has_acl("clinical_records.create"))
        self.assertFalse(self.recepcion.has_acl("diagnoses.validate"))

    def test_estudiante_cannot_list_roles(self):
        self.client.force_authenticate(user=self.estudiante)
        response = self.client.get("/api/accounts/roles/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_lists_roles_and_catalog(self):
        self.client.force_authenticate(user=self.admin)
        listing = self.client.get("/api/accounts/roles/")
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        slugs = {item["slug"] for item in listing.data}
        self.assertEqual(
            slugs,
            {"admin", "docente", "estudiante", "recepcion", "soporte"},
        )

        catalog = self.client.get("/api/accounts/roles/catalog/")
        self.assertEqual(catalog.status_code, status.HTTP_200_OK)
        modules = [
            module["key"]
            for section in catalog.data["catalog"]
            for module in section["modules"]
        ]
        self.assertIn("patients", modules)
        self.assertTrue(
            any(
                action["name"] == "patients.view"
                for section in catalog.data["catalog"]
                for module in section["modules"]
                for action in module["actions"]
            )
        )

    def test_admin_syncs_role_permissions(self):
        from accounts.models import Role

        self.client.force_authenticate(user=self.admin)
        role = Role.objects.get(slug="estudiante")
        response = self.client.patch(
            f"/api/accounts/roles/{role.id}/",
            {"permissions": ["patients.view", "patients.create"]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertCountEqual(
            response.data["permissions"],
            ["patients.view", "patients.create"],
        )
        role.refresh_from_db()
        names = set(role.permissions.values_list("name", flat=True))
        self.assertEqual(names, {"patients.view", "patients.create"})

    def test_unknown_permission_is_rejected(self):
        from accounts.models import Role

        self.client.force_authenticate(user=self.admin)
        role = Role.objects.get(slug="estudiante")
        response = self.client.patch(
            f"/api/accounts/roles/{role.id}/",
            {"permissions": ["patients.hack"]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("permissions", response.data)

    def test_cannot_delete_system_role(self):
        from accounts.models import Role

        self.client.force_authenticate(user=self.admin)
        role = Role.objects.get(slug="estudiante")
        response = self.client.delete(f"/api/accounts/roles/{role.id}/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Role.objects.filter(slug="estudiante").exists())

    def test_admin_can_create_and_delete_custom_role(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/accounts/roles/",
            {
                "name": "Coordinador clínico",
                "description": "Apoya supervisión.",
                "permissions": ["patients.view", "supervision.view"],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Coordinador clínico")
        self.assertFalse(response.data["is_system"])
        self.assertCountEqual(
            response.data["permissions"],
            ["patients.view", "supervision.view"],
        )
        role_id = response.data["id"]
        deleted = self.client.delete(f"/api/accounts/roles/{role_id}/")
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)

    def test_estudiante_cannot_create_role(self):
        self.client.force_authenticate(user=self.estudiante)
        response = self.client.post(
            "/api/accounts/roles/",
            {"name": "Invitado"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class StudentListingTests(APITestCase):
    """ODO-16: docente y recepción leen solo estudiantes, con datos reducidos."""

    def setUp(self):
        sync_acl()
        self.admin = self._user("admin", User.Role.ADMIN)
        self.docente = self._user("docente", User.Role.DOCENTE)
        self.recepcion = self._user("recepcion", User.Role.RECEPCION)
        self.est1 = self._user(
            "est1", User.Role.ESTUDIANTE, first_name="Ana", last_name="Pérez"
        )
        self.est2 = self._user("est2", User.Role.ESTUDIANTE)
        self.student_ids = {self.est1.id, self.est2.id}

    def _user(self, username, role, **extra):
        return User.objects.create_user(
            username=username,
            email=f"{username}@fouees.edu.sv",
            password=VALID_PASSWORD,
            role=role,
            **extra,
        )

    def _ids(self, response):
        return {row["id"] for row in response.data["results"]}

    def test_docente_and_recepcion_list_only_students(self):
        for user in (self.docente, self.recepcion):
            with self.subTest(role=user.role):
                self.client.force_authenticate(user=user)
                response = self.client.get(USERS_URL)
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(self._ids(response), self.student_ids)

    def test_students_list_uses_light_fields(self):
        self.client.force_authenticate(user=self.docente)
        rows = self.client.get(USERS_URL).data["results"]
        self.assertEqual(set(rows[0]), {"id", "name", "email"})
        # Nombre completo, o el usuario si no tiene nombre.
        self.assertEqual({row["name"] for row in rows}, {"Ana Pérez", "est2"})

    def test_role_param_cannot_widen_the_list(self):
        self.client.force_authenticate(user=self.docente)
        response = self.client.get(USERS_URL, {"role": User.Role.ADMIN})
        self.assertEqual(self._ids(response), self.student_ids)

    def test_admin_lists_everyone_and_filters_by_role(self):
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(self.client.get(USERS_URL).data["count"], 5)
        response = self.client.get(USERS_URL, {"role": User.Role.ESTUDIANTE})
        self.assertEqual(self._ids(response), self.student_ids)
        # Quien gestiona usuarios conserva el serializer completo.
        self.assertIn("username", response.data["results"][0])
        self.assertEqual(self.client.get(USERS_URL, {"role": "x"}).data["count"], 5)

    def test_docente_retrieves_student_but_not_other_roles(self):
        self.client.force_authenticate(user=self.docente)
        response = self.client.get(f"{USERS_URL}{self.est1.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(set(response.data), {"id", "name", "email"})
        response = self.client.get(f"{USERS_URL}{self.admin.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_estudiante_cannot_list_users(self):
        self.client.force_authenticate(user=self.est1)
        self.assertEqual(
            self.client.get(USERS_URL).status_code, status.HTTP_403_FORBIDDEN
        )


NOTIFICATIONS_URL = "/api/accounts/notifications/"


class NotificationApiTests(APITestCase):
    """ODO-68: cada usuario ve y marca solo sus avisos."""

    def setUp(self):
        sync_acl()
        self.ana = User.objects.create_user(
            username="ana", password=VALID_PASSWORD, role=User.Role.ESTUDIANTE
        )
        self.luis = User.objects.create_user(
            username="luis", password=VALID_PASSWORD, role=User.Role.DOCENTE
        )
        kind = Notification.Kind.PATIENT_ASSIGNED
        self.first, self.second = notify([self.ana, self.ana], kind, "Aviso")
        (self.others,) = notify([self.luis], kind, "Aviso de Luis")
        self.client.force_authenticate(user=self.ana)

    def test_lists_only_own_notifications(self):
        response = self.client.get(NOTIFICATIONS_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {row["id"] for row in response.data["results"]}
        self.assertEqual(ids, {self.first.id, self.second.id})
        self.assertFalse(response.data["results"][0]["is_read"])

    def test_cannot_read_or_mark_someone_elses(self):
        url = f"{NOTIFICATIONS_URL}{self.others.id}/read/"
        self.assertEqual(self.client.post(url).status_code, status.HTTP_404_NOT_FOUND)
        self.others.refresh_from_db()
        self.assertIsNone(self.others.read_at)

    def test_mark_one_then_count_and_filter_unread(self):
        response = self.client.post(f"{NOTIFICATIONS_URL}{self.first.id}/read/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_read"])
        count = self.client.get(f"{NOTIFICATIONS_URL}unread-count/").data
        self.assertEqual(count, {"count": 1})
        unread = self.client.get(NOTIFICATIONS_URL, {"unread": "true"}).data
        self.assertEqual([row["id"] for row in unread["results"]], [self.second.id])

    def test_read_all_only_touches_own(self):
        response = self.client.post(f"{NOTIFICATIONS_URL}read-all/")
        self.assertEqual(response.data, {"updated": 2})
        self.others.refresh_from_db()
        self.assertIsNone(self.others.read_at)
        count = self.client.get(f"{NOTIFICATIONS_URL}unread-count/").data
        self.assertEqual(count, {"count": 0})

    def test_requires_notifications_view(self):
        role = Role.objects.get(slug=User.Role.ESTUDIANTE)
        role.permissions.remove(*role.permissions.filter(name="notifications.view"))
        ana = User.objects.get(pk=self.ana.pk)  # sin la caché de permisos
        self.client.force_authenticate(user=ana)
        for url in (NOTIFICATIONS_URL, f"{NOTIFICATIONS_URL}unread-count/"):
            with self.subTest(url=url):
                self.assertEqual(
                    self.client.get(url).status_code, status.HTTP_403_FORBIDDEN
                )
        self.assertEqual(
            self.client.post(f"{NOTIFICATIONS_URL}read-all/").status_code,
            status.HTTP_403_FORBIDDEN,
        )

