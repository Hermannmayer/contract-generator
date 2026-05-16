"""Contract Generator - Flask Application"""

import os
import uuid
from pathlib import Path

from flask import Flask, render_template, request, jsonify, send_file
from werkzeug.utils import secure_filename

from database import init_db, all_rows, get_row, insert_row, update_row, delete_row, get_clause_templates
from generator_pi import generate_pi_excel, generate_pi_excel_with_images
from generator_factory import generate_factory_excel

# ── App setup ──
BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB

# ── Init DB on startup ──
with app.app_context():
    init_db()

# ── Preview endpoints (HTML, no extra deps) ──
def _build_payload(data):
    """Normalize incoming JSON for generator functions."""
    products = data.get("products", [])
    image_paths = {}
    for idx, prod in enumerate(products):
        if prod.get("image_path"):
            p = prod["image_path"].lstrip("/")
            abs_path = BASE_DIR / p
            if abs_path.exists():
                image_paths[str(idx)] = str(abs_path)
    return data, image_paths

@app.route("/api/preview-pi", methods=["POST"])
def preview_pi():
    from generator_pdf import render_html
    data, _ = _build_payload(request.get_json() or {})
    return render_html("pi_template.html", data)

@app.route("/api/preview-factory", methods=["POST"])
def preview_factory():
    from generator_pdf import render_html
    from generator_factory import num2cn
    data, _ = _build_payload(request.get_json() or {})
    total = data.get("total_amount_cny", "0")
    data["total_cny_upper"] = num2cn(total)
    data["price_note"] = data.get("price_note", "成品单价含13%增值税发票，包装，运费")
    data["delivery_note"] = data.get("delivery_note", "20XX年X月X日前全部运送到指定地点")
    return render_html("factory_template.html", data)

# ── Static / Main page ──
@app.route("/")
def index():
    return render_template("index.html")

# ── Generic CRUD endpoints ──
TABLES = ["trading_company", "client", "factory", "port", "clause_template"]

for table in TABLES:
    # GET list
    def make_list(t=table):
        def handler():
            if t == "clause_template":
                factory_id = request.args.get("factory_id", type=int)
                return jsonify(get_clause_templates(for_factory_id=factory_id))
            return jsonify(all_rows(t))
        handler.__name__ = f"list_{t}"
        return handler
    app.add_url_rule(f"/api/{table}s", f"list_{table}", make_list(), methods=["GET"])

    # GET one
    def make_get(t=table):
        def handler(row_id):
            row = get_row(t, row_id)
            if not row:
                return jsonify({"error": "Not found"}), 404
            return jsonify(row)
        handler.__name__ = f"get_{t}"
        return handler
    app.add_url_rule(f"/api/{table}s/<int:row_id>", f"get_{table}", make_get(), methods=["GET"])

    # POST create
    def make_create(t=table):
        def handler():
            data = request.get_json() or {}
            row = insert_row(t, data)
            return jsonify(row), 201
        handler.__name__ = f"create_{t}"
        return handler
    app.add_url_rule(f"/api/{table}s", f"create_{table}", make_create(), methods=["POST"])

    # PUT update
    def make_update(t=table):
        def handler(row_id):
            data = request.get_json() or {}
            row = update_row(t, row_id, data)
            if not row:
                return jsonify({"error": "Not found"}), 404
            return jsonify(row)
        handler.__name__ = f"update_{t}"
        return handler
    app.add_url_rule(f"/api/{table}s/<int:row_id>", f"update_{table}", make_update(), methods=["PUT"])

    # DELETE
    def make_delete(t=table):
        def handler(row_id):
            delete_row(t, row_id)
            return jsonify({"ok": True})
        handler.__name__ = f"delete_{t}"
        return handler
    app.add_url_rule(f"/api/{table}s/<int:row_id>", f"delete_{table}", make_delete(), methods=["DELETE"])

# ── Convenience aliases ──
@app.route("/api/companies", methods=["GET", "POST"])
def companies_crud():
    if request.method == "POST":
        data = request.get_json() or {}
        return jsonify(insert_row("trading_company", data)), 201
    return jsonify(all_rows("trading_company"))

@app.route("/api/companies/<int:row_id>", methods=["GET", "PUT", "DELETE"])
def company_crud(row_id):
    if request.method == "DELETE":
        delete_row("trading_company", row_id)
        return jsonify({"ok": True})
    elif request.method == "PUT":
        return jsonify(update_row("trading_company", row_id, request.get_json() or {}))
    else:
        row = get_row("trading_company", row_id)
        return jsonify(row) if row else (jsonify({"error": "Not found"}), 404)

@app.route("/api/clients", methods=["GET", "POST"])
def clients_crud():
    if request.method == "POST":
        data = request.get_json() or {}
        return jsonify(insert_row("client", data)), 201
    return jsonify(all_rows("client"))

@app.route("/api/clients/<int:row_id>", methods=["GET", "PUT", "DELETE"])
def client_crud(row_id):
    if request.method == "DELETE":
        delete_row("client", row_id)
        return jsonify({"ok": True})
    elif request.method == "PUT":
        return jsonify(update_row("client", row_id, request.get_json() or {}))
    else:
        row = get_row("client", row_id)
        return jsonify(row) if row else (jsonify({"error": "Not found"}), 404)

@app.route("/api/factories", methods=["GET", "POST"])
def factories_crud():
    if request.method == "POST":
        data = request.get_json() or {}
        return jsonify(insert_row("factory", data)), 201
    return jsonify(all_rows("factory"))

