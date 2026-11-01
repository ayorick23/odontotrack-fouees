from rest_framework import serializers


class IndicatorSerializer(serializers.Serializer):
    percent = serializers.FloatField(allow_null=True)
    count = serializers.IntegerField()
    total = serializers.IntegerField()


class DashboardIndicatorsSerializer(serializers.Serializer):
    """Fórmulas documentadas en dashboard/indicators.py. None = no aplica."""

    digitalization = IndicatorSerializer(allow_null=True)
    validated_diagnoses = IndicatorSerializer(allow_null=True)
    cases_with_validated_diagnosis = IndicatorSerializer(allow_null=True)


class DashboardSummarySerializer(serializers.Serializer):
    total_patients = serializers.IntegerField()
    total_assignments = serializers.IntegerField()
    total_clinical_records = serializers.IntegerField()
    patients_by_status = serializers.DictField(child=serializers.IntegerField())


class DashboardMonthPointSerializer(serializers.Serializer):
    month = serializers.CharField()
    label = serializers.CharField()
    patients = serializers.IntegerField()
    pendiente = serializers.IntegerField()
    en_proceso = serializers.IntegerField()
    finalizado = serializers.IntegerField()
    assignments = serializers.IntegerField()


class DashboardStatusSliceSerializer(serializers.Serializer):
    status = serializers.CharField()
    label = serializers.CharField()
    count = serializers.IntegerField()


class DashboardSeriesSerializer(serializers.Serializer):
    months = DashboardMonthPointSerializer(many=True)
    by_status = DashboardStatusSliceSerializer(many=True)


# --- /dashboard/overview/ (bloques por permiso; ver overview.py) ---


class CaseRowSerializer(serializers.Serializer):
    patient_id = serializers.IntegerField()
    patient_name = serializers.CharField()
    next_appointment = serializers.DateTimeField(allow_null=True)


class AppointmentRowSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    starts_at = serializers.DateTimeField()
    patient_id = serializers.IntegerField()
    patient_name = serializers.CharField()
    student_name = serializers.CharField(required=False)


class MyCasesSerializer(serializers.Serializer):
    cases = CaseRowSerializer(many=True)
    upcoming_appointments = AppointmentRowSerializer(many=True)
    diagnoses_awaiting_validation = serializers.IntegerField()
    bank_available = serializers.IntegerField()
    done_treatments_in_my_cases = serializers.IntegerField()


class SupervisionBlockSerializer(serializers.Serializer):
    diagnoses_to_validate = serializers.IntegerField()
    cases_in_progress = serializers.IntegerField()
    students_with_active_cases = serializers.IntegerField()
    indicators = DashboardIndicatorsSerializer()


class BankBlockSerializer(serializers.Serializer):
    unassigned = serializers.IntegerField()
    registered_this_month = serializers.IntegerField()
    today_appointments = AppointmentRowSerializer(many=True)
    average_wait_days = serializers.FloatField(allow_null=True)


class AreaStatusSerializer(serializers.Serializer):
    area = serializers.CharField()
    pendiente = serializers.IntegerField()
    en_proceso = serializers.IntegerField()
    finalizado = serializers.IntegerField()


class BankDemandSerializer(serializers.Serializer):
    treatment = serializers.CharField()
    name = serializers.CharField()
    area = serializers.CharField(allow_blank=True)
    count = serializers.IntegerField()


class FacultyBlockSerializer(serializers.Serializer):
    by_area = AreaStatusSerializer(many=True)
    bank_demand = BankDemandSerializer(many=True)


class RoleCountSerializer(serializers.Serializer):
    role = serializers.CharField()
    label = serializers.CharField()
    count = serializers.IntegerField()


class AccountsBlockSerializer(serializers.Serializer):
    active_by_role = RoleCountSerializer(many=True)
    inactive = serializers.IntegerField()


class DashboardOverviewSerializer(serializers.Serializer):
    """Cada bloque es None si el usuario no tiene el permiso que lo habilita."""

    my_cases = MyCasesSerializer(allow_null=True)
    supervision = SupervisionBlockSerializer(allow_null=True)
    bank = BankBlockSerializer(allow_null=True)
    faculty = FacultyBlockSerializer(allow_null=True)
    accounts = AccountsBlockSerializer(allow_null=True)
