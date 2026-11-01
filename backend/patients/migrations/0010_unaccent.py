from django.contrib.postgres.operations import UnaccentExtension
from django.db import migrations


class Migration(migrations.Migration):
    """Extensión unaccent de Postgres para buscar nombres sin acentos."""

    dependencies = [
        ("patients", "0009_created_by"),
    ]

    operations = [
        UnaccentExtension(),
    ]
