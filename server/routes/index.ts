import { defineHandler } from "nitro";
import { fallbackRedirect } from "../utils/links.ts";

export default defineHandler(() => fallbackRedirect());
