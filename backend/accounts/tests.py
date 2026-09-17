from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User

TOKEN_URL = "/api/auth/token/"
USERS_URL = "/api/accounts/users/"
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
