from rest_framework import serializers

from .catalog import (
    FDI_TOOTH_NUMBERS,
    FDI_TOOTH_NUMBER_SET,
    ToothStatus,
    ToothSurface,
    combine_tooth_statuses,
    default_tooth_findings,
    is_fdi_permanent_tooth,
    primary_tooth_status,
)
from .models import Diagnostico, EvolucionClinica, Odontogram, Tratamiento


class DiagnosticoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Diagnostico
        fields = (
            "id",
            "patient",
            "student",
            "content",
            "validated_by",
            "is_validated",
            "validated_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ["validated_by", "is_validated", "validated_at"]


class TratamientoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tratamiento
        fields = (
            "id",
            "patient",
            "clinical_area",
            "clinical_treatment",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        clinical_area = attrs.get("clinical_area") or getattr(
            self.instance, "clinical_area", None
        )
        clinical_treatment = attrs.get("clinical_treatment") or getattr(
            self.instance, "clinical_treatment", None
        )
        if clinical_treatment and clinical_area and clinical_treatment.area_id != clinical_area.id:
            raise serializers.ValidationError(
                {
                    "clinical_treatment": (
                        "El tratamiento no corresponde al área clínica seleccionada."
                    )
                }
            )
        return attrs


class EvolucionClinicaSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvolucionClinica
        fields = (
            "id",
            "patient",
            "student",
            "date",
            "note",
            "created_at",
            "updated_at",
        )


class ToothFindingSerializer(serializers.Serializer):
    fdi = serializers.IntegerField()
    status = serializers.ChoiceField(choices=ToothStatus.choices)
    statuses = serializers.ListField(
        child=serializers.ChoiceField(choices=ToothStatus.choices),
        required=False,
        default=list,
    )
    surfaces = serializers.ListField(
        child=serializers.ChoiceField(choices=ToothSurface.choices),
        required=False,
        default=list,
    )

    def validate_fdi(self, value: int) -> int:
        if not is_fdi_permanent_tooth(value):
            raise serializers.ValidationError("Número FDI inválido.")
        return value

    def validate(self, attrs: dict) -> dict:
        statuses = combine_tooth_statuses(attrs["status"], attrs.get("statuses"))
        attrs["statuses"] = statuses
        attrs["status"] = primary_tooth_status(statuses)
        return attrs


class OdontogramSerializer(serializers.ModelSerializer):
    teeth = ToothFindingSerializer(many=True)

    class Meta:
        model = Odontogram
        fields = (
            "patient",
            "placa",
            "sangrado",
            "sarro",
            "teeth",
            "visual_snapshot",
            "updated_at",
        )
        read_only_fields = ["patient", "updated_at"]

    def validate_teeth(self, value: list[dict]) -> list[dict]:
        numbers = [finding["fdi"] for finding in value]
        if len(numbers) != len(set(numbers)):
            raise serializers.ValidationError("Hay dientes FDI repetidos.")
        unknown = set(numbers) - FDI_TOOTH_NUMBER_SET
        if unknown:
            raise serializers.ValidationError("Número FDI inválido.")
        by_fdi = {finding["fdi"]: finding for finding in value}
        return [
            by_fdi.get(
                number,
                {
                    "fdi": number,
                    "status": ToothStatus.SANO,
                    "statuses": [],
                    "surfaces": [],
                },
            )
            for number in FDI_TOOTH_NUMBERS
        ]

    def to_representation(self, instance: Odontogram) -> dict:
        data = super().to_representation(instance)
        if not data.get("teeth"):
            data["teeth"] = default_tooth_findings()
        for tooth in data["teeth"]:
            statuses = combine_tooth_statuses(
                tooth.get("status", ToothStatus.SANO),
                tooth.get("statuses"),
            )
            tooth["statuses"] = statuses
            tooth["status"] = primary_tooth_status(statuses)
        return data
