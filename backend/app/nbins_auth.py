"""Validate HS256 JWTs issued by the NBINS system.

NBINS (Cloudflare Workers) signs tokens with HMAC-SHA256 over
``base64url(header).base64url(payload)`` using a shared secret. This module
verifies those tokens and maps NBINS roles onto the local user/admin roles.
Kept free of FastAPI/SQLAlchemy imports so it can be tested standalone.
"""

import base64
import hashlib
import hmac
import json
import os
import time

NBINS_JWT_SECRET = os.environ.get("NBINS_JWT_SECRET", "nbins-dev-jwt-secret")

# NBINS roles -> local roles. Unknown roles are rejected.
NBINS_ROLE_MAP = {
    "admin": "admin",
    "manager": "admin",
    "reviewer": "user",
    "inspector": "user",
}


def _b64url_decode(value: str) -> bytes:
    padded = value + "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(padded.encode())


def parse_nbins_jwt(token: str, secret: str | None = None) -> dict[str, str] | None:
    secret = NBINS_JWT_SECRET if secret is None else secret
    parts = token.split(".")
    if len(parts) != 3:
        return None
    header_b64, payload_b64, signature_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}".encode()
    digest = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    expected = base64.urlsafe_b64encode(digest).decode().rstrip("=")
    if not hmac.compare_digest(expected, signature_b64):
        return None
    try:
        header = json.loads(_b64url_decode(header_b64))
        payload = json.loads(_b64url_decode(payload_b64))
    except (ValueError, UnicodeDecodeError):
        return None
    if not isinstance(header, dict) or header.get("alg") != "HS256" or header.get("typ") != "JWT":
        return None
    if not isinstance(payload, dict):
        return None
    exp = payload.get("exp")
    if not isinstance(exp, (int, float)) or exp <= time.time():
        return None
    role = NBINS_ROLE_MAP.get(payload.get("role"))
    if role is None:
        return None
    user = payload.get("displayName") or payload.get("username") or payload.get("sub")
    if not isinstance(user, str) or not user:
        return None
    return {"role": role, "user": user}