@app.route("/api/factories/<int:row_id>", methods=["GET", "PUT", "DELETE"])
def factory_crud(row_id):
    if request.method == "DELETE":
        delete_row("factory", row_id)
        return jsonify({"ok": True})
    elif request.method == "PUT":
        return jsonify(update_row("factory", row_id, request.get_json() or {}))
    else:
        row = get_row("factory", row_id)
        return jsonify(row) if row else (jsonify({"error": "Not found"}), 404)

@app.route("/api/ports", methods=["GET", "POST"])
def ports_crud():
    if request.method == "POST":
        data = request.get_json() or {}
        return jsonify(insert_row("port", data)), 201
    return jsonify(all_rows("port"))

@app.route("/api/ports/<int:row_id>", methods=["GET", "PUT", "DELETE"])
def port_crud(row_id):
    if request.method == "DELETE":
        delete_row("port", row_id)
        return jsonify({"ok": True})
    elif request.method == "PUT":
        return jsonify(update_row("port", row_id, request.get_json() or {}))
    else:
        row = get_row("port", row_id)
        return jsonify(row) if row else (jsonify({"error": "Not found"}), 404)

@app.route("/api/templates", methods=["GET", "POST"])
def templates_crud():
    if request.method == "POST":
        data = request.get_json() or {}
        return jsonify(insert_row("clause_template", data)), 201
    factory_id = request.args.get("factory_id", type=int)
    return jsonify(get_clause_templates(for_factory_id=factory_id))

@app.route("/api/templates/<int:row_id>", methods=["GET", "PUT", "DELETE"])
def template_crud(row_id):
    if request.method == "DELETE":
        delete_row("clause_template", row_id)
        return jsonify({"ok": True})
    elif request.method == "PUT":
        return jsonify(update_row("clause_template", row_id, request.get_json() or {}))
    else:
        row = get_row("clause_template", row_id)
        return jsonify(row) if row else (jsonify({"error": "Not found"}), 404)

# ── Image upload ──
@app.route("/api/upload-image", methods=["POST"])
def upload_image():
    if "image" not in request.files:
        return jsonify({"error": "No image file"}), 400
    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400
    ext = Path(file.filename).suffix.lower()
    if ext not in (".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"):
        return jsonify({"error": "Unsupported format"}), 400
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = UPLOAD_DIR / filename
    file.save(str(filepath))
    return jsonify({"filename": filename, "path": f"/uploads/{filename}"})

# ── Generation endpoints ──
@app.route("/api/generate-pi-excel", methods=["POST"])
def gen_pi_excel():
    data, img_paths = _build_payload(request.get_json() or {})
    seal = data.get("seal_path")
    seal_abs = None
    if seal:
        sp = seal.lstrip("/")
        abs_sp = BASE_DIR / sp
        if abs_sp.exists(): seal_abs = str(abs_sp)
    excel_bytes = generate_pi_excel(data, img_paths, seal_path=seal_abs)
    cn = data.get('contract_no', 'contract').replace('CY-','')
    filename = f"PI-CY{cn}.xlsx"
    return send_file(
        __import__("io").BytesIO(excel_bytes),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename,
    )

@app.route("/api/generate-pi-pdf", methods=["POST"])
def gen_pi_pdf():
    try:
        from generator_pdf import generate_pi_pdf
    except Exception as e:
        return jsonify({"error": f"PDF生成失败: GTK3未安装({e}). 请先安装GTK3 Runtime: https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases"}), 500
    data, _ = _build_payload(request.get_json() or {})
    pdf_bytes = generate_pi_pdf(data)
    filename = f"PI-{data.get('contract_no', 'contract')}.pdf"
    return send_file(
        __import__("io").BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=filename,
    )

@app.route("/api/generate-factory-excel", methods=["POST"])
def gen_factory_excel():
    data, img_paths = _build_payload(request.get_json() or {})
    excel_bytes = generate_factory_excel(data, img_paths)
    cn = data.get('contract_no', 'contract').replace('CY-','')
    fac = data.get('factory', {})
    fac_short = fac.get('category', '') or fac.get('name', '')[:4]
    filename = f"CY-{cn}定做合同({fac_short}).xlsx"
    return send_file(
        __import__("io").BytesIO(excel_bytes),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename,
    )

@app.route("/api/generate-factory-pdf", methods=["POST"])
def gen_factory_pdf():
    try:
        from generator_pdf import generate_factory_pdf
    except Exception as e:
        return jsonify({"error": f"PDF生成失败: GTK3未安装({e}). 请先安装GTK3 Runtime"}), 500
    from generator_factory import num2cn
    data, _ = _build_payload(request.get_json() or {})
    total = data.get("total_amount_cny", "0")
    data["total_cny_upper"] = num2cn(total)
    data["price_note"] = data.get("price_note", "成品单价含13%增值税发票，包装，运费")
    data["delivery_note"] = data.get("delivery_note", "20XX年X月X日前全部运送到指定地点")
    pdf_bytes = generate_factory_pdf(data)
    cn = data.get('contract_no', 'contract').replace('CY-','')
    fac = data.get('factory', {})
    fac_short = fac.get('category', '') or fac.get('name', '')[:4]
    filename = f"CY-{cn}定做合同({fac_short}).pdf"
    return send_file(
        __import__("io").BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=filename,
    )

# ── Serve uploaded images ──
@app.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_file(UPLOAD_DIR / filename)

# ── Startup ──
if __name__ == "__main__":
    app.run(debug=True, port=5000)
