export type UserRole = "admin" | "user";
export type UserStatus = "active" | "banned";
export type ListingType = "car" | "building" | "land";
export type ListingStatus = "draft" | "published" | "archived";
export type MediaKind = "image" | "video";
export type MediaStatus = "uploading" | "ready" | "failed";

export type ApiErrorEnvelope = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    request_id: string;
  };
};

export type MeResponse = {
  data: {
    id: string;
    email: string;
    role: UserRole;
    status: UserStatus;
  };
};

export type AdminListingListItem = {
  id: string;
  type: ListingType;
  title: string;
  price: string;
  currency: string;
  locationCountry: string;
  locationRegion: string;
  locationCity: string;
  status: ListingStatus;
  publishedAt: string | null;
  createdAt: string;
  coverImageUrl: string | null;
};

export type AdminListingsListResponse = {
  data: AdminListingListItem[];
  page: {
    limit: number;
    next_cursor: string | null;
    has_more: boolean;
  };
};

export type ListingWriteSummary = {
  id: string;
  status: ListingStatus;
  title: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type AdminListingDetail = {
  id: string;
  type: ListingType;
  status: ListingStatus;
  title: string;
  description: string;
  price: string;
  currency: string;
  locationCountry: string;
  locationRegion: string;
  locationCity: string;
  lat: string | null;
  lng: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  typeFields: unknown;
  media: Array<{
    mediaId: string;
    url: string;
    thumbUrl: string | null;
    kind: MediaKind;
    sortOrder: number;
    status: MediaStatus;
  }>;
};

export type AdminListingDetailResponse = {
  data: AdminListingDetail;
};

export type CreateListingResponse = {
  data: { id: string; status: ListingStatus };
};

export type ListingMutationResponse = {
  data: ListingWriteSummary;
};

export type ListingAttachMediaResponse = {
  data: { listing_id: string; media_id: string };
};

export type MediaPresignResponse = {
  data: {
    media_id: string;
    path: string;
    upload: {
      signedUrl?: string;
      token?: string;
      path?: string;
      [key: string]: unknown;
    };
    public_url: string;
  };
};

export type MediaConfirmResponse = {
  data: {
    media_id: string;
    status: "ready";
  };
};

export type PublicListingCard = {
  id: string;
  type: ListingType;
  title: string;
  price: string;
  currency: string;
  locationCountry: string;
  locationRegion: string;
  locationCity: string;
  publishedAt: string | null;
  createdAt: string;
  coverImageUrl: string | null;
};

export type PublicListingsResponse = {
  data: PublicListingCard[];
  page: {
    limit: number;
    next_cursor: string | null;
    has_more: boolean;
  };
};
