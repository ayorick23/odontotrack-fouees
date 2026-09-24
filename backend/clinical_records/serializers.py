from rest_framework import serializers

from .catalog import (
    FDI_ALL_TOOTH_NUMBER_SET,
    ToothLayer,
    ToothStatus,
    ToothSurface,
    default_tooth_findings,
    derive_oral_marks,
    is_fdi_tooth,
    normalize_tooth,
    pad_teeth,
)
from .models import (
    Diagnostico,
    EvolucionClinica,
    Odontogram,
    OdontogramRevision,
    Tratamiento,
)
from .services import user_display_name


class DiagnosticoSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    validated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Diagnostico
        fields = (
            "id",
            "patient",
            "student",
            "student_name",
            "content",
            "validated_by",
            "validated_by_name",
            "is_validated",
            "validated_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = [
            "student",
            "student_name",
            "validated_by",
            "validated_by_name",
            "is_validated",
            "validated_at",
        ]

    def get_student_name(self, obj: Diagnostico) -> str | None:
        return user_display_name(obj.student)

    def get_validated_by_name(self, obj: Diagnostico) -> str | None:
        return user_display_name(obj.validated_by)


class TratamientoSerializer(serializers.ModelSerializer):
    clinical_area_name = serializers.CharField(
        source="clinical_area.name",
        read_only=True,
    )
    clinical_treatment_name = serializers.CharField(
        source="clinical_treatment.name",
        read_only=True,
    )

    class Meta:
        model = Tratamiento
        fields = (
            "id",
            "patient",
            "clinical_area",
            "clinical_area_name",
            "clinical_treatment",
            "clinical_treatment_name",
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
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = EvolucionClinica
        fields = (
            "id",
            "patient",
            "student",
            "student_name",
            "date",
            "note",
            "created_at",
            "updated_at",
        )
        read_only_fields = ["student", "student_name"]

    def get_student_name(self, obj: EvolucionClinica) -> str | None:
        return user_display_name(obj.student)


class ToothMarkSerializer(serializers.Serializer):
    layer = serializers.ChoiceField(choices=ToothLayer.choices)
    status = serializers.ChoiceField(choices=ToothStatus.choices)
    surfaces = serializers.ListField(
        child=serializers.ChoiceField(choices=ToothSurface.choices),
        required=False,
        default=list,
    )


class ToothOralMarksSerializer(serializers.Serializer):
    placa = serializers.BooleanField(required=False, default=False)
    sangrado = serializers.BooleanField(required=False, default=False)
    sarro = serializers.BooleanField(required=False, default=False)


class ToothPracticeSerializer(serializers.Serializer):
    indicated = serializers.BooleanField(required=False, default=False)
    clinicalArea = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        max_length=80,
    )


class ToothFindingSerializer(serializers.Serializer):
    fdi = serializers.IntegerField()
    marks = ToothMarkSerializer(many=True, required=False)
    oralMarks = ToothOralMarksSerializer(required=False)
    practice = ToothPracticeSerializer(required=False)
    status = serializers.ChoiceField(
        choices=ToothStatus.choices,
        required=False,
    )
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
        if not is_fdi_tooth(value):
            raise serializers.ValidationError("Número FDI inválido.")
        return value

    def validate(self, attrs: dict) -> dict:
        return normalize_tooth(attrs)


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
        unknown = set(numbers) - FDI_ALL_TOOTH_NUMBER_SET
        if unknown:
            raise serializers.ValidationError("Número FDI inválido.")
        padded = pad_teeth(value)
        derived = derive_oral_marks(padded)
        self.context["derived_oral_marks"] = derived
        return padded

    def update(self, instance, validated_data):
        derived = self.context.get("derived_oral_marks")
        if derived and any(derived.values()):
            validated_data["placa"] = derived["placa"]
            validated_data["sangrado"] = derived["sangrado"]
            validated_data["sarro"] = derived["sarro"]
        return super().update(instance, validated_data)

    def to_representation(self, instance: Odontogram) -> dict:
        data = super().to_representation(instance)
        if not data.get("teeth"):
            data["teeth"] = default_tooth_findings()
            return data
        data["teeth"] = [normalize_tooth(tooth) for tooth in data["teeth"]]
        derived = derive_oral_marks(data["teeth"])
        if any(derived.values()):
            data["placa"] = derived["placa"]
            data["sangrado"] = derived["sangrado"]
            data["sarro"] = derived["sarro"]
        return data


class OdontogramRevisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = OdontogramRevision
        fields = (
            "id",
            "placa",
            "sangrado",
            "sarro",
            "teeth",
            "visual_snapshot",
            "created_at",
            "created_by",
        )
        read_only_fields = fields

    def to_representation(self, instance: OdontogramRevision) -> dict:
        data = super().to_representation(instance)
        data["teeth"] = [
            normalize_tooth(tooth) for tooth in (instance.teeth or [])
        ]
        return data
