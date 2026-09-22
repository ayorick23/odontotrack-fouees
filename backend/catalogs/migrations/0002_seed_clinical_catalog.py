from django.db import migrations


def seed_clinical_catalog(apps, schema_editor):
    from catalogs.seed import CLINICAL_CATALOG

    ClinicalArea = apps.get_model("catalogs", "ClinicalArea")
    ClinicalTreatment = apps.get_model("catalogs", "ClinicalTreatment")
    for area_order, (slug, name, treatments) in enumerate(CLINICAL_CATALOG):
        area = ClinicalArea.objects.create(
            slug=slug,
            name=name,
            sort_order=area_order,
        )
        for treatment_order, (treatment_slug, treatment_name) in enumerate(
            treatments
        ):
            ClinicalTreatment.objects.create(
                area=area,
                slug=treatment_slug,
                name=treatment_name,
                sort_order=treatment_order,
            )


class Migration(migrations.Migration):

    dependencies = [
        ("catalogs", "0001_initial_clinical_catalog"),
    ]

    operations = [
        migrations.RunPython(seed_clinical_catalog, migrations.RunPython.noop),
    ]
