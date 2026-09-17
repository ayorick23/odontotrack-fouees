from rest_framework import status
from rest_framework.test import APITestCase


class SchemaDocsTests(APITestCase):
    def test_openapi_schema_is_public(self):
        response = self.client.get("/api/schema/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("openapi", response.content.decode())

    def test_swagger_ui_is_public(self):
        response = self.client.get("/api/docs/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, "swagger")
