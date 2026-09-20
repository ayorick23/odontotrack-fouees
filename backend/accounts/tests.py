from rest_framework import status
from rest_framework.test import APIRequestFactory, APITestCase

from accounts.models import User
from accounts.permissions import (
    IsAdmin,
    IsAdminOrSoporte,
    IsDocente,
    IsEstudiante,
    IsRecepcion,
    IsSoporte,
)

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


class CurrentUserTests(APITestCase):
    def setUp(self):
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


class AclMatrixTests(APITestCase):
    def setUp(self):
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
        self.assertTrue(self.estudiante.has_acl("clinical_records.create"))
        self.assertFalse(self.estudiante.has_acl("patients.create"))
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
