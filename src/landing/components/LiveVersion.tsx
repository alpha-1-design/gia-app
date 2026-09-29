import { useEffect, useState } from 'react'

/**
 * Renders "Phone vX.Y.Z.W", fetched live from the latest GitHub release so
 * this line can't drift out of date the way a hand-typed version string does.
 * Falls back to `fallback` if the request fails or hasn't resolved yet.
 */
export function LiveVersion({ fallback }: { fallback: string }) {
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('https://api.github.com/repos/alpha-1-design/gia-app/releases/latest')
      .then(r => (r.ok ? r.json() : null))
      .then((data: { tag_name?: string } | null) => {
        if (!cancelled && data?.tag_name) setVersion(data.tag_name.replace(/^v/, ''))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return <>{version ?? fallback}</>
}
