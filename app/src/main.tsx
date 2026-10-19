import { createRoot } from "react-dom/client";
import "./styles.css";

// Two apps in one: guests scanning a QR code (/m/<slug>) only download the menu page; the
// dashboard (editor, drag and drop, uploads) is a separate download for owners and staff.
const root = createRoot(document.getElementById("root")!);
const guest = location.pathname.match(/^\/m\/([a-z0-9-]+)\/?$/);
if (guest) {
  void import("./guest/GuestApp").then(({ renderGuest }) =>
    renderGuest(root, guest[1]!),
  );
} else {
  void import("./AdminApp").then(({ renderAdmin }) => renderAdmin(root));
}
