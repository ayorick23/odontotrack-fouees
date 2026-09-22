from rest_framework.exceptions import PermissionDenied

from accounts.models import User
from patients.models import Patient

from .catalog import default_tooth_findings
from .models import Odontogram


class OdontogramService:
    @staticmethod
    def get_or_create(patient: Patient) -> Odontogram:
        odontogram, created = Odontogram.objects.get_or_create(
            patient=patient,
            defaults={"teeth": default_tooth_findings()},
        )
        if created is False and not odontogram.teeth:
            odontogram.teeth = default_tooth_findings()
            odontogram.save(update_fields=["teeth"])
        return odontogram

    @staticmethod
    def assert_can_view(user: User, _patient: Patient) -> None:
        if not user.has_acl("odontogram.view"):
            raise PermissionDenied("No puedes ver este odontograma.")

    @staticmethod
    def assert_can_update(user: User, _patient: Patient) -> None:
        if not user.has_acl("odontogram.update"):
            raise PermissionDenied("No puedes actualizar este odontograma.")
