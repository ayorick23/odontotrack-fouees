"""Las marcas Hecho sin tratamiento pasan a Hallazgo (diagnóstico).

El odontograma queda en dos vistas: Diagnóstico (lo que el paciente trae,
incluidas restauraciones de antes) y Plan de tratamiento (con "Realizado"
para lo terminado). Hecho queda solo para tratamientos del plan ya
realizados, que siempre llevan `treatment`. Una corona marcada como
"hecho" sin tratamiento era un antecedente: ahora es diagnóstico.

Si al juntarlas chocan dos estados de pieza completa, gana el diagnóstico
que ya existía (es la lectura actual de la boca).

La reversa no hace nada: una vez juntas no se sabe cuáles venían de Hecho,
y las marcas siguen ahí con su estado y superficies.
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


def _key(mark):
    return (
        mark.get("layer"),
        mark.get("status"),
        tuple(mark.get("surfaces") or []),
        mark.get("treatment"),
    )


def _exclusive(marks):
    """Como catalog.apply_layer_exclusivity: un estado de pieza completa
    ocupa su capa; si hay varios, queda el último."""
    whole_by_layer = {}
    kept = []
    for mark in marks:
        if mark.get("status") in WHOLE_TOOTH_STATUSES:
            whole_by_layer[mark.get("layer")] = mark
        else:
            kept.append(mark)
    return [m for m in kept if m.get("layer") not in whole_by_layer] + list(
        whole_by_layer.values()
    )


def _convert(teeth):
    converted = 0
    for tooth in teeth or []:
        marks = tooth.get("marks") or []
        moved = [
            {**mark, "layer": "hallazgo"}
            for mark in marks
            if mark.get("layer") == "hecho" and not mark.get("treatment")
        ]
        if not moved:
            continue
        converted += len(moved)
        rest = [
            mark
            for mark in marks
            if not (mark.get("layer") == "hecho" and not mark.get("treatment"))
        ]
        merged, seen = [], set()
        # Las movidas primero: ante un choque gana el diagnóstico existente.
        for mark in moved + rest:
            key = _key(mark)
            if key not in seen:
                seen.add(key)
                merged.append(mark)
        tooth["marks"] = _exclusive(merged)
    return converted


def forwards(apps, schema_editor):
    total = 0
    for model_name in ("Odontogram", "OdontogramRevision"):
        model = apps.get_model("clinical_records", model_name)
        for item in model.objects.all():
            converted = _convert(item.teeth)
            if converted:
                total += converted
                item.save(update_fields=["teeth"])
    if total:
        print(f"\n  {total} marcas Hecho sin tratamiento pasaron a diagnóstico.")


class Migration(migrations.Migration):
    dependencies = [
        ("clinical_records", "0006_practice_to_plan_marks"),
    ]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
