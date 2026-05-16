# 合同生成器 / Contract Generator

中日贸易合同生成工具。一次填入产品数据，自动生成 **客户合同(PI)** 和 **工厂合同** 两种格式（Excel + PDF）。

适用于外贸公司/SOHO 从中国工厂采购、向日本客户出口的业务场景。

## 功能一览

| 功能 | 说明 |
|------|------|
| **客户合同 PI** | 英文 Proforma Invoice，FOB 报价格式，可上传电子公章 |
| **工厂合同** | 中文成品定做合同，含 12 条标准条款，条款可编辑 |
| **双格式导出** | 同时生成 Excel 和 PDF |
| **实时预览** | 右侧面板即时预览合同内容 |
| **混箱管理** | 多产品共享箱数，自动合并单元格 |
| **条款模板** | 预设通用/硅胶/纺织/PP文具等多套模板，支持增删改 |
| **合同管理** | 按 CY 号保存/恢复/搜索/另存，支持草稿暂存 |
| **电子公章** | 上传并保存公章图片，管理多枚印章，下拉选择 |
| **中文大写金额** | 自动将数字金额转换为中文大写（如 46970 → 肆万陆仟玖佰柒拾元整） |
| **自动打印** | 所有列缩放到 A4 一页宽，适合直接打印 |
| **合同编号预填** | CY- 前缀自动补全，只需输入编号 |
| **拖拽排序** | 产品行拖拽重新排序 |
| **图片支持** | 每个产品可上传多张图片，自动嵌入合同 |

## 快速开始

### 环境要求

- Python 3.8+
- **PDF 导出**需要额外系统库：
  - Windows: [GTK3 Runtime](https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases)
  - Linux (CentOS): `yum install -y pango cairo gdk-pixbuf2`
  - macOS: 通常自带

### 安装

```bash
# 克隆
git clone https://github.com/Hermannmayer/contract-generator.git
cd contract-generator

# 创建虚拟环境
python -m venv .venv

# 激活
# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate

# 安装依赖
pip install flask openpyxl

# 如需 PDF 导出
pip install weasyprint

# 启动
python app.py

# 浏览器打开
open http://127.0.0.1:5000
```

### 初始化数据

首次启动自动创建 SQLite 数据库，填充示例数据。请在页面左侧「管理」面板中替换为你的实际信息。

## 使用流程

```
管理面板添加工厂/公司/客户
       ↓
填写合同编号 CY-xxxx
       ↓
添加产品行 → 填写品名/货号/数量/单价
       ↓
选择条款模板或编辑条款
       ↓
上传电子公章（可选）
       ↓
点击生成 → Excel / PDF
```

## 部署到服务器（CentOS + systemd）

```bash
# 安装 Python
yum install -y python3 python3-pip python3-devel

# 创建虚拟环境
python3 -m venv .venv
source .venv/bin/activate
pip install flask openpyxl

# 创建 systemd 服务
cat > /etc/systemd/system/contract-generator.service << 'EOF'
[Unit]
Description=Contract Generator
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/contract-generator
Environment=PATH=/opt/contract-generator/.venv/bin:/usr/bin
ExecStart=/opt/contract-generator/.venv/bin/python /opt/contract-generator/app.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable contract-generator   # 开机自启
systemctl start contract-generator    # 启动

# PDF 依赖（可选）
yum install -y pango cairo gdk-pixbuf2
pip install weasyprint
```

## 项目结构

```
├── app.py                 # Flask 主程序
├── database.py            # SQLite 数据库 + ORM
├── generator_pi.py        # 客户合同 PI Excel 生成
├── generator_factory.py   # 工厂合同 Excel 生成
├── generator_pdf.py       # PDF 生成（HTML → PDF）
├── requirements.txt
├── static/
│   ├── css/style.css
│   └── js/app.js          # 前端逻辑（原生 JS，无框架）
├── templates/
│   ├── index.html          # 主页面
│   ├── pi_template.html    # 客户合同 PDF 模板
│   └── factory_template.html  # 工厂合同 PDF 模板
└── uploads/               # 上传图片目录
```

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Python 3 / Flask |
| 前端 | HTML / CSS / JavaScript（零依赖） |
| 数据库 | SQLite |
| Excel 生成 | openpyxl |
| PDF 生成 | weasyprint |
| 部署 | systemd + Nginx 反向代理 |

## License

MIT
