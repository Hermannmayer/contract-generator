# 合同生成器 / Contract Generator

中日贸易合同生成工具。一次填入产品数据，自动生成两类合同：

| 合同类型 | 描述 | 格式 |
|---------|------|------|
| **PI (Proforma Invoice)** | 给客户的英文商业发票（FOB报价） | Excel + PDF |
| **工厂合同** | 给中国工厂的中文成品定做合同 | Excel + PDF |

适用于外贸公司/SOHO向日本出口、从中国工厂采购的业务场景。

---

## 功能

- **双格式导出**：Excel 和 PDF 两种格式
- **实时预览**：右侧面板即时显示合同效果
- **混箱管理**：支持多产品共享箱数（单元格合并）
- **条款模板**：预设多套条款模板（通用/硅胶/纺织/PP文具），可编辑
- **合同管理**：按 CY 号保存/恢复/搜索合同
- **电子公章**：上传并保存公章图片，自动嵌入合同
- **中文大写金额**：自动将数字金额转换为中文大写
- **一键打印**：所有列自动缩放到 A4 一页宽

## 快速开始

### 环境要求

- Python 3.8+
- PDF 导出需要 [GTK3 Runtime](https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases)（仅 Windows，Excel 导出无需）

### 安装

```bash
# 克隆项目
git clone https://github.com/YOUR_USERNAME/contract-generator.git
cd contract-generator

# 创建虚拟环境
python -m venv .venv

# 激活（Windows）
.venv\Scripts\activate

# 激活（Mac/Linux）
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动
python app.py

# 浏览器打开 http://127.0.0.1:5000
```

### 初始化数据

首次启动会自动创建 SQLite 数据库并填充示例数据（贸易公司、工厂、客户、条款模板）。请在管理面板中替换为你的实际信息。

## 使用流程

1. 在管理面板中添加你的工厂、公司和客户信息
2. 填写合同编号（CY-xxxx）和基本信息
3. 添加产品行，填写品名、数量、单价
4. 选择条款模板或编辑条款
5. 上传电子公章（可选）
6. 点击生成 Excel 或 PDF

## 项目结构

```
├── app.py                # Flask 后端
├── database.py           # SQLite 数据库
├── generator_pi.py       # 客户合同 Excel 生成
├── generator_factory.py  # 工厂合同 Excel 生成
├── generator_pdf.py      # PDF 生成（weasyprint）
├── static/
│   ├── css/style.css
│   └── js/app.js         # 前端逻辑
├── templates/
│   ├── index.html        # 主页面
│   ├── pi_template.html  # 客户合同模板
│   └── factory_template.html  # 工厂合同模板
└── uploads/              # 上传文件目录
```

## 技术栈

- **后端**：Python / Flask / openpyxl / weasyprint
- **前端**：HTML / CSS / JavaScript（原生，无框架）
- **数据库**：SQLite
- **依赖**：flask, openpyxl, weasyprint

## License

MIT
