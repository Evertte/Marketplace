"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import type React from "react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";

const decimalStringSchema = z
  .string()
  .trim()
  .min(1, "Required")
  .refine((value) => /^-?\d+(\.\d+)?$/.test(value), "Must be a valid number");

const optionalDecimalStringSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || /^-?\d+(\.\d+)?$/.test(value), "Must be a valid number");

function isValidJsonText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed === "") return true;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

const listingFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().min(1, "Description is required"),
  price: decimalStringSchema,
  currency: z.string().trim().min(1, "Currency is required"),
  locationCountry: z.string().trim().min(1, "Country is required"),
  locationRegion: z.string().trim().min(1, "Region is required"),
  locationCity: z.string().trim().min(1, "City is required"),
  lat: optionalDecimalStringSchema,
  lng: optionalDecimalStringSchema,
  typeFieldsText: z
    .string()
    .transform((value) => value)
    .refine(isValidJsonText, "typeFields must be valid JSON"),
});

export type ListingFormValues = z.infer<typeof listingFormSchema>;

export type ListingWritePayload = {
  title: string;
  description: string;
  price: string;
  currency: string;
  locationCountry: string;
  locationRegion: string;
  locationCity: string;
  lat: string | null;
  lng: string | null;
  typeFields: unknown | null;
};

export function defaultListingFormValues(): ListingFormValues {
  return {
    title: "",
    description: "",
    price: "",
    currency: "USD",
    locationCountry: "",
    locationRegion: "",
    locationCity: "",
    lat: "",
    lng: "",
    typeFieldsText: "{}",
  };
}

export function listingDetailToFormValues(detail: {
  title: string;
  description: string;
  price: string;
  currency: string;
  locationCountry: string;
  locationRegion: string;
  locationCity: string;
  lat: string | null;
  lng: string | null;
  typeFields: unknown;
}): ListingFormValues {
  return {
    title: detail.title,
    description: detail.description,
    price: detail.price,
    currency: detail.currency,
    locationCountry: detail.locationCountry,
    locationRegion: detail.locationRegion,
    locationCity: detail.locationCity,
    lat: detail.lat ?? "",
    lng: detail.lng ?? "",
    typeFieldsText:
      detail.typeFields === null || detail.typeFields === undefined
        ? ""
        : JSON.stringify(detail.typeFields, null, 2),
  };
}

function formValuesToPayload(values: ListingFormValues): ListingWritePayload {
  const typeFieldsText = values.typeFieldsText.trim();
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    price: values.price.trim(),
    currency: values.currency.trim(),
    locationCountry: values.locationCountry.trim(),
    locationRegion: values.locationRegion.trim(),
    locationCity: values.locationCity.trim(),
    lat: values.lat.trim() === "" ? null : values.lat.trim(),
    lng: values.lng.trim() === "" ? null : values.lng.trim(),
    typeFields: typeFieldsText === "" ? null : (JSON.parse(typeFieldsText) as unknown),
  };
}

type ListingEditorFormProps = {
  title: string;
  description?: string;
  defaultValues: ListingFormValues;
  submitLabel: string;
  submitting?: boolean;
  disabled?: boolean;
  onSubmit: (payload: ListingWritePayload, values: ListingFormValues) => Promise<void>;
};

export function ListingEditorForm({
  title,
  description,
  defaultValues,
  submitLabel,
  submitting = false,
  disabled = false,
  onSubmit,
}: ListingEditorFormProps) {
  const form = useForm<ListingFormValues>({
    resolver: zodResolver(listingFormSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const fieldsDisabled = disabled || submitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={form.handleSubmit(async (values) => {
            await onSubmit(formValuesToPayload(values), values);
          })}
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Title"
              error={form.formState.errors.title?.message}
              input={
                <Input
                  {...form.register("title")}
                  placeholder="Toyota Corolla 2018"
                  disabled={fieldsDisabled}
                />
              }
            />
            <Field
              label="Currency"
              error={form.formState.errors.currency?.message}
              input={
                <Input
                  {...form.register("currency")}
                  placeholder="USD"
                  disabled={fieldsDisabled}
                />
              }
            />
          </div>

          <Field
            label="Description"
            error={form.formState.errors.description?.message}
            input={
              <Textarea
                {...form.register("description")}
                rows={5}
                placeholder="Describe the listing..."
                disabled={fieldsDisabled}
              />
            }
          />

          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Price"
              error={form.formState.errors.price?.message}
              input={
                <Input
                  {...form.register("price")}
                  placeholder="15000"
                  inputMode="decimal"
                  disabled={fieldsDisabled}
                />
              }
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Latitude"
                error={form.formState.errors.lat?.message}
                input={
                  <Input
                    {...form.register("lat")}
                    placeholder="5.6037"
                    inputMode="decimal"
                    disabled={fieldsDisabled}
                  />
                }
              />
              <Field
                label="Longitude"
                error={form.formState.errors.lng?.message}
                input={
                  <Input
                    {...form.register("lng")}
                    placeholder="-0.1870"
                    inputMode="decimal"
                    disabled={fieldsDisabled}
                  />
                }
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <Field
              label="Country"
              error={form.formState.errors.locationCountry?.message}
              input={
                <Input
                  {...form.register("locationCountry")}
                  placeholder="Ghana"
                  disabled={fieldsDisabled}
                />
              }
            />
            <Field
              label="Region"
              error={form.formState.errors.locationRegion?.message}
              input={
                <Input
                  {...form.register("locationRegion")}
                  placeholder="Greater Accra"
                  disabled={fieldsDisabled}
                />
              }
            />
            <Field
              label="City"
              error={form.formState.errors.locationCity?.message}
              input={
                <Input
                  {...form.register("locationCity")}
                  placeholder="Accra"
                  disabled={fieldsDisabled}
                />
              }
            />
          </div>

          <Field
            label="typeFields (JSON)"
            error={form.formState.errors.typeFieldsText?.message}
            input={
              <Textarea
                {...form.register("typeFieldsText")}
                rows={10}
                className="font-mono text-xs"
                placeholder='{"mileage": 42000, "year": 2018}'
                disabled={fieldsDisabled}
              />
            }
          />

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="submit" disabled={fieldsDisabled}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  error,
  input,
}: {
  label: string;
  error?: string;
  input: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {input}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
