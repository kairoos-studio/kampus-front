// Confere os prints entregues em docs/antes/:
//  - cada PNG descodifica, tem pelo menos as dimensões do ecrã (desktop 1440x900, mobile 780x1688
//    a escala 2; o print de página inteira fica mais largo quando o layout transborda) e não é vazio;
//  - se for indicada uma pasta de referência (prints acabados de gerar com a mesma SEED_DATE /
//    PRINTS_DATE), compara pixel a pixel e falha acima de 0,5 % de píxeis diferentes.
// Uso: node scripts/conferir-prints.mjs [pasta-gerada]
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const here = path.dirname(fileURLToPath(import.meta.url));
const ENTREGUES = path.resolve(here, "..", "..", "docs", "antes");
const GERADOS = process.argv[2] ? path.resolve(process.argv[2]) : null;
const PAGINAS = 13;
const LARGURA = { desktop: 1440, mobile: 780 };
const ALTURA_MIN = { desktop: 900, mobile: 1688 };
const LIMITE = 0.005;

const erros = [];
const ler = (file) => PNG.sync.read(readFileSync(file));
const ficheiros = readdirSync(ENTREGUES).filter((f) => f.endsWith(".png")).sort();

if (ficheiros.length !== PAGINAS * 2) erros.push(`esperados ${PAGINAS * 2} prints, há ${ficheiros.length}`);

let diffDir;
for (const nome of ficheiros) {
  const tamanho = /-(desktop|mobile)\.png$/.exec(nome)?.[1];
  if (!tamanho) {
    erros.push(`${nome}: nome não acaba em -desktop.png ou -mobile.png`);
    continue;
  }
  let img;
  try {
    img = ler(path.join(ENTREGUES, nome));
  } catch (err) {
    erros.push(`${nome}: não é um PNG válido (${err.message})`);
    continue;
  }
  if (img.width < LARGURA[tamanho]) erros.push(`${nome}: largura ${img.width} < ${LARGURA[tamanho]}`);
  if (img.height < ALTURA_MIN[tamanho]) erros.push(`${nome}: altura ${img.height} < ${ALTURA_MIN[tamanho]}`);

  // Imagem "vazia": quase só uma cor. Conta cores distintas numa amostra.
  const cores = new Set();
  for (let i = 0; i < img.data.length; i += 4 * 97) cores.add(img.data.readUInt32BE(i));
  if (cores.size < 16) erros.push(`${nome}: só ${cores.size} cores, parece vazia`);

  if (GERADOS) {
    let ref;
    try {
      ref = ler(path.join(GERADOS, nome));
    } catch (err) {
      erros.push(`${nome}: falta ou é inválido na pasta gerada (${err.message})`);
      continue;
    }
    if (ref.width !== img.width || ref.height !== img.height) {
      erros.push(`${nome}: ${img.width}x${img.height} entregue vs ${ref.width}x${ref.height} gerado`);
      continue;
    }
    const diff = new PNG({ width: img.width, height: img.height });
    const n = pixelmatch(img.data, ref.data, diff.data, img.width, img.height, { threshold: 0.1 });
    const fracao = n / (img.width * img.height);
    if (fracao > LIMITE) {
      diffDir ??= mkdtempSync(path.join(tmpdir(), "prints-diff-"));
      writeFileSync(path.join(diffDir, nome), PNG.sync.write(diff));
      erros.push(`${nome}: ${(fracao * 100).toFixed(2)} % de píxeis diferentes (diff em ${diffDir})`);
    }
  }
}

if (erros.length) {
  console.error("Prints com problemas:\n- " + erros.join("\n- "));
  process.exit(1);
}
console.log(`${ficheiros.length} prints válidos${GERADOS ? " e iguais aos gerados" : ""}`);
