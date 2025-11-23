import { getCurrentUser } from "@/services/auth";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ navigate }) => {
    const user = await getCurrentUser();
    if (!user) {
      navigate({ to: "/Login" });
    } else {
      navigate({ to: "/conversation" });
    }
  },
  component: HomeComponent,
});

function HomeComponent() {
  return <div>Home</div>;
}
