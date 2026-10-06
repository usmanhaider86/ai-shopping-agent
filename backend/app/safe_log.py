"""Windows-safe console logging (avoids cp1252 UnicodeEncodeError on repr)."""


def safe_for_console(obj: object) -> str:
    try:
        s = repr(obj)
    except Exception:
        s = "<unreprable>"
    return s.encode("ascii", "replace").decode("ascii")
