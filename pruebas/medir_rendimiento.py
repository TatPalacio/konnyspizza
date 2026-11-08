#!/usr/bin/env python3
"""Mide navegación y solicitudes públicas a Supabase con Edge y Selenium."""
from __future__ import annotations

import argparse
import statistics
import time
from urllib.parse import urlparse

from selenium import webdriver
from selenium.webdriver.edge.options import Options

HOOK = r"""
window.__perfFetch=[]; window.__perfLcp=0;
const originalFetch=window.fetch;
window.fetch=function(...args){
  const start=performance.now();
  const url=String(args[0] && args[0].url || args[0]);
  return originalFetch.apply(this,args).then(response=>{
    window.__perfFetch.push({url,status:response.status,ms:performance.now()-start});
    return response;
  },error=>{
    window.__perfFetch.push({url,error:String(error),ms:performance.now()-start});
    throw error;
  });
};
try {
  new PerformanceObserver(list=>{
    for(const entry of list.getEntries()) window.__perfLcp=entry.startTime;
  }).observe({type:'largest-contentful-paint',buffered:true});
} catch(error) {}
"""


def medir(url: str, intento: int) -> dict:
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1365,900")
    driver = webdriver.Edge(options=options)
    try:
        driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {"source": HOOK})
        driver.execute_cdp_cmd("Network.enable", {})
        driver.execute_cdp_cmd("Network.setCacheDisabled", {"cacheDisabled": True})
        driver.set_page_load_timeout(60)
        started = time.perf_counter()
        driver.get(url)
        wall_ms = (time.perf_counter() - started) * 1000
        time.sleep(2)
        page = driver.execute_script("""
          const nav=performance.getEntriesByType('navigation')[0];
          return {
            load:nav.loadEventEnd,
            fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
            lcp:window.__perfLcp,
            fetch:window.__perfFetch,
            title:document.title,
            ready:document.readyState
          };
        """)
        base = urlparse(url)
        supabase = [
            item for item in page["fetch"]
            if ".supabase.co" in item.get("url", "")
        ]
        return {
            "run": intento,
            "url": f"{base.scheme}://{base.netloc}{base.path}",
            "browser": f"Microsoft Edge {driver.capabilities.get('browserVersion', 'unknown')}",
            "title": page["title"],
            "ready": page["ready"],
            "loadEventMs": page["load"],
            "browserLoadMs": wall_ms,
            "fcpMs": page["fcp"],
            "lcpMs": page["lcp"],
            "supabaseRequests": [
                {
                    "path": urlparse(item.get("url", "")).path,
                    "status": item.get("status"),
                    "ms": item.get("ms"),
                    "error": item.get("error"),
                }
                for item in supabase
            ],
        }
    finally:
        driver.quit()


def resumen(resultados: list[dict], campo: str) -> str:
    valores = [item[campo] for item in resultados]
    return (
        f"{campo}: mediana {statistics.median(valores):.0f} ms, "
        f"rango {min(valores):.0f}-{max(valores):.0f} ms"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="https://konnyspizza.vercel.app/")
    parser.add_argument("--runs", type=int, default=5)
    args = parser.parse_args()
    if args.runs < 1:
        parser.error("--runs debe ser mayor que cero")

    base = args.url.rstrip("/")
    all_results = []
    for path in ("/", "/admin"):
        url = base + path
        results = [medir(url, run) for run in range(1, args.runs + 1)]
        all_results.extend(results)
        print(url)
        for field in ("loadEventMs", "fcpMs", "lcpMs"):
            print("  " + resumen(results, field))
        calls = [call for result in results for call in result["supabaseRequests"]]
        if calls:
            times = [call["ms"] for call in calls]
            errors = [call for call in calls if call.get("status") != 200]
            print(
                f"  Supabase: {len(calls)} respuestas, "
                f"peor {max(times):.0f} ms, no-200 {len(errors)}"
            )
        else:
            print("  Supabase: sin solicitudes (ruta sin sesión iniciada)")
    print("\nDetalle JSON:")
    import json
    print(json.dumps(all_results, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
