// Which "add to home screen" path a device needs, read from the user agent. Pure, so it can be checked without a browser.
// Ported from nara-flood's install guide (lib/pwa/platform.ts), plus a desktop case for browsers with an install button.

export type PwaInApp = 'line' | 'facebook' | 'instagram' | 'webview'
export type PwaPlatform =
  | { kind: 'none' } // already running as the installed app
  | { kind: 'unsupported' } // desktop Safari: nothing to install from the page
  | { kind: 'desktop' } // Chromium desktop: only its own install prompt
  | { kind: 'android', prompts: boolean } // prompts: a Chromium browser that hands over its install prompt; Firefox and the phone makers' browsers never do
  | { kind: 'ios', safari: boolean, menuInMore: boolean } // menuInMore: Safari 26+, where Share sits inside the ⋯ menu
  | { kind: 'in-app', app: PwaInApp, os: 'ios' | 'android', browser: 'Safari' | 'Chrome' } // cannot install; browser = the OS default to send them to

export function pwaPlatform(userAgent: string, env: { standalone: boolean, maxTouchPoints: number }): PwaPlatform {
  if (env.standalone) return { kind: 'none' }
  const ua = userAgent
  // iPadOS asks for desktop pages and says it is a Mac; only touch gives it away.
  const ios = /iPhone|iPod|iPad/.test(ua) || (/Macintosh/.test(ua) && env.maxTouchPoints > 1)
  const android = /Android/.test(ua)

  // In-app browsers first: they cannot install whatever the OS is.
  const app: PwaInApp | null = /\bLine\//i.test(ua)
    ? 'line'
    : /FBAN|FBAV|FB_IAB|FBIOS/.test(ua)
      ? 'facebook'
      : /Instagram/.test(ua)
        ? 'instagram'
        : /; wv\)/.test(ua)
          ? 'webview'
          : null
  if (app && (ios || android)) return { kind: 'in-app', app, os: ios ? 'ios' : 'android', browser: ios ? 'Safari' : 'Chrome' }

  if (ios) {
    // Other iOS browsers carry their own token; Safari 26 freezes the OS part at 18_x, so read Version/.
    const safari = !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|YaBrowser|DuckDuckGo/.test(ua)
    const version = /Version\/(\d+)/.exec(ua)
    return { kind: 'ios', safari, menuInMore: safari && !!version && Number(version[1]) >= 26 }
  }
  if (android) {
    return { kind: 'android', prompts: /Chrome\//.test(ua) && !/Firefox|MiuiBrowser|XiaoMi|HeyTapBrowser|OppoBrowser|VivoBrowser|HuaweiBrowser|UCBrowser|Opera Mini|OPR\/|Puffin/.test(ua) }
  }
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua)) return { kind: 'unsupported' }
  return { kind: 'desktop' }
}

// The drawn phone screens above the install steps (components/pwa/PwaDemoFrame.vue).
export type PwaFrameKind =
  | 'safariMore' // Safari 26: the ⋯ at the end of the address bar
  | 'moreMenu' // ...its menu, with แชร์ at the top
  | 'safariShareBar' // Safari before 26: the share button on the bottom bar
  | 'addressShare' // Chrome and others on iPhone: the share button in the address bar
  | 'shareSheet' // the share sheet's เพิ่มไปยังหน้าจอโฮม
  | 'confirm' // the เพิ่ม at the top right
  | 'home' // the new icon on the home screen
  | 'chromeBar' // Android Chrome: the ⋮ at the end of the address bar
  | 'chromeMenu' // ...its menu, with เพิ่มลงในหน้าจอหลัก
  | 'inAppBar' // LINE or Facebook's own bar, with its ⋮
  | 'inAppMenu' // ...its menu, with เปิดในเบราว์เซอร์อื่น
  | 'opened' // the site open in the phone's browser

// The button a step names, drawn in its chip: an icon, the app's own icon, or words only.
export type PwaChipIcon = 'more' | 'moreVertical' | 'share' | 'plusSquare' | 'app'
// One install step: its words live under the i18n key (pre / btn / post / alt), its picture is the frame.
export interface PwaStep { key: string, icon?: PwaChipIcon, frame: PwaFrameKind }
