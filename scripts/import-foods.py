#!/usr/bin/env python3
"""
Eatlee USDA import script.

Reads a manifest CSV, fetches USDA FoodData Central nutrients, derives WHO
compliance from lib/formula.config.ts, and writes foods/prices into Supabase.

Required environment variables:
- USDA_API_KEY
- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Required manifest columns:
- name
- category
- is_processed
- usda_query
- avg_price

Example:
  python scripts/import-foods.py --manifest scripts/data/food-manifest.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "scripts" / "data" / "food-manifest.csv"
FORMULA_CONFIG_PATH = ROOT / "lib" / "formula.config.ts"

USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"

CATEGORY_VALUES = {
    "meat_fish",
    "dairy_eggs",
    "legumes_grains",
    "vegetables",
    "other",
}


@dataclass(frozen=True)
class ManifestRow:
    name: str
    category: str
    is_processed: bool
    usda_query: str
    avg_price: float


@dataclass(frozen=True)
class FoodPayload:
    name: str
    category: str
    protein: float
    calories: float
    fat: float
    saturated_fat: float
    fiber: float
    carbs: float
    net_carbs: float
    sodium: float
    is_processed: bool
    who_compliant: bool
    usda_fdc_id: str | None


def load_formula_thresholds() -> dict[str, float]:
    text = FORMULA_CONFIG_PATH.read_text(encoding="utf-8")
    patterns = {
        "maxSaturatedFatPct": r"maxSaturatedFatPct:\s*([0-9.]+)",
        "minFiberPer100g": r"minFiberPer100g:\s*([0-9.]+)",
        "maxSodiumPer100g": r"maxSodiumPer100g:\s*([0-9.]+)",
    }
    values: dict[str, float] = {}

    for key, pattern in patterns.items():
        match = re.search(pattern, text)
        if not match:
            raise RuntimeError(f"Could not read {key} from {FORMULA_CONFIG_PATH}.")
        values[key] = float(match.group(1))

    return values


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing environment variable: {name}")
    return value


def request_json(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    data: Any = None,
    method: str | None = None,
) -> Any:
    encoded_data = None
    request_headers = {"Accept": "application/json"}
    if headers:
        request_headers.update(headers)

    if data is not None:
        encoded_data = json.dumps(data).encode("utf-8")
        request_headers["Content-Type"] = "application/json"

    request = urllib.request.Request(
        url,
        data=encoded_data,
        headers=request_headers,
        method=method,
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def parse_bool(value: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"true", "1", "yes", "y"}:
        return True
    if normalized in {"false", "0", "no", "n"}:
        return False
    raise ValueError(f"Invalid boolean value: {value}")


def load_manifest(path: Path) -> list[ManifestRow]:
    if not path.exists():
        raise RuntimeError(
            f"Manifest file not found: {path}. Create it with columns "
            "name,category,is_processed,usda_query,avg_price."
        )

    rows: list[ManifestRow] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        required_columns = {
            "name",
            "category",
            "is_processed",
            "usda_query",
            "avg_price",
        }
        missing = required_columns - set(reader.fieldnames or [])
        if missing:
            raise RuntimeError(f"Manifest missing columns: {', '.join(sorted(missing))}")

        for raw in reader:
            category = (raw.get("category") or "").strip()
            if category not in CATEGORY_VALUES:
                raise RuntimeError(
                    f"Invalid category '{category}' for {raw.get('name')}."
                )

            rows.append(
                ManifestRow(
                    name=(raw.get("name") or "").strip(),
                    category=category,
                    is_processed=parse_bool(raw.get("is_processed") or "false"),
                    usda_query=(raw.get("usda_query") or "").strip(),
                    avg_price=float(raw.get("avg_price") or "0"),
                )
            )

    if not rows:
        raise RuntimeError("Manifest is empty.")

    return rows


NUTRIENT_KEYS = {
    "protein": {
        "Protein",
    },
    "calories": {
        "Energy",
        "Energy (Atwater General Factors)",
    },
    "fat": {
        "Total lipid (fat)",
    },
    "saturated_fat": {
        "Fatty acids, total saturated",
    },
    "fiber": {
        "Fiber, total dietary",
    },
    "carbs": {
        "Carbohydrate, by difference",
    },
    "sodium": {
        "Sodium, Na",
    },
}


def nutrient_value(food: dict[str, Any], key: str) -> float:
    candidates = NUTRIENT_KEYS[key]
    for nutrient in food.get("foodNutrients", []):
        name = nutrient.get("nutrientName") or nutrient.get("name")
        if name in candidates:
            value = nutrient.get("value")
            if value is not None:
                return float(value)
    return 0.0


def fetch_usda_food(query: str, api_key: str) -> dict[str, Any]:
    params = urllib.parse.urlencode(
        {
            "api_key": api_key,
            "query": query,
            "pageSize": 5,
        }
    )
    payload = request_json(f"{USDA_SEARCH_URL}?{params}")
    foods = payload.get("foods") or []
    if not foods:
        raise RuntimeError(f"No USDA result found for query: {query}")
    return foods[0]


def calc_who_compliant(
    *,
    calories: float,
    saturated_fat: float,
    fiber: float,
    sodium: float,
    thresholds: dict[str, float],
) -> bool:
    sat_fat_pct = (saturated_fat * 9 / calories) * 100 if calories > 0 else 0
    return (
        sat_fat_pct <= thresholds["maxSaturatedFatPct"]
        and fiber >= thresholds["minFiberPer100g"]
        and sodium <= thresholds["maxSodiumPer100g"]
    )


def build_food_payload(row: ManifestRow, food: dict[str, Any], thresholds: dict[str, float]) -> FoodPayload:
    protein = nutrient_value(food, "protein")
    calories = nutrient_value(food, "calories")
    fat = nutrient_value(food, "fat")
    saturated_fat = nutrient_value(food, "saturated_fat")
    fiber = nutrient_value(food, "fiber")
    carbs = nutrient_value(food, "carbs")
    sodium = nutrient_value(food, "sodium")
    net_carbs = max(carbs - fiber, 0.0)

    return FoodPayload(
        name=row.name,
        category=row.category,
        protein=round(protein, 2),
        calories=round(calories, 2),
        fat=round(fat, 2),
        saturated_fat=round(saturated_fat, 2),
        fiber=round(fiber, 2),
        carbs=round(carbs, 2),
        net_carbs=round(net_carbs, 2),
        sodium=round(sodium, 2),
        is_processed=row.is_processed,
        who_compliant=calc_who_compliant(
            calories=calories,
            saturated_fat=saturated_fat,
            fiber=fiber,
            sodium=sodium,
            thresholds=thresholds,
        ),
        usda_fdc_id=str(food.get("fdcId")) if food.get("fdcId") else None,
    )


class SupabaseRestClient:
    def __init__(self, url: str, service_role_key: str) -> None:
        self.base_url = url.rstrip("/") + "/rest/v1"
        self.headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Prefer": "return=representation",
        }

    def select_single(self, table: str, *, filters: dict[str, str]) -> dict[str, Any] | None:
        query = urllib.parse.urlencode(filters)
        url = f"{self.base_url}/{table}?select=*&{query}"
        result = request_json(url, headers=self.headers)
        return result[0] if result else None

    def insert(self, table: str, payload: list[dict[str, Any]]) -> list[dict[str, Any]]:
        url = f"{self.base_url}/{table}"
        return request_json(url, headers=self.headers, data=payload, method="POST")

    def patch(self, table: str, *, filters: dict[str, str], payload: dict[str, Any]) -> list[dict[str, Any]]:
        query = urllib.parse.urlencode(filters)
        url = f"{self.base_url}/{table}?{query}"
        headers = {**self.headers, "Prefer": "return=representation"}
        return request_json(url, headers=headers, data=payload, method="PATCH")



def upsert_food_and_price(client: SupabaseRestClient, payload: FoodPayload, avg_price: float) -> None:
    existing = client.select_single(
        "foods",
        filters={"name": f"eq.{payload.name}"},
    )

    food_body = {
        "name": payload.name,
        "category": payload.category,
        "protein": payload.protein,
        "calories": payload.calories,
        "fat": payload.fat,
        "saturated_fat": payload.saturated_fat,
        "fiber": payload.fiber,
        "carbs": payload.carbs,
        "net_carbs": payload.net_carbs,
        "sodium": payload.sodium,
        "is_processed": payload.is_processed,
        "who_compliant": payload.who_compliant,
        "usda_fdc_id": payload.usda_fdc_id,
    }

    if existing:
        updated = client.patch(
            "foods",
            filters={"id": f"eq.{existing['id']}"},
            payload=food_body,
        )
        food_id = updated[0]["id"]
    else:
        inserted = client.insert("foods", [food_body])
        food_id = inserted[0]["id"]

    client.insert(
        "prices",
        [
            {
                "food_id": food_id,
                "price_per_kg": avg_price,
                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
        ],
    )



def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--manifest",
        type=Path,
        default=DEFAULT_MANIFEST,
        help="Path to the food manifest CSV.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch USDA data and print the payloads without writing to Supabase.",
    )
    args = parser.parse_args()

    api_key = require_env("USDA_API_KEY")
    supabase_url = require_env("NEXT_PUBLIC_SUPABASE_URL")
    service_role_key = require_env("SUPABASE_SERVICE_ROLE_KEY")

    manifest = load_manifest(args.manifest)
    thresholds = load_formula_thresholds()
    client = SupabaseRestClient(supabase_url, service_role_key)

    payloads: list[FoodPayload] = []

    for row in manifest:
        usda_food = fetch_usda_food(row.usda_query, api_key)
        payload = build_food_payload(row, usda_food, thresholds)
        payloads.append(payload)
        print(
            f"[import] Prepared {payload.name} from USDA query '{row.usda_query}'.",
            file=sys.stderr,
        )

    if args.dry_run:
        print(json.dumps([payload.__dict__ for payload in payloads], indent=2, ensure_ascii=False))
        return 0

    for row, payload in zip(manifest, payloads, strict=True):
        upsert_food_and_price(client, payload, row.avg_price)
        print(
            f"[import] Wrote {payload.name} and initial price {row.avg_price}.",
            file=sys.stderr,
        )

    print(f"[import] Imported {len(payloads)} foods.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[import] Fatal error: {exc}", file=sys.stderr)
        raise
