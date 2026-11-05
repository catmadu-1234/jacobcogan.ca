import { Images } from "lucide-react";
import { Shell } from "./components/Shell";
import { Toast } from "./components/Toast";
import { EmptyState } from "./components/EmptyState";
import { Button } from "./components/Button";
import { createWorkAndOpen } from "./lib/addWork";
import { loadMe, useMe } from "./lib/me";
import { useRoute } from "./lib/router";
import { Editor } from "./screens/Editor";
import { SidePicker } from "./screens/SidePicker";
import { Settings } from "./screens/Settings";
import { Studio } from "./screens/Studio";
import { Works } from "./screens/Works";

export function App() {
  const route = useRoute();
  const me = useMe();

  if (me.status === "loading") return <p aria-busy="true" style={{ padding: "2rem" }}>Loading…</p>;
  // No login yet: a 401 here is the "choose-side" question (any other 401 reloads the page for Access before this).
  if (me.status === "error" && me.code === 401) return <SidePicker />;
  if (me.status === "error") {
    return (
      <EmptyState
        icon={<Images size={28} />}
        text={
          me.code === 403
            ? "This account isn't connected to a site yet."
            : "We couldn't load your site. Check your connection and try again."
        }
        actionLabel={me.code === 403 ? undefined : "Try again"}
        onAction={me.code === 403 ? undefined : () => void loadMe()}
      />
    );
  }

  return (
    <>
      <Shell siteName={me.site.name} openSides={me.email === "open-sides"} route={route} onAdd={() => void createWorkAndOpen()}>
        {route.name === "works" ? (
          <Works onAdd={() => void createWorkAndOpen()} />
        ) : route.name === "editor" ? (
          <Editor key={route.params.id} id={Number(route.params.id)} />
        ) : route.name === "studio" ? (
          <Studio />
        ) : (
          <Settings />
        )}
      </Shell>
      <Toast />
    </>
  );
}
