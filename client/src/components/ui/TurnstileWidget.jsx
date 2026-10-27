import { useEffect, useRef } from 'react'

// Cloudflare Turnstile widget (bot check on public forms).
// - Calls onToken(token) when solved, onToken(null) when the token expires or errors.
// - Tokens are SINGLE-USE: after every submit attempt, remount it by changing its `key` prop.
// - The site key is public (VITE_TURNSTILE_SITE_KEY); the secret key stays on the server.

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

let scriptPromise = null

// Load the Turnstile script once for the whole app.
const loadTurnstile = () => {
    if (window.turnstile) return Promise.resolve(window.turnstile)
    if (!scriptPromise) {
        scriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script')
            script.src = SCRIPT_SRC
            script.async = true
            script.defer = true
            script.onload = () => resolve(window.turnstile)
            script.onerror = () => {
                scriptPromise = null
                reject(new Error('Turnstile script failed to load'))
            }
            document.head.appendChild(script)
        })
    }
    return scriptPromise
}

export default function TurnstileWidget({ onToken, onError }) {
    const containerRef = useRef(null)
    const onTokenRef = useRef(onToken)
    const onErrorRef = useRef(onError)

    // Keep the latest callbacks without re-rendering the widget.
    useEffect(() => {
        onTokenRef.current = onToken
        onErrorRef.current = onError
    })

    useEffect(() => {
        let widgetId = null
        let cancelled = false

        if (!SITE_KEY) {
            onErrorRef.current?.('Security check is not configured.')
            return undefined
        }

        loadTurnstile()
            .then((turnstile) => {
                if (cancelled || !containerRef.current) return
                widgetId = turnstile.render(containerRef.current, {
                    sitekey: SITE_KEY,
                    theme: 'light',
                    // The normal widget is 300px wide; use the compact one when the space is narrower.
                    size: (containerRef.current?.offsetWidth || window.innerWidth) < 300 ? 'compact' : 'normal',
                    callback: (token) => onTokenRef.current?.(token),
                    'expired-callback': () => onTokenRef.current?.(null),
                    'error-callback': () => {
                        onTokenRef.current?.(null)
                        onErrorRef.current?.('Security check could not load. Please refresh the page.')
                    },
                })
            })
            .catch(() => {
                onErrorRef.current?.('Security check could not load. Please check your connection and refresh.')
            })

        return () => {
            cancelled = true
            if (widgetId !== null && window.turnstile) window.turnstile.remove(widgetId)
        }
    }, [])

    return <div ref={containerRef} className="flex justify-center min-h-[65px]" />
}