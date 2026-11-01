"""La práctica indicada por pieza pasa a ser una marca Plan con tratamiento.

Antes cada diente tenía `practice: {indicated, clinicalArea,
clinicalTreatment}` aparte de sus marcas. Ahora la práctica es una marca
de la capa Plan con `treatment` (y el símbolo que define el tarifario),
así que se convierte y se quita la clave `practice`. Una práctica sin
tratamiento elegido (solo área) no se puede planificar y se descarta.
"""

from django.db import migrations

WHOLE_TOOTH_STATUSES = {
    "extraido",
    "implante",
    "puente",
    "raiz_retenida",
    "no_erupcionado",
    "ausente_congenito",
}


def _convert(teeth, status_by_slug):
    dropped = 0
    for tooth in teeth or []:
        practice = tooth.pop("practice", None) or {}
        if not practice.get("indicated"):
            continue
        slug = practice.get("clinicalTreatment")
        if not slug:
            dropped += 1
            continue
        status = status_by_slug.get(slug) or None
        marks = tooth.setdefault("marks", [])
        if status in WHOLE_TOOTH_STATUSES:
            # Ocupa toda la pieza en Plan, como en normalize_tooth_marks.
            marks[:] = [mark for mark in marks if mark.get("layer") != "plan"]
        if not any(
            mark.get("layer") == "plan" and mark.get("treatment") == slug
            for mark in marks
        ):
            marks.append(
                {"layer": "plan", "status": status, "surfaces": [], "treatment": slug}
            )
    return dropped


def forwards(apps, schema_editor):
    ClinicalTreatment = apps.get_model("catalogs", "ClinicalTreatment")
    Odontogram = apps.get_model("clinical_records", "Odontogram")
    OdontogramRevision = apps.get_model("clinical_records", "OdontogramRevision")
    status_by_slug = dict(
        ClinicalTreatment.objects.values_list("slug", "odontogram_status")
    )
    dropped = 0
    for model in (Odontogram, OdontogramRevision):
        for record in model.objects.all():
            dropped += _convert(record.teeth, status_by_slug)
            record.save(update_fields=["teeth"])
    if dropped:
        print(f"\n  {dropped} práctica(s) sin tratamiento elegido descartada(s).")


def backwards(apps, schema_editor):
    Odontogram = apps.get_model("clinical_records", "Odontogram")
    OdontogramRevision = apps.get_model("clinical_records", "OdontogramRevision")
    ClinicalTreatment = apps.get_model("catalogs", "ClinicalTreatment")
    area_by_slug = dict(ClinicalTreatment.objects.values_list("slug", "area__slug"))
    for model in (Odontogram, OdontogramRevision):
        for record in model.objects.all():
            for tooth in record.teeth or []:
                plan = next(
                    (
                        mark
                        for mark in tooth.get("marks") or []
                        if mark.get("layer") == "plan" and mark.get("treatment")
                    ),
                    None,
                )
                tooth["practice"] = (
                    {
                        "indicated": True,
                        "clinicalArea": area_by_slug.get(plan["treatment"]),
                        "clinicalTreatment": plan["treatment"],
                    }
                    if plan
                    else {"indicated": False, "clinicalArea": None, "clinicalTreatment": None}
                )
                tooth["marks"] = [
                    {key: value for key, value in mark.items() if key != "treatment"}
                    for mark in tooth.get("marks") or []
                    if mark.get("status")
                ]
            record.save(update_fields=["teeth"])


class Migration(migrations.Migration):
    dependencies = [
        ("clinical_records", "0005_created_by"),
        ("catalogs", "0004_seed_odontogram_status"),
    ]

    operations = [migrations.RunPython(forwards, backwards)]
