"""Importa apenas km/l de combustão e híbridos sem recarga externa.

Uso: python3 scripts/import-pbev.py caminho.pdf
Dependência de manutenção: pdfplumber. Nenhuma dependência Python no app.
As coordenadas são específicas da edição do PDF indicada nos metadados.
"""
import collections
import hashlib
import json
from pathlib import Path
import sys
import pdfplumber

SOURCE = "https://www.gov.br/inmetro/pt-br/assuntos/regulamentacao/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/veiculos-automotivos-pbe-veicular/mascara-pbev-2026_19_jan-rev01.pdf/@@download/file"
COLUMNS = [164.42, 205.22, 231.65, 267.29, 298.25, 311.69, 327.55,
           345.29, 355.01, 371.81, 388.75, 405.55, 418.27, 428.23,
           438.91, 449.47, 460.03, 470.47, 472.03, 481.15, 491.83,
           506.47, 515.59, 525.91, 540.60, 550.63, 560.71, 571.15,
           581.59, 600.07, 619.03, 638.71, 657.07, 676.48]
BRANDS = {"VW": "Volkswagen", "FIAT": "Fiat", "CHEVROLET": "Chevrolet",
          "RENAULT": "Renault", "TOYOTA": "Toyota", "HONDA": "Honda",
          "PEUGEOT": "Peugeot", "CITROEN": "Citroën", "CITROËN": "Citroën",
          "FORD": "Ford", "NISSAN": "Nissan", "JEEP": "Jeep",
          "MITSUBISHI": "Mitsubishi", "KIA": "Kia", "VOLVO": "Volvo",
          "AUDI": "Audi", "LAND ROVER": "Land Rover", "PORSCHE": "Porsche",
          "MERCEDES-BENZ": "Mercedes-Benz", "SUZUKI": "Suzuki",
          "CAOACHANGAN": "CAOA Changan", "CAOA CHANGAN": "CAOA Changan",
          "CAOA CHERY": "CAOA Chery", "HYUNDAI": "Hyundai", "FERRARI": "Ferrari",
          "FOTON": "Foton", "LEXUS": "Lexus", "MCLAREN": "McLaren", "RAM": "Ram"}

def number(text):
    try:
        value = float(text.replace(",", "."))
        return value if 0 < value < 60 else None
    except ValueError:
        return None

path = Path(sys.argv[1])
vehicles, seen, skipped = [], set(), collections.Counter()
with pdfplumber.open(path) as pdf:
    for page_number, page in enumerate(pdf.pages, 1):
        words = page.extract_words(x_tolerance=.3, y_tolerance=.2)
        anchors = [w for w in words
                   if w["text"] in ("Combustão", "Híbrido", "Elétrico", "Plug-in")
                   and COLUMNS[5] < (w["x0"] + w["x1"]) / 2 < COLUMNS[6]]
        for anchor in anchors:
            line = sorted([w for w in words if abs(w["top"] - anchor["top"]) < .4],
                          key=lambda w: w["x0"])
            row = [" ".join(w["text"] for w in line
                             if COLUMNS[i] < (w["x0"] + w["x1"]) / 2 < COLUMNS[i + 1])
                   for i in range(33)]
            if row[9] not in ("F", "G", "D", "E", "E100"):
                continue  # Cabeçalhos.
            if row[5] not in ("Combustão", "Híbrido"):
                skipped[row[5]] += 1
                continue
            fuels = {}
            if row[9] in ("F", "E", "E100"):
                city, highway = number(row[18]), number(row[19])
                if city and highway:
                    fuels["ethanol"] = {"city": city, "highway": highway}
            if row[9] in ("F", "G", "D"):
                city, highway = number(row[21]), number(row[22])
                if city and highway:
                    fuels["diesel" if row[9] == "D" else "gasoline"] = {"city": city, "highway": highway}
            if not fuels:
                skipped["sem consumo em km/l nas colunas esperadas"] += 1
                continue
            if not all(row[i] for i in (1, 2, 6)):
                raise ValueError(f"Identificação ausente: {row[:10]}")
            identity = "|".join(row[1:7]) + "|" + row[9]
            if identity in seen:
                skipped["duplicate"] += 1
                continue
            seen.add(identity)
            vehicles.append({
                "id": hashlib.sha256(identity.encode()).hexdigest()[:12],
                "brand": BRANDS.get(row[1].upper(), row[1]), "model": row[2],
                "version": row[3] or "Padrão", "engine": row[4] or "Motor não informado", "transmission": row[6],
                "propulsion": row[5], "fuels": fuels, "sourcePage": page_number
            })

vehicles.sort(key=lambda v: (v["brand"].upper(), v["model"], v["version"], v["engine"]))
if len(vehicles) < 500:
    raise ValueError("Importação incompleta: revise a estrutura da edição do PDF.")
metadata = {"name": "PBE Veicular / Inmetro", "cycle": 2026,
            "documentUpdated": "2026-08-14", "retrieved": "2026-10-11",
            "url": SOURCE, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "vehicleCount": len(vehicles), "brandCount": len({v["brand"] for v in vehicles}),
            "coverage": "Combustão e híbridos sem recarga externa, com consumo em km/l. Ciclo da tabela não é ano-modelo.",
            "excluded": dict(skipped)}
output = Path("src/vehicles.js")
output.parent.mkdir(exist_ok=True)
output.write_text("// Gerado por scripts/import-pbev.py. Não editar manualmente.\n"
                  + "export const metadata = " + json.dumps(metadata, ensure_ascii=False, indent=2) + ";\n"
                  + "export const vehicles = " + json.dumps(vehicles, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(json.dumps(metadata, ensure_ascii=False, indent=2))
