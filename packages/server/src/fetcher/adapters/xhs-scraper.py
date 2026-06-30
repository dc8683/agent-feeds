"""Scrape 小红书 user profile page for note items using CDP bridge (single persistent connection)."""
import subprocess, json, time, sys, os

CDP_DIR = os.path.expanduser("~/Desktop/tools/cdp-bridge-mcp")

# CDP bridge stderr goes here so it doesn't pollute stdout
DEVNULL = subprocess.DEVNULL


def send(proc, req, timeout=30):
    """Send a JSON-RPC request and read the response line."""
    proc.stdin.write(json.dumps(req) + "\n")
    proc.stdin.flush()
    deadline = time.time() + timeout
    while time.time() < deadline:
        line = proc.stdout.readline()
        if not line:
            time.sleep(0.5)
            continue
        try:
            msg = json.loads(line)
            if msg.get("id") == req.get("id"):
                return msg
        except json.JSONDecodeError:
            pass
    return {}


def call_tool(proc, name, args, req_id):
    """Call an MCP tool, parse response."""
    resp = send(proc, {
        "jsonrpc": "2.0", "id": req_id, "method": "tools/call",
        "params": {"name": name, "arguments": args},
    })
    content = resp.get("result", {}).get("content", [])
    if content and "text" in content[0]:
        try:
            return json.loads(content[0]["text"])
        except (json.JSONDecodeError, TypeError):
            return content[0]["text"]
    return resp


def scrape_profile(url: str) -> list:
    """Navigate to profile, scroll, extract notes — all in one CDP session."""
    proc = subprocess.Popen(
        ["uv", "run", "cdp-bridge"],
        cwd=CDP_DIR,
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True,
    )

    rid = 0

    # Initialize
    send(proc, {
        "jsonrpc": "2.0", "id": rid, "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "xhs-scraper", "version": "1.0"},
        },
    })
    rid += 1

    # Wait for browser extension to connect
    connected = False
    deadline = time.time() + 20
    while time.time() < deadline:
        resp = send(proc, {"jsonrpc": "2.0", "id": rid, "method": "tools/call",
                           "params": {"name": "browser_get_tabs", "arguments": {}}})
        try:
            content = resp.get("result", {}).get("content", [])
            if content:
                tabs = json.loads(content[0]["text"])
                if tabs.get("tabs") and len(tabs["tabs"]) > 0:
                    connected = True
                    break
        except (json.JSONDecodeError, KeyError, TypeError):
            pass
        rid += 1
        time.sleep(2)

    if not connected:
        proc.terminate()
        print("[xhs-scraper] Browser not connected", file=sys.stderr)
        return []

    rid += 1

    # Find 小红书 tab
    tabs_resp = send(proc, {"jsonrpc": "2.0", "id": rid, "method": "tools/call",
                             "params": {"name": "browser_get_tabs", "arguments": {}}})
    xhs_tab = None
    try:
        tabs_data = json.loads(tabs_resp["result"]["content"][0]["text"])
        for t in tabs_data.get("tabs", []):
            if "xiaohongshu" in t.get("url", ""):
                xhs_tab = t["id"]
                break
    except (json.JSONDecodeError, KeyError, TypeError, IndexError):
        pass
    rid += 1

    if not xhs_tab:
        proc.terminate()
        print("[xhs-scraper] 小红书 tab not found", file=sys.stderr)
        return []

    # Navigate to profile URL using browser_navigate
    call_tool(proc, "browser_navigate", {"url": url, "tab_id": xhs_tab}, rid)
    rid += 1
    time.sleep(5)  # Wait for page load

    # Extract profile info from page title
    profile = {"nickname": "", "avatar": ""}
    title_result = call_tool(proc, "browser_execute_js", {
        "script": "document.title",
        "tab_id": xhs_tab,
    }, rid)
    rid += 1
    # call_tool may return dict with js_return or raw string
    title = None
    if isinstance(title_result, dict):
        title = title_result.get("js_return")
    elif isinstance(title_result, str):
        title = title_result
    if title and isinstance(title, str) and " - 小红书" in title:
        profile["nickname"] = title.split(" - 小红书")[0].strip()

    # Scroll to load more notes
    for _ in range(3):
        call_tool(proc, "browser_execute_js", {
            "script": "window.scrollTo(0, document.body.scrollHeight); 'scrolled';",
            "tab_id": xhs_tab,
        }, rid)
        rid += 1
        time.sleep(1.5)

    time.sleep(2)

    # Extract notes from DOM
    extract_code = """
    (function() {
        var sections = document.querySelectorAll("section.note-item");
        var notes = [];
        for (var i = 0; i < sections.length; i++) {
            var s = sections[i];
            var img = s.querySelector("img");
            var footer = s.querySelector("[class*=footer]");
            var profileLink = s.querySelector("a[href*='/user/profile/']");
            var pin = s.querySelector("[class*=top-wrapper]");

            var noteUrl = "";
            var noteId = "";
            var allLinks = s.querySelectorAll("a");
            for (var j = 0; j < allLinks.length; j++) {
                var href = allLinks[j].href;
                if (href.indexOf("/explore/") >= 0 && !noteUrl) {
                    noteUrl = href;
                    var m = href.match(/explore\\/([a-f0-9]+)/);
                    if (m) noteId = m[1];
                }
            }

            if (noteId) {
                notes.push({
                    noteId: noteId,
                    coverUrl: img ? img.src : "",
                    footerText: footer ? footer.textContent.trim() : "",
                    noteUrl: noteUrl,
                    detailUrl: profileLink ? profileLink.href : noteUrl,
                    isPinned: !!pin
                });
            }
        }
        return JSON.stringify(notes);
    })()
    """
    result = call_tool(proc, "browser_execute_js", {"script": extract_code, "tab_id": xhs_tab}, rid)

    proc.terminate()

    notes = []
    if isinstance(result, list):
        notes = result
    elif isinstance(result, dict):
        if result.get("notes") and isinstance(result["notes"], list):
            notes = result["notes"]
        else:
            js_return = result.get("js_return")
            if js_return:
                try:
                    parsed = json.loads(js_return)
                    notes = parsed if isinstance(parsed, list) else []
                except (json.JSONDecodeError, TypeError):
                    pass

    if not isinstance(notes, list):
        print(f"[xhs-scraper] Unexpected result type: {type(result)}", file=sys.stderr)
        print(f"[xhs-scraper] Result preview: {str(result)[:300]}", file=sys.stderr)
        notes = []

    return {"profile": profile, "notes": notes}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: xhs-scraper.py <profile_url>"}))
        sys.exit(1)

    url = sys.argv[1]
    notes = scrape_profile(url)
    print(json.dumps(notes, ensure_ascii=False))
