# IRiS — Login Page

**Route:** `/login`  
**Auth:** Public (redirect to `/dashboard` if already authenticated)  
**File:** `src/pages/auth/LoginPage.tsx`

---

## Layout

Full-viewport page. Dark navy background (`#0D1B2A`) with abstract geometric pattern overlay (CSS — concentric ovals/rings in `rgba(255,255,255,0.04)`).

```
┌─────────────────────────────────────────────────────────────┐
│  [dark bg with subtle ring pattern]                         │
│                                                             │
│           [MetLife logo] │ IRiS                             │
│                    (Intelligent Reinsurance System)         │
│                                                             │
│           Secure sign-in                                    │
│           Sign in to your workspace                         │
│           Enterprise SSO, MFA-enforced for production       │
│                                                             │
│        ┌────────────────────────────────────────┐          │
│        │ Email                                  │          │
│        │ [✉ admin@metlife-re.demo         ]     │          │
│        │                                        │          │
│        │ Password                Forgot password?│         │
│        │ [🔒 ••••••••••••••      ]              │          │
│        │                                        │          │
│        │ [    Sign in to IRiS (dark btn)   ]    │          │
│        │                                        │          │
│        │ ————————— or ——————————                │          │
│        │                                        │          │
│        │ [Continue with Enterprise SSO (SAML)]  │          │
│        └────────────────────────────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Details

### Logo Area
- MetLife logo SVG (blue/green squares) + vertical divider + "IRiS" (20px bold white) + "(Intelligent Reinsurance System)" (13px muted grey)
- Centered horizontally, above the card

### Login Card
- `background: white`
- `border-radius: 12px`
- `box-shadow: 0 20px 60px rgba(0,0,0,0.3)`
- `padding: 40px 48px`
- `width: 440px`
- Centered in viewport

### Form Fields
- Label: `13px / font-weight 500 / color #546E7A`
- Input: full-width, `border: 1px solid #E1E8ED`, icon prefix (mail / lock)
- "Forgot password?" link: right-aligned, `color: #1A6B9A`, `13px`

### Primary Button
- Full width, `background: #0D1B2A`, `color: white`, `height: 44px`, `border-radius: 8px`, `font-weight 600`
- Hover: `background: #1A6B9A`
- Loading state: spinner icon

### SSO Button
- Full width, `background: white`, `border: 1px solid #E1E8ED`, `color: #1A6B9A`, `height: 44px`
- Hover: `background: #F5F7FA`

### Divider
- `color: #90A4AE / font-size 12px` centered between buttons with horizontal lines

---

## State Management

```typescript
const [email, setEmail] = useState('admin@metlife-re.demo')  // pre-filled for POC
const [password, setPassword] = useState('')
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)

const handleLogin = async () => {
  setLoading(true)
  try {
    const result = await authApi.login({ email, password })
    authStore.setUser(result.user)
    authStore.setToken(result.access_token)
    navigate('/dashboard')
  } catch (e) {
    setError('Invalid credentials. Try demo1234.')
  } finally {
    setLoading(false)
  }
}

const handleSSO = async () => {
  // Calls POST /auth/sso — returns super_admin token
  const result = await authApi.sso()
  authStore.setUser(result.user)
  navigate('/dashboard')
}
```

---

## Background Pattern (CSS)
```css
.login-bg {
  background: #0D1B2A;
  position: relative;
  overflow: hidden;
}
.login-bg::before {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 900px; height: 900px;
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 50%;
  box-shadow:
    0 0 0 120px rgba(255,255,255,0.02),
    0 0 0 240px rgba(255,255,255,0.015),
    0 0 0 360px rgba(255,255,255,0.01);
}
```
