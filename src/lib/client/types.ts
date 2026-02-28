export type ListingType = "car" | "building" | "land";
export type ListingCard = {
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

export type HomeResponse = {
  data: {
    cars: { items: ListingCard[]; next_cursor: null };
    buildings: { items: ListingCard[]; next_cursor: null };
    lands: { items: ListingCard[]; next_cursor: null };
  };
};

export type ListingsResponse = {
  data: ListingCard[];
  page: {
    limit: number;
    next_cursor: string | null;
    has_more: boolean;
  };
};

export type PublicListingDetailResponse = {
  data: {
    id: string;
    type: ListingType;
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
      kind: "image" | "video";
      sortOrder: number;
    }>;
  };
};

export type CreateInquiryResponse = {
  data: {
    inquiry_id: string;
    conversation_id: string;
    listing_id: string;
    created: boolean;
  };
};

export type ConversationReadState = {
  conversationId: string;
  userId: string;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConversationsResponse = {
  data: Array<{
    conversation: {
      id: string;
      listingId: string;
      buyerUserId: string;
      sellerUserId: string;
      lastMessageAt: string | null;
      createdAt: string;
      updatedAt: string;
    };
    hasUnread: boolean;
    unreadCount: number;
    lastMessagePreview: string | null;
    lastMessageSenderId: string | null;
    isPinned: boolean;
    pinnedAt: string | null;
    otherUser: {
      id: string;
      name: string;
      avatarUrl: string | null;
    };
    listing: {
      id: string;
      type: ListingType;
      title: string;
      price: string;
      currency: string;
      locationCountry: string;
      locationRegion: string;
      locationCity: string;
      coverImageUrl: string | null;
    };
  }>;
  page: {
    limit: number;
    next_cursor: string | null;
    has_more: boolean;
  };
};

export type ConversationMessagesResponse = {
  data: Array<{
    id: string;
    conversationId: string;
    senderUserId: string;
    kind: "text" | "media";
    text: string | null;
    media: null | {
      id: string;
      url: string;
      thumbUrl: string | null;
      kind: "image" | "video";
    };
    createdAt: string;
  }>;
  page: {
    limit: number;
    next_cursor: string | null;
    has_more: boolean;
  };
  readState: {
    me: ConversationReadState | null;
    other: ConversationReadState | null;
  };
};

export type SendMessageResponse = {
  data: {
    message_id: string;
    createdAt: string;
  };
};

export type MarkConversationReadResponse = {
  data: ConversationReadState;
};

export type ReportReason = "spam" | "scam" | "harassment" | "inappropriate" | "other";
export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";
export type NotificationType = "NEW_MESSAGE" | "NEW_INQUIRY" | "LISTING_PUBLISHED" | "SYSTEM";

export type CreateReportResponse = {
  data: {
    id: string;
    status: ReportStatus;
  };
};

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  href: string | null;
  data: unknown;
  readAt: string | null;
  createdAt: string;
};

export type NotificationsResponse = {
  data: NotificationItem[];
  page: {
    limit: number;
    next_cursor: string | null;
    has_more: boolean;
  };
  unreadCount: number;
};

export type ReadNotificationResponse = {
  data: {
    id: string;
    readAt: string;
  };
};

export type ReadAllNotificationsResponse = {
  data: {
    readAt: string;
  };
};
