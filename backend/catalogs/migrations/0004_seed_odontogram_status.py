"""Símbolo del odontograma para cada tratamiento del tarifario actual.

Al planificar un tratamiento en una pieza, el odontograma lo dibuja con
este símbolo. Los que no son de una pieza o no tienen dibujo (diagnóstico,
periodoncia, profilaxis, prótesis removible...) quedan vacíos: se listan
pero no se dibujan. El admin puede cambiarlo desde el tarifario.
"""

from django.db import migrations

ODONTOGRAM_STATUS = {
    # Endodoncia
    "endodoncia_monorradicular": "endodoncia",
    "endodoncia_multirradicular": "endodoncia",
    "retratamiento_monorradicular": "endodoncia",
    "retratamiento_multirradicular": "endodoncia",
    "pulpectomia_vitapex": "endodoncia",
    "pulpotomia": "pulpotomia",
    # Exodoncia
    "exodoncia_simple_diente_permanente": "extraido",
    "exodoncia_complicada_diente_permanente": "extraido",
    "extraccion_multiple_con_regularizacion": "extraido",
    "exodoncia_diente_primario": "extraido",
    "cirugia_diente_impactado": "extraido",
    # Restauraciones
    "reconstruccion_ionomero_vidrio_infantil": "obturado",
    "reconstruccion_ionomero_vidrio_adulto": "obturado",
    "reconstruccion_nucleo_colado": "obturado",
    "reconstruccion_pin_std": "obturado",
    "reconstruccion_poste_fibra_vidrio": "obturado",
    "reconstruccion_con_resina": "obturado",
    "reposicion_poste_fibra_vidrio": "obturado",
    "resina_dt_una_superficie_infantil": "obturado",
    "resina_dt_dos_o_mas_superficies_infantil": "obturado",
    "resina_composita_indirecta_adulto": "obturado",
    "resina_una_superficie_adulto": "obturado",
    "resina_dos_o_mas_superficies_adulto": "obturado",
    "resina_fluida_adulto": "obturado",
    "laminado_de_resina": "obturado",
    "incrustacion_ceromero": "obturado",
    "incrustacion_zirconio_tradicional": "obturado",
    "incrustacion_zirconio_cad_cam": "obturado",
    "incrustacion_metalica": "obturado",
    # Sellantes
    "sellante_fosas_fisuras_infantil": "sellante",
    "sellante_fosas_fisuras_adulto": "sellante",
    "resina_preventiva_fotocurado_sff_infantil": "sellante",
    "resina_preventiva_adulto": "sellante",
    "ameloplastia_resina_fluida_sff": "sellante",
    # Prótesis fija
    "corona_de_acero": "corona",
    "corona_ceromero_fibra_vidrio_posteriores": "corona",
    "corona_silicato_de_litio": "corona",
    "corona_individual_zirconio_tradicional": "corona",
    "corona_individual_zirconio_cad_cam": "corona",
    "corona_individual_hombro_porcelana": "corona",
    "corona_individual_metal_porcelana": "corona",
    "corona_individual_porcelana_yeso_refractario": "corona",
    "corona_metalica": "corona",
    "protesis_fija_3_unidades_metal_porcelana": "puente",
}


def seed(apps, schema_editor):
    ClinicalTreatment = apps.get_model("catalogs", "ClinicalTreatment")
    for slug, status in ODONTOGRAM_STATUS.items():
        ClinicalTreatment.objects.filter(slug=slug).update(odontogram_status=status)


def unseed(apps, schema_editor):
    ClinicalTreatment = apps.get_model("catalogs", "ClinicalTreatment")
    ClinicalTreatment.objects.update(odontogram_status="")


class Migration(migrations.Migration):
    dependencies = [("catalogs", "0003_treatment_odontogram_status")]

    operations = [migrations.RunPython(seed, unseed)]
