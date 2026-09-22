from django.db import migrations, models
import django.db.models.deletion


def copy_clinical_slugs_to_fks(apps, schema_editor):
    Patient = apps.get_model("patients", "Patient")
    ClinicalArea = apps.get_model("catalogs", "ClinicalArea")
    ClinicalTreatment = apps.get_model("catalogs", "ClinicalTreatment")
    areas = {area.slug: area.pk for area in ClinicalArea.objects.all()}
    treatments = {
        treatment.slug: treatment.pk
        for treatment in ClinicalTreatment.objects.all()
    }
    for patient in Patient.objects.all():
        Patient.objects.filter(pk=patient.pk).update(
            clinical_area_fk_id=areas.get(patient.clinical_area or "") or None,
            clinical_treatment_id=treatments.get(patient.clinical_subcategory or "")
            or None,
        )


class Migration(migrations.Migration):

    dependencies = [
        ("catalogs", "0002_seed_clinical_catalog"),
        ("patients", "0005_add_diagnostico_and_clinical_subcategory"),
    ]

    operations = [
        migrations.AddField(
            model_name="patient",
            name="clinical_area_fk",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="patients",
                to="catalogs.clinicalarea",
            ),
        ),
        migrations.AddField(
            model_name="patient",
            name="clinical_treatment",
            field=models.ForeignKey(
                blank=True,
                help_text="Tratamiento del catálogo FOUEES según el área clínica.",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="patients",
                to="catalogs.clinicaltreatment",
            ),
        ),
        migrations.RunPython(copy_clinical_slugs_to_fks, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="patient",
            name="clinical_area",
        ),
        migrations.RemoveField(
            model_name="patient",
            name="clinical_subcategory",
        ),
        migrations.RenameField(
            model_name="patient",
            old_name="clinical_area_fk",
            new_name="clinical_area",
        ),
    ]
