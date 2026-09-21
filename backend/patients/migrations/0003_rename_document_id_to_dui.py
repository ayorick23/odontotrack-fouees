from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("patients", "0002_add_clinical_area"),
    ]

    operations = [
        migrations.RenameField(
            model_name="patient",
            old_name="document_id",
            new_name="dui",
        ),
        migrations.AlterField(
            model_name="patient",
            name="dui",
            field=models.CharField(
                max_length=30,
                unique=True,
                help_text="Documento Único de Identidad del paciente.",
            ),
        ),
    ]
