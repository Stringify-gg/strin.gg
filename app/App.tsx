import { Component } from "nano-jsx/esm/index.js";
import type { LinkWithSlug } from "../server/utils/links.ts";

// Shared by entry-server (renders the empty shell) and entry-client (loads and manages links).

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch("/api/admin" + path, init);
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

const linkPath = (slug: string) => "/links/" + encodeURIComponent(slug);
const shortUrl = (slug: string) => location.origin + "/" + encodeURIComponent(slug);
const withoutScheme = (url: string) => url.replace(/^https?:\/\//, "");
const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

class LinksAdmin extends Component {
  links: LinkWithSlug[] = [];
  email: string | null = null;
  loading = true;
  editing: string | null = null;
  status = "";
  isError = false;
  private statusTimer: ReturnType<typeof setTimeout> | undefined;

  override didMount() {
    void this.load();
  }

  say(text: string, isError = false) {
    this.status = text;
    this.isError = isError;
    clearTimeout(this.statusTimer);
    if (text && !isError) this.statusTimer = setTimeout(() => this.say(""), 4000);
    this.update();
  }

  async load() {
    try {
      const [me, links] = await Promise.all([api<{ email: string }>("/me"), api<LinkWithSlug[]>("/links")]);
      this.email = me.email;
      this.links = links;
      this.loading = false;
      this.update();
    } catch (e) {
      this.loading = false;
      this.say(errorMessage(e), true);
    }
  }

  async create(event: SubmitEvent) {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const slug = String(data.get("slug") ?? "").trim();
    try {
      const link = await api<LinkWithSlug>("/links", sendJson("POST", { url: data.get("url"), slug: slug || undefined }));
      this.links = [link, ...this.links];
      this.say("Created " + withoutScheme(shortUrl(link.slug)));
    } catch (e) {
      this.say(errorMessage(e), true);
    }
  }

  startEdit(link: LinkWithSlug) {
    this.editing = link.slug;
    this.update();
    document.querySelector<HTMLInputElement>(".edit-form input")?.focus();
  }

  cancelEdit() {
    this.editing = null;
    this.update();
  }

  async saveEdit(event: SubmitEvent, link: LinkWithSlug) {
    event.preventDefault();
    const url = new FormData(event.target as HTMLFormElement).get("url");
    try {
      const updated = await api<LinkWithSlug>(linkPath(link.slug), sendJson("PUT", { url }));
      this.links = this.links.map((l) => (l.slug === link.slug ? updated : l));
      this.editing = null;
      this.say("Updated " + link.slug);
    } catch (e) {
      this.say(errorMessage(e), true);
    }
  }

  async remove(link: LinkWithSlug) {
    if (!confirm(`Delete ${link.slug}? Visitors will be sent to stringify.gg instead.`)) return;
    try {
      await api(linkPath(link.slug), { method: "DELETE" });
      this.links = this.links.filter((l) => l.slug !== link.slug);
      this.say("Deleted " + link.slug);
    } catch (e) {
      this.say(errorMessage(e), true);
    }
  }

  async copy(link: LinkWithSlug) {
    try {
      await navigator.clipboard.writeText(shortUrl(link.slug));
      this.say("Copied " + withoutScheme(shortUrl(link.slug)));
    } catch {
      this.say("Couldn't copy to the clipboard", true);
    }
  }

  // Filters by hiding rows directly: update() would rebuild the search box and drop its focus.
  filter(event: Event) {
    const query = (event.target as HTMLInputElement).value.trim().toLowerCase();
    document.querySelectorAll<HTMLElement>(".link").forEach((row) => {
      row.hidden = query !== "" && !(row.dataset.search ?? "").includes(query);
    });
  }

  renderLink(link: LinkWithSlug) {
    const short = shortUrl(link.slug);
    const search = `${link.slug} ${link.url} ${link.owner}`.toLowerCase();
    const changed = link.updatedAt
      ? `Updated ${formatDate(link.updatedAt)} by ${link.updatedBy}`
      : `Created ${formatDate(link.createdAt)}`;

    return (
      <li class="link" data-search={search}>
        <div class="link-main">
          <a class="short" href={short} target="_blank" rel="noopener">
            {withoutScheme(short)}
          </a>
          {this.editing === link.slug ? (
            <form class="edit-form" onSubmit={(e: SubmitEvent) => this.saveEdit(e, link)}>
              <input name="url" type="url" value={link.url} required aria-label={`New destination for ${link.slug}`} />
              <button type="submit" class="button primary">Save</button>
              <button type="button" class="button" onClick={() => this.cancelEdit()}>Cancel</button>
            </form>
          ) : (
            <a class="dest" href={link.url} target="_blank" rel="noopener noreferrer">
              → {link.url}
            </a>
          )}
        </div>
        <div class="link-meta">
          <span>{link.owner}</span>
          <span>{changed}</span>
        </div>
        <div class="link-actions">
          <button type="button" class="button" onClick={() => this.copy(link)}>Copy</button>
          <button type="button" class="button" onClick={() => this.startEdit(link)}>Edit</button>
          <button type="button" class="button danger" onClick={() => this.remove(link)}>Delete</button>
        </div>
      </li>
    );
  }

  renderList() {
    if (this.loading) return <p class="empty">Loading links…</p>;
    if (this.links.length === 0) return <p class="empty">No links yet. Create the first one above.</p>;
    return <ul class="links">{this.links.map((link) => this.renderLink(link))}</ul>;
  }

  override render() {
    return (
      <div class="page">
        <header class="topbar">
          <div class="brand">
            <span class="logo">s</span>
            <span>
              strin.gg <span class="brand-sub">links</span>
            </span>
          </div>
          {this.email ? (
            <div class="identity" title="Identified by Cloudflare Access">
              <span class="avatar">{this.email[0]!.toUpperCase()}</span>
              <span class="identity-text">
                <span class="identity-label">Signed in as</span>
                <span class="identity-email">{this.email}</span>
              </span>
            </div>
          ) : null}
        </header>

        <main>
          <section class="card">
            <h1>New short link</h1>
            <form class="create-form" onSubmit={(e: SubmitEvent) => this.create(e)}>
              <label class="field grow">
                <span>Destination</span>
                <input name="url" type="url" placeholder="https://stringify.gg/…" required />
              </label>
              <label class="field">
                <span>Slug (optional)</span>
                <span class="slug-input">
                  <span class="prefix">strin.gg/</span>
                  <input name="slug" placeholder="random" pattern="[A-Za-z0-9_\-]{1,64}" />
                </span>
              </label>
              <button type="submit" class="button primary">Create link</button>
            </form>
          </section>

          <p class={this.isError ? "status error" : "status"} role="status">
            {this.status}
          </p>

          <section class="card">
            <div class="list-header">
              <h2>
                Links {this.loading ? null : <span class="count">{this.links.length}</span>}
              </h2>
              <input class="search" type="search" placeholder="Filter links" aria-label="Filter links" onInput={(e: Event) => this.filter(e)} />
            </div>
            {this.renderList()}
          </section>
        </main>
      </div>
    );
  }
}

export const App = () => <LinksAdmin />;
