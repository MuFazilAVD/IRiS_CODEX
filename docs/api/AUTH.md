# IRiS — Auth API

## Base URL: `/api/v1/auth`

---

### POST `/login`
Authenticate user, return JWT + role.

**Request:**
```json
{
  "email": "admin@metlife-re.demo",
  "password": "password123"
}
```

**Response 200:**
```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 28800,
  "user": {
    "id": "uuid",
    "email": "admin@metlife-re.demo",
    "full_name": "Admin User",
    "role": "super_admin",
    "is_active": true
  }
}
```

**Response 401:**
```json
{ "detail": "Invalid credentials" }
```

---

### POST `/sso`
Mock SSO flow — returns pre-seeded super_admin user.

**Response 200:** Same as `/login` but no body required.

---

### GET `/me`
Returns current user from JWT.

**Headers:** `Authorization: Bearer {token}`

**Response 200:**
```json
{
  "id": "uuid",
  "email": "...",
  "full_name": "Admin User",
  "role": "super_admin"
}
```

---

### POST `/register` (internal/admin only)
Create a new user account.

**Request:**
```json
{
  "email": "h.suzuki@metlife-re.demo",
  "full_name": "H. Suzuki",
  "role": "underwriter",
  "password": "temp-password"
}
```

**Response 201:**
```json
{ "id": "uuid", "email": "...", "role": "underwriter" }
```

---

## Demo Credentials (POC seed data)
| Email | Password | Role |
|-------|----------|------|
| admin@metlife-re.demo | demo1234 | super_admin |
| m.patel@reinsure.io | demo1234 | underwriter |
| a.chen@reinsure.io | demo1234 | claims_ops |
| j.morales@reinsure.io | demo1234 | compliance |
| d.rhodes@reinsure.io | demo1234 | admin |
