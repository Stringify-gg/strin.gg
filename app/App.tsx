import { Component } from "nano-jsx/esm/index.js";
import type { LinkWithSlug } from "../server/utils/links.ts";

// Shared by entry-server (renders the empty shell) and entry-client (loads and manages links).

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch("/api/admin/links" + path, init);
  if (res.status === 204) return null as T;
  const body = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) throw new Error(body.message || res.statusText);
  return body as T;
}

const sendJson = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(data),
});

const linkPath = (slug: string) => "/" + encodeURIComponent(slug);
const shortUrl = (slug: string) => location.origin + linkPath(slug);
const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

class LinksAdmin extends Component {
  links: LinkWithSlug[] = [];
  status = "Loading…";
  isError = false;

  override didMount() {
    void this.load();
  }

  say(text: string, isError = false) {
    this.status = text;
    this.isError = isError;
    this.update();
  }

  async load() {
    try {
      this.links = await api<LinkWithSlug[]>("");
      this.say(this.links.length ? "" : "No links yet.");
    } catch (e) {
      this.say(errorMessage(e), true);
    }
  }

  async create(event: SubmitEvent) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    const slug = String(data.get("slug") ?? "").trim();
    try {
      const link = await api<LinkWithSlug>("", sendJson("POST", { url: data.get("url"), slug: slug || undefined }));
      this.links = [link, ...this.links];
      this.say("Created " + shortUrl(link.slug));
    } catch (e) {
      this.say(errorMessage(e), true);
    }
  }

  async edit(link: LinkWithSlug) {
    const url = prompt("New destination for " + link.slug, link.url);
    if (!url) return;
    try {
      const updated = await api<LinkWithSlug>(linkPath(link.slug), sendJson("PUT", { url }));
      this.links = this.links.map((l) => (l.slug === link.slug ? updated : l));
      this.say("Updated " + link.slug);
    } catch (e) {
      this.say(errorMessage(e), true);
    }
  }

  async remove(link: LinkWithSlug) {
    if (!confirm("Delete " + link.slug + "?")) return;
    try {
      await api(linkPath(link.slug), { method: "DELETE" });
      this.links = this.links.filter((l) => l.slug !== link.slug);
      this.say("Deleted " + link.slug);
    } catch (e) {
      this.say(errorMessage(e), true);
    }
  }

  async copy(link: LinkWithSlug) {
    await navigator.clipboard.writeText(shortUrl(link.slug));
    this.say("Copied " + shortUrl(link.slug));
  }

  override render() {
    return (
      <main>
        <h1>strin.gg links</h1>
        <form onSubmit={(e: SubmitEvent) => this.create(e)}>
          <input name="url" type="url" placeholder="https://destination" required />
          <input name="slug" placeholder="custom slug (optional)" pattern="[A-Za-z0-9_\-]{1,64}" />
          <button type="submit">Create</button>
        </form>
        <p class={this.isError ? "status error" : "status"} role="status">
          {this.status}
        </p>
        <table>
          <thead>
            <tr>
              <th>Short link</th>
              <th>Destination</th>
              <th>Owner</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {this.links.map((link) => (
              <tr>
                <td>
                  <a href={shortUrl(link.slug)}>{shortUrl(link.slug).replace(/^https?:\/\//, "")}</a>
                </td>
                <td class="dest">{link.url}</td>
                <td class="muted">{link.owner}</td>
                <td class="muted">{(link.updatedAt ?? link.createdAt).slice(0, 10)}</td>
                <td class="actions">
                  <button type="button" onClick={() => this.copy(link)}>Copy</button>{" "}
                  <button type="button" onClick={() => this.edit(link)}>Edit</button>{" "}
                  <button type="button" onClick={() => this.remove(link)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    );
  }
}

export const App = () => <LinksAdmin />;
