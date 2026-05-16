import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "data.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()

    c.executescript("""
        CREATE TABLE IF NOT EXISTS trading_company (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            name_en TEXT,
            address TEXT,
            address_en TEXT,
            tax_id TEXT,
            phone TEXT
        );

        CREATE TABLE IF NOT EXISTS client (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            address TEXT,
            phone TEXT
        );

        CREATE TABLE IF NOT EXISTS factory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            address TEXT,
            tax_id TEXT,
            bank_name TEXT,
            bank_account TEXT,
            category TEXT,
            notes TEXT,
            default_template_id INTEGER
        );

        CREATE TABLE IF NOT EXISTS port (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            name_en TEXT
        );

        CREATE TABLE IF NOT EXISTS clause_template (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            factory_id INTEGER,
            clause_1_product TEXT,
            clause_2_quality TEXT,
            clause_3_mold_fee TEXT,
            clause_4_packaging TEXT,
            clause_5_delivery TEXT,
            clause_6_inspection TEXT,
            clause_7_payment TEXT,
            clause_8_guarantee TEXT,
            clause_9_liability TEXT,
            clause_10_dispute TEXT,
            clause_11_shipping TEXT,
            clause_12_other TEXT,
            FOREIGN KEY (factory_id) REFERENCES factory(id)
        );
    """)

    # Seed data: trading companies (示例数据，请替换为实际信息)
    c.execute("SELECT COUNT(*) FROM trading_company")
    if c.fetchone()[0] == 0:
        c.execute(
            "INSERT INTO trading_company (name, name_en, address, address_en, tax_id) VALUES (?,?,?,?,?)",
            (
                "示例贸易有限公司",
                "EXAMPLE TRADING CO.,LTD",
                "XX市XX区XX路XX号",
                "XXX Road, XXX District, XX City, China",
                "91370000XXXXXXXXXX",
            ),
        )
        c.execute(
            "INSERT INTO trading_company (name, name_en, address, address_en, tax_id) VALUES (?,?,?,?,?)",
            (
                "示例服装有限公司",
                "EXAMPLE GARMENT CO.,LTD",
                "XX市XX区XX路XX号",
                "",
                "91370000XXXXXXXXXX",
            ),
        )

    # Seed data: clients (示例数据，请替换为实际信息)
    c.execute("SELECT COUNT(*) FROM client")
    if c.fetchone()[0] == 0:
        c.execute(
            "INSERT INTO client (name, address, phone) VALUES (?,?,?)",
            (
                "示例客户有限公司",
                "XX ROAD, XX CITY, XX COUNTRY",
                "000-0000-0000",
            ),
        )

    # Seed data: factories (示例数据，请替换为实际信息)
    c.execute("SELECT COUNT(*) FROM factory")
    if c.fetchone()[0] == 0:
        factories = [
            (
                "示例硅胶制品有限公司",
                "XX市XX区XX路XX号",
                "",
                "XX银行XX支行",
                "",
                "硅胶",
                "",
                2,
            ),
            (
                "示例工艺品有限公司",
                "XX市XX区XX路XX号",
                "91370000XXXXXXXXXX",
                "",
                "",
                "工艺品/头饰",
                "",
                None,
            ),
            (
                "示例服饰有限责任公司",
                "XX市XX区XX路XX号",
                "",
                "XX银行XX分理处",
                "XXXXXXXXXXXXX",
                "纺织/服装",
                "",
                3,
            ),
            (
                "示例文具有限公司",
                "XX市XX区XX路XX号",
                "91370000XXXXXXXXXX",
                "XX银行XX支行",
                "XXXXXXXXXXXXX",
                "PP文具",
                "",
                4,
            ),
        ]
        c.executemany(
            "INSERT INTO factory (name, address, tax_id, bank_name, bank_account, category, notes, default_template_id) VALUES (?,?,?,?,?,?,?,?)",
            factories,
        )

    # Seed data: ports
    c.execute("SELECT COUNT(*) FROM port")
    if c.fetchone()[0] == 0:
        ports = [
            ("青岛", "QINGDAO"),
            ("宁波", "NINGBO"),
            ("深圳", "SHENZHEN"),
            ("上海", "SHANGHAI"),
            ("天津", "TIANJIN"),
        ]
        c.executemany("INSERT INTO port (name, name_en) VALUES (?,?)", ports)

    # Seed data: clause templates
    c.execute("SELECT COUNT(*) FROM clause_template")
    if c.fetchone()[0] == 0:
        default_clauses = {
            "clause_1_product": "定作物品名称、款号、数量、金额、交货时间详见上表。",
            "clause_2_quality": "按确认样投产，质量标准按出口标准，一等品。无色差、脏污、残疵。克重偏差±3%。",
            "clause_3_mold_fee": "无模具费。",
            "clause_4_packaging": "按定作方要求包装，含OPP袋、贴纸、纸箱。包装材料由承揽方提供并计入单价。",
            "clause_5_delivery": "承揽方厂内检验后，送货至定作方指定地点（国内港口或仓库），运费由承揽方承担。",
            "clause_6_inspection": "需国外客户指定检验员检验合格。若不合格，返工/退货费用由承揽方承担。",
            "clause_7_payment": "签订合同3日内支付30%预付款，装船后承揽方开具13%增值税发票，定作方1个月内支付尾款。",
            "clause_8_guarantee": "另行签订担保书作为合同附件。",
            "clause_9_liability": "因质量、交期等问题导致国外客户索赔的，由承揽方承担全部责任和费用。",
            "clause_10_dispute": "协商解决；协商不成的，向定作方所在地人民法院起诉。",
            "clause_11_shipping": "不允许短装，溢装不超过1%。按定作方指定时间、地点交货。",
            "clause_12_other": "本合同一式两份，双方各执一份，具有同等法律效力。",
        }

        # Default template (通用)
        c.execute(
            "INSERT INTO clause_template (name, factory_id, clause_1_product, clause_2_quality, clause_3_mold_fee, clause_4_packaging, clause_5_delivery, clause_6_inspection, clause_7_payment, clause_8_guarantee, clause_9_liability, clause_10_dispute, clause_11_shipping, clause_12_other) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            ("默认通用模板", None, *default_clauses.values()),
        )

        # Silicone template (硅胶类)
        silicone = dict(default_clauses)
        silicone["clause_2_quality"] = "按确认样投产，质量标准按出口标准，一等品。大货硅胶材料需过日本食品检测合格。无色差、脏污、残疵。克重偏差±3%。"
        silicone["clause_3_mold_fee"] = "产前模具费¥{mold_fee_pre}元，大货模具费¥{mold_fee_mass}元。累计下单达30,000个退还产前模具费，达50,000个退还大货模具费。模具所有权归定作方。"
        silicone["clause_7_payment"] = "签订合同3日内支付30%预付款，装船后承揽方开具13%增值税发票，定作方1个月内支付尾款。"
        c.execute(
            "INSERT INTO clause_template (name, factory_id, clause_1_product, clause_2_quality, clause_3_mold_fee, clause_4_packaging, clause_5_delivery, clause_6_inspection, clause_7_payment, clause_8_guarantee, clause_9_liability, clause_10_dispute, clause_11_shipping, clause_12_other) VALUES (?,1,?,?,?,?,?,?,?,?,?,?,?,?)",
            ("硅胶类-力铨实业", *silicone.values()),
        )

        # Textile template (纺织类)
        textile = dict(default_clauses)
        textile["clause_2_quality"] = "按确认样投产，质量标准按出口标准，一等品。严格使用定作方提供的面料，无色差，克重偏差±3%。缝制工艺按确认样标准，含顺色线、整烫。"
        textile["clause_3_mold_fee"] = "无模具费。"
        textile["clause_7_payment"] = "承揽方开具13%增值税发票后一个月内付款。"
        textile["clause_11_shipping"] = "不允许短装或溢装。按定作方指定时间、地点交货。"
        c.execute(
            "INSERT INTO clause_template (name, factory_id, clause_1_product, clause_2_quality, clause_3_mold_fee, clause_4_packaging, clause_5_delivery, clause_6_inspection, clause_7_payment, clause_8_guarantee, clause_9_liability, clause_10_dispute, clause_11_shipping, clause_12_other) VALUES (?,3,?,?,?,?,?,?,?,?,?,?,?,?)",
            ("纺织类-盛佳服饰", *textile.values()),
        )

        # PP stationery template
        pp_stationery = dict(default_clauses)
        pp_stationery["clause_2_quality"] = "按确认样投产，质量标准按出口标准。内层材料压合均匀无开裂，表料颜色按客户确认，无脏污破损。唛头四面印刷（2正唛+2侧唛带条形码）。"
        pp_stationery["clause_4_packaging"] = "OPP袋+不干胶贴纸（覆哑光膜），纸箱包装。唛头需四面印刷。"
        pp_stationery["clause_5_delivery"] = "承揽方厂内检验后，送货至{port_name}港指定仓库，运费由承揽方承担。需提供3套产前样+4套大货船样（免费）。"
        pp_stationery["clause_7_payment"] = "签订合同3日内预付30%，剩余部分开增值税发票后发货当天结清。"
        pp_stationery["clause_12_other"] = "客户所有信息不得泄露，客户产品不得私自销售。本合同一式两份，双方各执一份，具有同等法律效力。"
        c.execute(
            "INSERT INTO clause_template (name, factory_id, clause_1_product, clause_2_quality, clause_3_mold_fee, clause_4_packaging, clause_5_delivery, clause_6_inspection, clause_7_payment, clause_8_guarantee, clause_9_liability, clause_10_dispute, clause_11_shipping, clause_12_other) VALUES (?,4,?,?,?,?,?,?,?,?,?,?,?,?)",
            ("PP文具类-亦阳文具", *pp_stationery.values()),
        )

    conn.commit()
    conn.close()


