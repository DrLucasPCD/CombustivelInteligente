# Combustível Inteligente

App web responsivo e instalável (PWA) para estimar gastos de combustível pelo veículo e pelo trajeto, com histórico de revisões por carro. Português do Brasil, valores em reais e quilômetros. Não precisa de conta, chave de API ou backend.

## Usar

1. Selecione marca, modelo e versão, ou informe manualmente o consumo do seu carro.
2. Informe os quilômetros de ida por dia e marque a volta para informar também os quilômetros de retorno. Ida e volta podem ter distâncias diferentes.
3. Escolha cidade, estrada ou misto. No misto, ajuste a porcentagem da distância percorrida na cidade.
4. Escolha o combustível e informe o preço do seu posto. Os preços iniciais são **exemplos**, não preços atuais de mercado.
5. Informe de 1 a 31 dias de uso por mês e veja o consumo em km/l, quilômetros diários e mensais, litros por mês e gasto mensal em reais. O total diário soma ida e volta; os totais do mês multiplicam esse trajeto pela quantidade de dias informada. Também mostra custo por km e divisão por pessoas.

Para veículos flex, compara gasolina e etanol com base no consumo específico da versão. A última seleção fica salva somente no navegador. Use “Restaurar exemplo” para voltar aos valores iniciais.

## Registrar revisões

Abra **Revisões** no menu. Cadastre o carro com um nome e a quilometragem atual; a seleção da calculadora sugere o nome. Cada cadastro representa um carro físico, permitindo manter históricos separados mesmo para carros do mesmo modelo.

Em **Registrar revisão**, informe data, quilometragem, serviços realizados e custo (inclusive zero). Oficina e observações são opcionais. Você pode editar ou excluir registros. Excluir um carro também exclui suas revisões, após confirmação no app.

Marque os itens que foram executados no checklist. O botão **Marcar óleo, filtros e inspeção de freios** seleciona os cinco itens de óleo/filtros e a inspeção de freios. Cada item acompanha a última execução marcada, independentemente dos demais serviços. Registros antigos são preservados, mas precisam ser editados para associar os itens; o app não deduz trocas a partir do texto livre nem inventa datas de última execução.

### Plano informado pelo usuário

Estes são parâmetros personalizados fornecidos na conversa, não uma tabela universal ou verificação de plano oficial de fabricante. Confirme no manual da versão. **Ajustar intervalos** permite modificar quilômetros e meses por carro, com calendário real e ajuste do último dia do mês.

| Item | Intervalo do plano |
| --- | --- |
| Óleo, filtro de combustível, filtro de óleo, filtro de cabine e filtro de ar do motor | 10.000 km ou 6 meses, para cada item |
| Velas de ignição | 40.000 km ou 4 anos |
| Correia dentada e tensor, uso normal | 120.000 km ou 5 anos |
| Correia dentada e tensor, uso severo | 60.000 km ou 3 anos |
| Líquido de arrefecimento | 60.000 km como parâmetro editável; a nota registra a faixa informada de 40.000–60.000 km, checagem em toda revisão e antecipação conforme condição |
| Inspeção de pastilhas e discos | 10.000 km ou 6 meses; verificar em toda revisão |
| Troca de pastilhas e discos | Conforme desgaste e avaliação; sem data/quilometragem obrigatória de substituição |

Marque **Uso severo** no cadastro para aplicar o parâmetro informado para Uber, táxi ou trânsito urbano pesado. Ajustes manuais no intervalo da correia têm prioridade sobre essa opção. As faixas informadas de desgaste de pastilhas (20.000–30.000 km) e discos (50.000–60.000 km / cerca de duas trocas de pastilhas) aparecem apenas como notas, sem gerar prazos de troca. Cada aviso por item depende da última execução associada e usa o que ocorrer primeiro: tempo ou quilometragem. Datas desconhecidas aparecem como **Registrar última execução**.

Opcionalmente, informe uma previsão geral de data ou quilometragem da próxima revisão conforme o prazo que você deseja acompanhar. Se informar as duas, vale a primeira a ser atingida. A previsão geral usa o registro mais recente por data (e quilometragem no desempate); quando não há previsão geral, o painel resume os prazos calculados por item. Os prazos individuais usam suas próprias últimas execuções. O aviso de proximidade aparece a partir de 30 dias ou 1.000 km do prazo informado. Esses limites são avisos do app, não intervalos recomendados pelo fabricante. Atualize a quilometragem em **Editar carro e quilometragem**. Os avisos aparecem no painel ao abrir o app; não são notificações em segundo plano.

O histórico é salvo em `localStorage` neste navegador e funciona offline. Não há sincronização entre aparelhos, contas ou cópia em servidor. Limpar os dados do site pode apagar os registros. Use **Exportar backup** para baixar um JSON e **Importar backup** para restaurá-lo em outro aparelho. A importação adiciona carros e revisões ausentes, preserva os nomes, planos e registros existentes com o mesmo identificador e mantém a maior quilometragem disponível. Importar o mesmo arquivo novamente não duplica registros. Backups inválidos e falhas de armazenamento não substituem o histórico salvo. A versão 2 do formato preserva planos, uso severo e itens executados, e aceita backups da versão 1. Abas antigas não conseguem sobrescrever o formato novo; atualize o app antes de editar.

## Executar localmente

Requisito: Node.js 20 ou superior. Sem dependências npm.

```sh
npm start
```

