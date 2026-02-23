"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  ListingEditorForm,
  defaultListingFormValues,
  type ListingWritePayload,
} from "@/src/components/admin/listing-form";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { apiJson } from "@/src/lib/admin/apiClient";
import type { CreateListingResponse, ListingType } from "@/src/lib/admin/types";

type CreateType = ListingType | null;

const CREATE_OPTIONS: Array<{
  type: ListingType;
  title: string;
  description: string;
  endpoint: string;
}> = [
  {
    type: "car",
    title: "Create Car Listing",
    description: "Vehicles, cars, SUVs, and related inventory.",
    endpoint: "/api/v1/admin/cars",
  },
  {
    type: "building",
    title: "Create Building Listing",
    description: "Houses, apartments, offices, and other building listings.",
    endpoint: "/api/v1/admin/buildings",
  },
  {
    type: "land",
    title: "Create Land Listing",
    description: "Plots, farms, and undeveloped land listings.",
    endpoint: "/api/v1/admin/lands",
  },
];

export default function NewListingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [initialValues] = useState(() => defaultListingFormValues());

  const type = searchParams.get("type");
  const selectedType: CreateType =
    type === "car" || type === "building" || type === "land" ? type : null;

  const selectedOption = CREATE_OPTIONS.find((option) => option.type === selectedType) ?? null;

  async function handleCreate(payload: ListingWritePayload) {
    if (!selectedOption) {
      toast.error("Choose a listing type first");
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiJson<CreateListingResponse>(selectedOption.endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success(`Listing created (${response.data.status})`);
      router.push(`/admin/listings/${response.data.id}/edit`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create listing");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create a New Listing</CardTitle>
          <CardDescription>
            Start by choosing the listing type, then fill in the common fields and V1 `typeFields`
            JSON.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {CREATE_OPTIONS.map((option) => {
              const selected = option.type === selectedType;
              return (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => router.replace(`/admin/listings/new?type=${option.type}`)}
                  className={`rounded-xl border p-4 text-left transition ${
                    selected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "bg-card hover:bg-muted/20"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold">{option.title.replace("Create ", "")}</h3>
                    <Badge variant={selected ? "default" : "muted"}>{option.type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedOption ? (
        <ListingEditorForm
          title={selectedOption.title}
          description={selectedOption.description}
          defaultValues={initialValues}
          submitLabel="Create Draft Listing"
          submitting={submitting}
          onSubmit={async (payload) => {
            await handleCreate(payload);
          }}
        />
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Select a listing type above to open the create form.
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.push("/admin/listings")}>
          Back to Listings
        </Button>
      </div>
    </div>
  );
}