# ── CRUD helpers ──

def all_rows(table, order_by="id DESC"):
    conn = get_db()
    rows = conn.execute(f"SELECT * FROM {table} ORDER BY {order_by}").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_row(table, row_id):
    conn = get_db()
    row = conn.execute(f"SELECT * FROM {table} WHERE id=?", (row_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def insert_row(table, data: dict):
    conn = get_db()
    keys = [k for k in data if k != "id"]
    placeholders = ",".join(["?"] * len(keys))
    cols = ",".join(keys)
    sql = f"INSERT INTO {table} ({cols}) VALUES ({placeholders})"
    cur = conn.execute(sql, [data[k] for k in keys])
    conn.commit()
    row_id = cur.lastrowid
    conn.close()
    return get_row(table, row_id)


def update_row(table, row_id, data: dict):
    conn = get_db()
    keys = [k for k in data if k != "id"]
    sets = ",".join(f"{k}=?" for k in keys)
    sql = f"UPDATE {table} SET {sets} WHERE id=?"
    conn.execute(sql, [data[k] for k in keys] + [row_id])
    conn.commit()
    conn.close()
    return get_row(table, row_id)


def delete_row(table, row_id):
    conn = get_db()
    conn.execute(f"DELETE FROM {table} WHERE id=?", (row_id,))
    conn.commit()
    conn.close()


def get_clause_templates(for_factory_id=None):
    conn = get_db()
    if for_factory_id:
        rows = conn.execute(
            "SELECT * FROM clause_template WHERE factory_id=? OR factory_id IS NULL ORDER BY factory_id DESC",
            (for_factory_id,),
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM clause_template ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]
