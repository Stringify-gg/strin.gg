import { defineHandler } from "nitro";
import { fallbackRedirect } from "../utils/links.ts";

// Everything no other route handles goes to stringify.gg. This also keeps Nitro's
// index.html renderer (the admin app) from answering unmatched paths.
export default defineHandler(() => fallbackRedirect());
