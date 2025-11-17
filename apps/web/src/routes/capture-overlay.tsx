import { createFileRoute } from "@tanstack/react-router";
import { ScreenCaptureOverlay } from "@/components/ScreenCaptureOverlay";

export const Route = createFileRoute("/capture-overlay")({
  component: CaptureOverlayComponent,
});

function CaptureOverlayComponent() {
  return <ScreenCaptureOverlay />;
}
