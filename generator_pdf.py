"""Contract HTML/PDF generator using weasyprint + Jinja2 templates.

Requires GTK3 runtime on Windows for weasyprint (PDF only — HTML preview works without it).
Install from: https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases
"""

import os
from jinja2 import Environment, FileSystemLoader

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "templates")
_env = None


def _get_env():
    global _env
    if _env is None:
        _env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))
    return _env


def render_html(template_name: str, data: dict) -> str:
    """Render a Jinja2 template to HTML string (no PDF conversion)."""
    env = _get_env()
    template = env.get_template(template_name)
    return template.render(**data)


def _render_pdf(template_name: str, data: dict) -> bytes:
    from weasyprint import HTML
    html_str = render_html(template_name, data)
    return HTML(string=html_str).write_pdf()


def generate_pi_pdf(data: dict) -> bytes:
    return _render_pdf("pi_template.html", data)


def generate_factory_pdf(data: dict) -> bytes:
    return _render_pdf("factory_template.html", data)
