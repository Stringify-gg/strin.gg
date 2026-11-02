export const ADMIN_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>strin.gg links</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { max-width: 72rem; margin: 2rem auto; padding: 0 1rem; }
  form { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1rem; }
  input { padding: .45rem .6rem; font: inherit; }
  input[name=url] { flex: 1 1 24rem; }
  button { padding: .45rem .8rem; font: inherit; cursor: pointer; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: .4rem; border-bottom: 1px solid #8884; vertical-align: top; }
  td.dest { word-break: break-all; }
  td.actions { white-space: nowrap; }
  #status { min-height: 1.4em; }
  .error { color: #d33; }
  .muted { opacity: .7; font-size: .9em; }
</style>
</head>
<body>
<h1>strin.gg links</h1>
<form id="create">
  <input name="url" type="url" placeholder="https://destination" required>
  <input name="slug" placeholder="custom slug (optional)" pattern="[A-Za-z0-9_\\-]{1,64}">
  <button type="submit">Create</button>
</form>
<p id="status" role="status"></p>
<table>
  <thead><tr><th>Short link</th><th>Destination</th><th>Owner</th><th>Updated</th><th></th></tr></thead>
  <tbody id="links"></tbody>
</table>
<p><button id="more" hidden>Load more</button></p>
<script>
const status = document.getElementById("status");
const tbody = document.getElementById("links");
const more = document.getElementById("more");
let cursor = null;

function say(text, isError) {
  status.textContent = text;
  status.className = isError ? "error" : "";
}

async function api(path, init) {
  const res = await fetch("/admin/api/links" + path, init);
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body;
}

function shortUrl(slug) {
  return location.origin + "/" + slug.split("/").map(encodeURIComponent).join("/");
}

function cell(row, text, className) {
  const td = row.insertCell();
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function button(td, label, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.addEventListener("click", onClick);
  td.append(b, " ");
}

function render(link, prepend) {
  const row = prepend ? tbody.insertRow(0) : tbody.insertRow();
  const short = link.slug.includes("/") ? location.origin + "/cs/" + link.slug : shortUrl(link.slug);
  const a = document.createElement("a");
  a.href = short;
  a.textContent = short.replace(/^https?:\\/\\//, "");
  row.insertCell().append(a);
  cell(row, link.url, "dest");
  cell(row, link.owner || "", "muted");
  cell(row, (link.updatedAt || link.createdAt || "").slice(0, 10), "muted");
  const actions = cell(row, "", "actions");
  const path = "/" + link.slug.split("/").map(encodeURIComponent).join("/");
  button(actions, "Copy", () => navigator.clipboard.writeText(short).then(() => say("Copied " + short)));
  button(actions, "Edit", async () => {
    const url = prompt("New destination for " + link.slug, link.url);
    if (!url) return;
    try {
      const updated = await api(path, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      row.replaceWith(render(updated, false));
      say("Updated " + link.slug);
    } catch (e) { say(e.message, true); }
  });
  button(actions, "Delete", async () => {
    if (!confirm("Delete " + link.slug + "?")) return;
    try {
      await api(path, { method: "DELETE" });
      row.remove();
      say("Deleted " + link.slug);
    } catch (e) { say(e.message, true); }
  });
  return row;
}

async function load() {
  try {
    const page = await api(cursor ? "?cursor=" + encodeURIComponent(cursor) : "");
    page.links.forEach((link) => render(link, false));
    cursor = page.cursor;
    more.hidden = !cursor;
  } catch (e) { say(e.message, true); }
}

document.getElementById("create").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const data = { url: form.url.value, slug: form.slug.value || undefined };
  try {
    const link = await api("", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    render(link, true);
    form.reset();
    say("Created " + shortUrl(link.slug));
  } catch (e) { say(e.message, true); }
});
more.addEventListener("click", load);
load();
</script>
</body>
</html>
`;
