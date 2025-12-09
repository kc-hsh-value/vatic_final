import React from "react";
import AlphaFeed from "./components/alpha-feed";
import GlobalFeedPage from "./components/alpha-feed-global";


export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ... other dashboard stuff ... */}
      {/* <AlphaFeed /> */}
        <GlobalFeedPage/>
    </div>
  );
}