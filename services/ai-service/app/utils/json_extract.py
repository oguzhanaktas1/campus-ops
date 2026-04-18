import json


def extract_json_object(raw_text: str) -> dict[str, object]:
    start = raw_text.find("{")
    end = raw_text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in model response.")
    return json.loads(raw_text[start : end + 1])
