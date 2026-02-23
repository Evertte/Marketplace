import { Suspense } from "react";

import BrowseClientPage from "./BrowseClientPage";

export default function BrowsePage() {
  return (
    <Suspense fallback={null}>
      <BrowseClientPage />
    </Suspense>
  );
}

