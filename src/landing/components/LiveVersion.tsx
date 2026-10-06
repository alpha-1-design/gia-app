import { useEffect, useState } from 'react'

export function LiveVersion({ fallback }: { fallback: string }) {
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const expectedTag = `v${fallback.toLowerCase().replace(/\s+/g, '-')}`
    fetch('https://api.github.com/repos/alpha-1-design/gia-app/releases?per_page=20')
      .then(r => (r.ok ? r.json() : null))
      .then((data: { tag_name?: string }[] | null) => {
        const release = data?.find(item => item.tag_name === expectedTag)
        if (!cancelled && release?.tag_name) {
          setVersion(release.tag_name.replace(/^v/, '').replace(/-beta$/i, ' Beta'))
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [fallback])

  return <>{version ?? fallback}</>
}
