#!/usr/bin/env python3
"""GIA HTTP Web Browser — reliable web fetching, parsing, form submission.
Uses requests + BeautifulSoup. Works in PRoot without browser binary.
Input: JSON {action, url, data, headers, selector, options}
Actions: get, post, extract, search, submit_form
"""
import sys, json, re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlencode, quote_plus

def main():
    if len(sys.argv) > 1:
        raw = sys.argv[1]
    else:
        raw = sys.stdin.read().strip()
    try:
        args = json.loads(raw)
    except:
        args = {"action": "get", "url": raw}

    action = args.get("action", "get")
    url = args.get("url", "")
    data = args.get("data", {})
    headers = args.get("headers", {"User-Agent": "Mozilla/5.0 GIA/1.0"})
    selector = args.get("selector", "")
    options = args.get("options", {})
    timeout = options.get("timeout", 20)

    try:
        if action == "get":
            r = requests.get(url, headers=headers, timeout=timeout)
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "lxml")
            result = {"url": r.url, "status": r.status_code, "title": soup.title.string if soup.title else "", "content_type": r.headers.get("content-type", "")}
            if selector:
                els = soup.select(selector)
                result["elements"] = [str(el) for el in els]
                result["text"] = "\n".join(el.get_text(strip=True) for el in els)
            else:
                for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
                    tag.decompose()
                result["text"] = soup.get_text(separator="\n").strip()[:30000]
            print(json.dumps({**result, "success": True}))

        elif action == "post":
            r = requests.post(url, data=data, headers=headers, timeout=timeout)
            r.raise_for_status()
            print(json.dumps({"success": True, "url": r.url, "status": r.status_code, "text": r.text[:10000]}))

        elif action == "search":
            query = args.get("query", "")
            r = requests.get(f"https://duckduckgo.com/html/?q={quote_plus(query)}", headers=headers, timeout=timeout)
            soup = BeautifulSoup(r.text, "lxml")
            results = []
            for a in soup.select("a.result__snippet, a.result__url"):
                pass
            for res in soup.select(".result"):
                t = res.select_one(".result__snippet, .result__title")
                u = res.select_one("a.result__snippet, a.result__url, a[href]")
                if t and u:
                    results.append({"title": t.get_text(strip=True), "url": u.get("href", ""), "snippet": t.get_text(strip=True)})
            print(json.dumps({"success": True, "query": query, "results": results[:10], "count": len(results)}))

        elif action == "extract":
            r = requests.get(url, headers=headers, timeout=timeout)
            soup = BeautifulSoup(r.text, "lxml")
            if selector:
                els = soup.select(selector)
                print(json.dumps({"success": True, "elements": [str(e) for e in els], "text": "\n".join(e.get_text(strip=True) for e in els)}))
            else:
                for tag in soup(["script", "style"]): tag.decompose()
                print(json.dumps({"success": True, "text": soup.get_text(separator="\n").strip()[:30000]}))

        elif action == "submit_form":
            r = requests.get(url, headers=headers, timeout=timeout)
            soup = BeautifulSoup(r.text, "lxml")
            form = soup.select_one(selector) if selector else soup.find("form")
            if not form:
                print(json.dumps({"success": False, "error": "No form found"})); return
            action_url = form.get("action") or url
            method = form.get("method", "get").lower()
            inputs = {inp.get("name"): inp.get("value", "") for inp in form.find_all(["input", "select", "textarea"]) if inp.get("name")}
            inputs.update(data)
            if method == "post":
                r = requests.post(urljoin(url, action_url), data=inputs, headers=headers, timeout=timeout)
            else:
                r = requests.get(urljoin(url, action_url), params=inputs, headers=headers, timeout=timeout)
            r.raise_for_status()
            print(json.dumps({"success": True, "url": r.url, "status": r.status_code, "text": r.text[:10000]}))

        else:
            print(json.dumps({"success": False, "error": f"Unknown action: {action}"}))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e), "action": action}))

if __name__ == "__main__":
    main()