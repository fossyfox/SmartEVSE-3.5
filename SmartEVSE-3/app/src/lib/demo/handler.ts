// Shared request router for the demo mock device. Both the `fetch` and the
// `XMLHttpRequest` interceptors (install.ts) funnel through here, so the new Vue
// UI (fetch) and the legacy jQuery UI (XHR/$.ajax) hit exactly the same mock.
import {
  applyWrite,
  autoUpdatePoll,
  autoUpdateStart,
  readSettings,
  verifyPin,
} from './device'

const MOCK_CERT = '-----BEGIN CERTIFICATE-----\n(demo certificate)\n-----END CERTIFICATE-----'

/** Device endpoints the mock owns; anything else is passed through to the network. */
const DEVICE_PATHS = new Set([
  '/settings',
  '/reboot',
  '/update',
  '/autoupdate',
  '/mqtt_ca_cert',
  '/ocpp_ca_cert',
  '/lcd-verify-password',
])

export function isDevicePath(pathname: string): boolean {
  return DEVICE_PATHS.has(pathname)
}

export interface DeviceResponse {
  status: number
  body: string
  contentType: string
}

const json = (body: unknown, status = 200): DeviceResponse => ({
  status,
  body: JSON.stringify(body),
  contentType: 'application/json',
})

const text = (body: string, status = 200): DeviceResponse => ({
  status,
  body,
  contentType: 'text/plain',
})

/**
 * Resolve a device request against the mock. Returns null for paths the mock
 * doesn't own (the caller should fall back to the real network).
 *
 * `params` is the URL query string (writes are `POST /settings?key=value`);
 * `body` is the request body string (only `/lcd-verify-password` uses it).
 */
export function handleDeviceRequest(
  method: string,
  pathname: string,
  params: URLSearchParams,
  body: string,
): DeviceResponse | null {
  switch (pathname) {
    case '/settings':
      if (method === 'POST') {
        applyWrite(params)
        return json({ success: true })
      }
      return json(readSettings())

    case '/reboot':
      return text('Rebooting...')

    case '/mqtt_ca_cert':
    case '/ocpp_ca_cert':
      return text(MOCK_CERT)

    case '/lcd-verify-password': {
      const pin = new URLSearchParams(body).get('password') ?? ''
      return json({ success: verifyPin(pin) })
    }

    case '/autoupdate':
      return json(params.has('owner') ? autoUpdateStart() : autoUpdatePoll())

    case '/update':
      // Accept every chunk so the custom-firmware upload flow completes.
      return text('')

    default:
      return null
  }
}
