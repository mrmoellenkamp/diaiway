"""
Google Cloud Vision API – Safety Enforcement (Python).

- Nur SafeSearchDetection (keine Face Detection, keine Liveness/Spoof).
- Konfigurierbare Schwellenwerte und Blacklist.
- Nutzt die offizielle google-cloud-vision Library.
"""

import base64
import os
from typing import Optional

from google.cloud import vision
from google.cloud.vision_v1 import AnnotateImageResponse

from vision_config import (
    ENABLED_FEATURES,
    RESPONSE_BLACKLIST,
    SAFE_SEARCH_CATEGORIES,
    SAFE_SEARCH_THRESHOLDS,
)


def _get_client() -> Optional[vision.ImageAnnotatorClient]:
    """Erstellt den Vision-Client (Service Account oder ADC)."""
    project_id = os.environ.get("GOOGLE_VISION_PROJECT_ID")
    client_email = os.environ.get("GOOGLE_VISION_CLIENT_EMAIL")
    private_key = os.environ.get("GOOGLE_VISION_PRIVATE_KEY")

    if project_id and client_email and private_key:
        from google.oauth2 import service_account
        credentials = service_account.Credentials.from_service_account_info({
            "type": "service_account",
            "project_id": project_id,
            "client_email": client_email,
            "private_key": private_key.replace("\\n", "\n"),
        })
        return vision.ImageAnnotatorClient(
            credentials=credentials,
            client_options={"api_endpoint": "eu-vision.googleapis.com"},
        )

    api_key = os.environ.get("GOOGLE_CLOUD_VISION_API_KEY")
    if api_key:
        return vision.ImageAnnotatorClient(
            client_options={
                "api_endpoint": "eu-vision.googleapis.com",
                "api_key": api_key,
            }
        )

    return vision.ImageAnnotatorClient(
        client_options={"api_endpoint": "eu-vision.googleapis.com"}
    )


def _filter_response(response: AnnotateImageResponse) -> dict:
    """
    Entfernt blacklistete Response-Elemente.
    Nur safeSearchAnnotation wird für die Auswertung genutzt.
    """
    result = {}
    for key, value in response.__dict__.items():
        if key in RESPONSE_BLACKLIST or value is None:
            continue
        result[key] = value
    return result


def check_image_safety(
    image_content: bytes,
    *,
    thresholds: Optional[SafeSearchThresholds] = None,
) -> dict:
    """
    Prüft ein Bild auf SafeSearch-Verstöße.

    Args:
        image_content: Rohdaten des Bildes (Bytes).
        thresholds: Optionale Schwellenwerte (Standard: SAFE_SEARCH_THRESHOLDS).

    Returns:
        {
            "safe": bool,
            "reason": str | None,
            "violation": {"key": str, "level": str} | None,
        }
    """
    thresholds = thresholds or SAFE_SEARCH_THRESHOLDS
    client = _get_client()
    if not client:
        return {
            "safe": False,
            "reason": "Vision API nicht konfiguriert (fehlende ENV-Variablen).",
            "violation": None,
        }

    image = vision.Image(content=image_content)
    features = [vision.Feature(type_=f) for f in ENABLED_FEATURES]

    try:
        response = client.annotate_image(
            image=image,
            features=features,
        )
    except Exception as e:
        return {
            "safe": False,
            "reason": f"Bildprüfung fehlgeschlagen: {e}",
            "violation": None,
        }

    _filter_response(response)

    annotation = response.safe_search_annotation
    if not annotation:
        return {
            "safe": False,
            "reason": "Bild konnte nicht geprüft werden.",
            "violation": None,
        }

    for category in SAFE_SEARCH_CATEGORIES:
        level = getattr(annotation, category, None)
        if level is None:
            continue
        level_str = str(level.name) if hasattr(level, "name") else str(level)
        if thresholds.is_violation(category, level_str):
            return {
                "safe": False,
                "reason": f"Bild enthält möglicherweise ungeeignete Inhalte ({category}).",
                "violation": {"key": category, "level": level_str},
            }

    return {"safe": True, "reason": None, "violation": None}


def check_image_safety_base64(
    base64_content: str,
    *,
    thresholds: Optional[SafeSearchThresholds] = None,
) -> dict:
    """
    Prüft ein Base64-kodiertes Bild auf SafeSearch-Verstöße.

    Args:
        base64_content: Base64-String (mit oder ohne data-URL-Präfix).
        thresholds: Optionale Schwellenwerte.
    """
    content = base64_content.strip()
    if content.startswith("data:image/"):
        content = content.split(",", 1)[-1]
    try:
        image_bytes = base64.b64decode(content)
    except Exception as e:
        return {
            "safe": False,
            "reason": f"Ungültige Base64-Daten: {e}",
            "violation": None,
        }
    return check_image_safety(image_bytes, thresholds=thresholds)


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python vision_safety.py <path-to-image>")
        sys.exit(1)
    path = sys.argv[1]
    with open(path, "rb") as f:
        result = check_image_safety(f.read())
    print(result)
