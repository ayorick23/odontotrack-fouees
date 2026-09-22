# Catálogo inicial FOUEES (tarifario ciclo 02-2023).
# Solo se usa para sembrar la BD; el alta posterior es por API/admin.

CLINICAL_CATALOG: tuple[tuple[str, str, tuple[tuple[str, str], ...]], ...] = (
    (
        "diagnostico",
        "Diagnóstico",
        (
            ("diagnostico_con_rx_panoramica", "Diagnóstico con RX panorámica"),
            (
                "diagnostico_sin_radiografia_panoramica",
                "Diagnóstico sin radiografía panorámica",
            ),
            (
                "actualizacion_radiografia_panoramica",
                "Actualización de radiografía panorámica",
            ),
            (
                "actualizacion_radiografia_cefalometrica",
                "Actualización de radiografía cefalométrica",
            ),
        ),
    ),
    (
        "endodoncia",
        "Endodoncia",
        (
            ("endodoncia_monorradicular", "Endodoncia monorradicular"),
            ("endodoncia_multirradicular", "Endodoncia multirradicular"),
            ("retratamiento_monorradicular", "Retratamiento monorradicular"),
            ("retratamiento_multirradicular", "Retratamiento multirradicular"),
            ("cirugia_periapical", "Cirugía periapical"),
        ),
    ),
    (
        "cirugia",
        "Exodoncia y cirugía",
        (
            ("alveolitis", "Alveolitis"),
            ("cirugia_diente_impactado", "Cirugía de diente impactado"),
            ("cirugia_para_biopsia", "Cirugía para biopsia"),
            ("drenaje_absceso", "Drenaje de absceso"),
            (
                "exodoncia_complicada_diente_permanente",
                "Exodoncia complicada de diente permanente",
            ),
            (
                "exodoncia_simple_diente_permanente",
                "Exodoncia simple de diente permanente",
            ),
            (
                "extraccion_multiple_con_regularizacion",
                "Extracción múltiple c/ regularización",
            ),
            ("levantamiento_colgajo", "Levantamiento de colgajo"),
            ("ranula_o_mucocele", "Ránula o mucocele"),
            ("retiro_de_puntos", "Retiro de puntos"),
        ),
    ),
    (
        "odontopediatria",
        "Odontopediatría",
        (
            ("ameloplastia_resina_fluida_sff", "Ameloplastia (resina fluida + SFF)"),
            ("aparato_fijo_ortodoncia", "Aparato fijo de ortodoncia"),
            ("aparato_removible_con_expansion", "Aparato removible con expansión"),
            ("aparato_removible_ortodoncia", "Aparato removible de ortodoncia"),
            ("aparato_semifijo_ortodoncia", "Aparato semifijo de ortodoncia"),
            ("aplicacion_barniz_bebe", "Aplicación de barniz bebé"),
            ("aplicacion_barniz_infantil", "Aplicación de barniz infantil"),
            ("cefalometrica_dx_infantil", "Cefalométrica para dx. infantil"),
            ("corona_de_acero", "Corona de acero"),
            ("exodoncia_diente_primario", "Exodoncia de diente primario"),
            ("profilaxis_y_atf", "Profilaxis y ATF"),
            ("pulpectomia_vitapex", "Pulpectomía + Vitapex"),
            ("pulpotomia", "Pulpotomía"),
            (
                "reconstruccion_ionomero_vidrio_infantil",
                "Reconstrucción de ionómero de vidrio (infantil)",
            ),
            (
                "resina_dt_dos_o_mas_superficies_infantil",
                "Resina DT dos o más superficies (infantil)",
            ),
            (
                "resina_dt_una_superficie_infantil",
                "Resina DT una superficie (infantil)",
            ),
            (
                "resina_preventiva_fotocurado_sff_infantil",
                "Resina preventiva (res. fotocurado + SFF) (infantil)",
            ),
            (
                "sellante_fosas_fisuras_infantil",
                "Sellante de fosas y fisuras (infantil)",
            ),
        ),
    ),
    (
        "operatoria",
        "Operatoria",
        (
            ("ameloplastia_adulto", "Ameloplastia adulto"),
            ("aplicacion_barniz_adulto", "Aplicación barniz adulto"),
            ("laminado_de_resina", "Laminado de resina"),
            (
                "reconstruccion_ionomero_vidrio_adulto",
                "Reconstrucción con ionómero de vidrio (adulto)",
            ),
            ("reconstruccion_nucleo_colado", "Reconstrucción con núcleo colado"),
            ("reconstruccion_pin_std", "Reconstrucción con pin STD"),
            (
                "reconstruccion_poste_fibra_vidrio",
                "Reconstrucción con poste de fibra de vidrio",
            ),
            ("reconstruccion_con_resina", "Reconstrucción con resina"),
            (
                "reposicion_poste_fibra_vidrio",
                "Reposición de poste fibra de vidrio",
            ),
            (
                "resina_composita_indirecta_adulto",
                "Resina de composita indirecta (adulto)",
            ),
            ("resina_una_superficie_adulto", "Resina de una superficie (adulto)"),
            (
                "resina_dos_o_mas_superficies_adulto",
                "Resina dos o más superficies (adulto)",
            ),
            ("resina_fluida_adulto", "Resina fluida adulto"),
            ("resina_preventiva_adulto", "Resina preventiva (adulto)"),
            (
                "sellante_fosas_fisuras_adulto",
                "Sellante de fosas y fisuras (adulto)",
            ),
        ),
    ),
    (
        "periodoncia",
        "Periodoncia",
        (
            ("cirugia_periodontal", "Cirugía periodontal"),
            ("guarda_termocurada", "Guarda termocurada"),
            ("periodoncia_tipo_i", "Periodoncia tipo I"),
            ("periodoncia_tipo_ii", "Periodoncia tipo II"),
            ("periodoncia_tipo_iii", "Periodoncia tipo III"),
        ),
    ),
    (
        "protesis",
        "Prostodoncia",
        (
            ("carilla_de_ceromero", "Carilla de cerómero"),
            (
                "corona_ceromero_fibra_vidrio_posteriores",
                "Corona de cerómero con fibra de vidrio / posteriores",
            ),
            ("corona_silicato_de_litio", "Corona de silicato de litio"),
            (
                "corona_individual_zirconio_tradicional",
                "Corona individual de zirconio (proceso tradicional)",
            ),
            (
                "corona_individual_zirconio_cad_cam",
                "Corona individual de zirconio (CAD CAM)",
            ),
            (
                "corona_individual_hombro_porcelana",
                "Corona individual con hombro de porcelana",
            ),
            (
                "corona_individual_metal_porcelana",
                "Corona individual de metal-porcelana",
            ),
            (
                "corona_individual_porcelana_yeso_refractario",
                "Corona individual porcelana con yeso refractario",
            ),
            ("corona_metalica", "Corona metálica"),
            ("incrustacion_ceromero", "Incrustación de cerómero"),
            (
                "incrustacion_zirconio_tradicional",
                "Incrustación de zirconio (proceso tradicional)",
            ),
            (
                "incrustacion_zirconio_cad_cam",
                "Incrustación de zirconio (CAD CAM)",
            ),
            ("incrustacion_metalica", "Incrustación metálica"),
            (
                "protesis_fija_3_unidades_metal_porcelana",
                "Prótesis fija de 3 unidades de metal-porcelana",
            ),
            (
                "protesis_completa_acrilico_una_arcada",
                "Prótesis completa de acrílico sup o inferior (una arcada)",
            ),
            (
                "protesis_completa_acrilico_dos_arcadas",
                "Prótesis completa de acrílico (las dos arcadas)",
            ),
            ("protesis_removible_wipla", "Prótesis removible Wipla"),
            (
                "protesis_removible_inf_dento_mucosoportada",
                "Prótesis removible inf dento mucosoportada",
            ),
            (
                "protesis_removible_sup_dento_mucosoportada",
                "Prótesis removible sup dento mucosoportada",
            ),
            (
                "protesis_removible_sup_o_inf_dento_soportada",
                "Prótesis removible sup o inf dento soportada",
            ),
            ("protesis_valplast_bilateral", "Prótesis Valplast bilateral"),
            ("protesis_valplast_unilateral", "Prótesis Valplast unilateral"),
        ),
    ),
    ("ortodoncia", "Ortodoncia", ()),
)
