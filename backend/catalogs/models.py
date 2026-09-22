from django.db import models
from django.utils.text import slugify


def unique_slug(model, name: str, exclude_pk: int | None = None) -> str:
    base = slugify(name, allow_unicode=False) or "item"
    slug = base
    suffix = 2
    queryset = model.objects.all()
    if exclude_pk is not None:
        queryset = queryset.exclude(pk=exclude_pk)
    while queryset.filter(slug=slug).exists():
        slug = f"{base}-{suffix}"
        suffix += 1
    return slug


class ClinicalArea(models.Model):
    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(ClinicalArea, self.name, exclude_pk=self.pk)
        super().save(*args, **kwargs)


class ClinicalTreatment(models.Model):
    area = models.ForeignKey(
        ClinicalArea,
        on_delete=models.CASCADE,
        related_name="treatments",
    )
    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(
                ClinicalTreatment,
                self.name,
                exclude_pk=self.pk,
            )
        super().save(*args, **kwargs)
