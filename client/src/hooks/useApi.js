import { useState, useEffect, useCallback } from 'react'

/**
 * Generic data-fetching hook.
 * @param {Function} apiFn - async function that returns an axios response
 * @param {Array} deps - dependency array (changing causes re-fetch)
 * @param {boolean} skip - if true, skips the initial fetch
 */
export function useApi(apiFn, deps = [], skip = false) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(!skip)
  const [error, setError]     = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFn()
      setData(res.data)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    if (!skip) fetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetch, skip])

  return { data, loading, error, refetch: fetch }
}