Abra `http://localhost:4173`. Não abra o HTML diretamente por `file://`: módulos JavaScript e service worker precisam de servidor HTTP. Para outro número de porta, use `PORT=8080 npm start`.

```sh
npm test
npm run build
node scripts/serve.mjs --dist
```

O build gera arquivos estáticos em `dist/`, compatíveis com GitHub Pages e qualquer hospedagem estática. Todos os caminhos são relativos, permitindo servir o projeto em `/CombustivelInteligente/`.

### Verificação no navegador

O teste opcional `npm run test:browser` requer Playwright e Google Chrome instalados, além do servidor local em execução. Verifica as 647 versões, entrada manual, ida e volta, divisão, projeção mensal, campos inválidos, preferências, cópia, quatro larguras de tela e cálculo offline. Também verifica carros, revisões, edição/exclusão, prazos individuais, uso severo, ajustes de intervalos, checklist, ida/volta diferentes, litros mensais, backups, falhas de armazenamento, conflitos entre abas e gravação offline. Defina `BROWSER_TEST_PLAYWRIGHT_MODULE` com o caminho de um módulo Playwright já instalado e `BROWSER_TEST_URL` para testar outra URL. Playwright é usado apenas na verificação e não é necessário para executar o app.

## App e uso offline

O manifesto e o service worker permitem instalar o app em navegadores compatíveis, por HTTPS ou localhost. O botão “Instalar app” oferece a instalação nativa quando disponível e instruções nos demais navegadores. No iPhone, abra no Safari e escolha Compartilhar → Adicionar à Tela de Início.

Após o primeiro carregamento online completo, a calculadora e a base de veículos ficam disponíveis offline. Nenhum dado digitado é enviado a um servidor. Para atualizar os arquivos de uma publicação futura, incremente a versão de cache em `sw.js`. O funcionamento offline depende de o navegador manter o armazenamento do site.

## Dados dos veículos

**647 versões de 31 marcas**, importadas da [tabela oficial PBE Veicular 2026 do Inmetro](https://www.gov.br/inmetro/pt-br/assuntos/regulamentacao/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/veiculos-automotivos-pbe-veicular/mascara-pbev-2026_19_jan-rev01.pdf/@@download/file), consultada em 11/10/2026. Atualização indicada no cabeçalho do documento: 14/08/2026. Consulte a página e o SHA-256 da fonte nos metadados de `src/vehicles.js`.

Marcas incluídas: Audi, BMW, CAOA Changan, CAOA Chery, Chevrolet, Citroën, Ferrari, Fiat, Ford, Foton, GAC, GWM, Honda, Hyundai, JAC, Jeep, Kia, Land Rover, Lexus, McLaren, Mercedes-Benz, MINI, Mitsubishi, Nissan, OMODA, Peugeot, Porsche, Ram, Renault, Toyota e Volkswagen.

O ciclo da tabela **não representa o ano-modelo** de cada carro. Não aplique automaticamente esse consumo a carros de outros anos ou versões. A base é um recorte dos registros com consumo utilizável em km/l; exclui elétricos, híbridos plug-in, linhas sem consumo disponível nas colunas esperadas e duplicatas idênticas. Os metadados registram essas exclusões. Os valores em km/l equivalente dos elétricos não são tratados como litros de combustível.

O consumo real varia com trânsito, manutenção, carga, condução e ar-condicionado. Os resultados estimam apenas combustível, sem pedágios, estacionamento ou demais despesas. Para carros antigos, motos, veículos fora da base e consumo medido pelo usuário, use o modo manual.

### Atualizar a base

Baixe a fonte indicada nos metadados. O importador de manutenção requer Python e `pdfplumber`:

```sh
python3 scripts/import-pbev.py caminho/para/pbev-2026.pdf
npm test
```

As coordenadas do importador são específicas desta edição do PDF. Antes de importar outra edição, revise colunas, cabeçalho, data, URL, testes de referência e cobertura. Revise também este README e o texto da fonte no app. O app não consulta uma API externa em tempo real.

## Cálculos

- Distância diária: quilômetros de ida + quilômetros de volta quando “Incluir a volta” está marcado.
- Litros: distância na cidade ÷ km/l na cidade + distância na estrada ÷ km/l na estrada.
- Consumo misto: distância total ÷ litros. Usa média harmônica ponderada pela distância.
- Custo: litros × preço por litro.
- Por pessoa: custo total ÷ número de pessoas.
- Quilômetros mensais: quilômetros diários × dias de uso no mês.
- Litros mensais: litros diários × dias de uso no mês.
- Gasto por mês: custo diário × dias de uso no mês.
- Comparação flex: preço ÷ km/l para cada combustível. O ponto de equilíbrio do etanol varia com o carro e o trajeto.

## Publicação no GitHub Pages

O workflow `.github/workflows/pages.yml` executa os testes, gera `dist/` e publica commits de `main`. Configure **Settings → Pages → Source → GitHub Actions** no repositório. Pull requests executam as verificações sem publicação.

URL prevista: `https://drlucaspcd.github.io/CombustivelInteligente/`.

## Estrutura

`index.html` e `styles.css`: interface. `src/app.js`: calculadora e preferências locais. `src/calculator.js`: cálculo e validação. `src/vehicles.js`: catálogo com origem rastreável. `src/maintenance.js` e `src/maintenance-model.js`: histórico, armazenamento, validação e backups. `scripts/`: servidor, build e importação. `tests/`: cálculos, integridade da base, revisões e verificação no navegador.
