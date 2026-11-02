import { defineHandler } from "nitro";
import { requireAdmin } from "../../utils/access.ts";

/** Who the admin is signed in as (the Access email, or DEV_ADMIN_EMAIL on localhost). */
export default defineHandler(async (event) => ({ email: await requireAdmin(event) }));
