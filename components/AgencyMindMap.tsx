// components/AgencyMindMap.tsx
'use client';
import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  type FC,
  type ReactNode,
} from 'react';
import {
  Search,
  Download,
  Copy,
  Layers,
  CheckCircle2,
  Target,
  DollarSign,
  Cog,
  Zap,
  PieChart,
  Users,
  Handshake,
  Rocket,
  Minimize2,
  Maximize2,
  Info,
  Lock,
  KeyRound,
} from 'lucide-react';

import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { Separator } from './ui/separator';

/** 🔥 Firestore: importe TUDO uma única vez (sem duplicatas) */
import {
  doc,
  onSnapshot,
  setDoc,
  type DocumentReference,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

/* =========================================
   THEME (dark + contraste)
   ========================================= */
const COLOR_BG_PAGE = '#142b2a'; // fundo escuro principal
const COLOR_SURFACE = '#1e403e'; // superfícies (cartas)
const COLOR_TITLE = '#dde6c2'; // títulos (verde claro solicitado)
const COLOR_TEXT = '#e8e8e8'; // texto (branco acinzentado)
const COLOR_ACCENT = '#ff6700'; // destaques (laranja)

/* =========================================
   UTILS
   ========================================= */
// Copiar texto (com fallback se Clipboard API estiver bloqueada)
const copyText = async (text: string) => {
  try {
    if (navigator.clipboard && (window as any).isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    throw new Error('NoClipboardAPI');
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
    }
  }
};

// SHA-256 (hex) para validar os códigos sem expor o texto em claro
async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Flatten (para contar nós, etc.)
const flatten = (items: NodeItem[]): NodeItem[] => {
  const out: NodeItem[] = [];
  const walk = (arr: NodeItem[]) => {
    for (const it of arr) {
      out.push(it);
      if (it.children) walk(it.children);
    }
  };
  walk(items);
  return out;
};

// Monta um texto-resumo da seção (p/ copiar)
const composeSectionText = (item: NodeItem): string => {
  const parts: string[] = [
    `# ${item.title}`,
    item.kpis?.length ? `KPIs:\n- ${item.kpis.join('\n- ')}` : '',
    item.insights?.length ? `Insights:\n- ${item.insights.join('\n- ')}` : '',
    item.examples?.length ? `Exemplos:\n- ${item.examples.join('\n- ')}` : '',
    item.solutions?.length ? `Soluções:\n- ${item.solutions.join('\n- ')}` : '',
  ].filter(Boolean);
  return parts.join('\n\n');
};

/* =========================================
   TYPES
   ========================================= */
type NodeItem = {
  id: string;
  title: string;
  kpis?: string[];
  insights?: string[];
  examples?: string[];
  solutions?: string[];
  children?: NodeItem[];
  tag?: string;
  icon?: string;
  refs?: string[];
};

/* =========================================
   ICON MAP
   ========================================= */
const ICONS: Record<string, ReactNode> = {
  target: <Target size={16} />,
  money: <DollarSign size={16} />,
  os: <Cog size={16} />,
  prod: <Zap size={16} />,
  fin: <PieChart size={16} />,
  people: <Users size={16} />,
  rel: <Handshake size={16} />,
  roadmap: <Layers size={16} />,
  scale: <Rocket size={16} />,
};

/* =========================================
   GLOSSÁRIO + destaque em texto
   ========================================= */
const GLOSSARY: Record<string, string> = {
  // Estratégia & vendas
  ICP: 'Ideal Customer Profile — Perfil ideal de cliente que maximiza lucro e encaixe operacional.',
  ROI: 'Return on Investment — Retorno sobre o investimento.',
  CTA: 'Call To Action — Chamada para ação.',
  QBR: 'Quarterly Business Review — Reunião trimestral focada em resultados e próximos passos.',
  'Good/Better/Best':
    'Estrutura de propostas com 3 níveis de escopo/valor para facilitar a decisão.',

  // Operação
  SOP: 'Standard Operating Procedure — Procedimento Operacional Padrão.',
  DoD: 'Definition of Done — Critérios que definem conclusão de uma etapa ou entregável.',
  QA: 'Quality Assurance — Garantia da qualidade (checagens antes de enviar).',
  WIP: 'Work In Progress — Trabalho em andamento (itens simultâneos).',
  FTE: 'Full-Time Equivalent — Capacidade equivalente a uma pessoa em tempo integral.',

  // Finanças
  AGI: 'Adjusted Gross Income — Receita bruta ajustada (receita menos custos diretos de terceiros).',
  ABR: 'Average Billable Rate — Receita por hora faturável.',
  'P&L':
    'Profit and Loss — Demonstrativo de resultados (receita, custos, despesas, lucro).',
  DSO: 'Days Sales Outstanding — Dias em aberto até receber.',
  NRR: 'Net Revenue Retention — Retenção líquida de receita.',
  KPI: 'Key Performance Indicator — Indicador-chave de desempenho.',

  // Pessoas & cultura
  RACI: 'Responsible/Accountable/Consulted/Informed — Matriz de papéis e responsabilidades.',
  eNPS: 'Employee Net Promoter Score — Satisfação do time.',
  NPS: 'Net Promoter Score — Satisfação do cliente.',

  // Jurídico/Vendors
  MSA: 'Master Service Agreement — Contrato-mãe de serviços.',
  NDA: 'Non-Disclosure Agreement — Acordo de confidencialidade.',
  SoW: 'Statement of Work — Anexo de escopo e entregáveis.',
  'First Article':
    'Primeira peça de teste para validar padrão de um fornecedor.',
  Tier: 'Nível/categoria de fornecedor (ex.: Bronze/Prata/Ouro).',

  // Projetos
  Kickoff:
    'Reunião inicial para alinhar objetivos, escopo, riscos e calendário.',
  Briefing:
    'Documento com contexto, objetivos, restrições, público e métricas.',
  Wireframe: 'Esboço estrutural de página/tela antes do design final.',
  Upsell:
    'Oferta complementar ou expansão do contrato (cross-sell/upsell de serviços).',
  KV: 'Key Visual — peça/visual chave que puxa a identidade da campanha ou evento.',
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TERMS_REGEX = new RegExp(
  `\\b(${Object.keys(GLOSSARY)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|')})\\b`,
  'gi'
);

const GlossaryTerm: FC<{ term: string }> = ({ term }) => {
  const def = GLOSSARY[term.toUpperCase()] || GLOSSARY[term];
  if (!def) return <>{term}</>;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="underline decoration-dotted cursor-help"
            style={{ color: COLOR_TITLE }}
          >
            {term}
          </span>
        </TooltipTrigger>
        {/* Tooltip ESCURO para boa leitura no tema dark */}
        <TooltipContent
          side="top"
          className="rounded-md"
          style={{
            background: COLOR_BG_PAGE,
            border: `1px solid ${COLOR_TITLE}33`,
            color: COLOR_TEXT,
            maxWidth: 420,
          }}
        >
          <div className="text-xs">
            <div className="font-semibold mb-1" style={{ color: COLOR_TITLE }}>
              {term}
            </div>
            <div>{def}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

function renderWithGlossary(text?: string): ReactNode {
  if (!text) return null;
  const parts: ReactNode[] = [];
  let last = 0;
  text.replace(TERMS_REGEX, (match, _g, offset: number) => {
    if (last < offset) parts.push(text.slice(last, offset));
    parts.push(<GlossaryTerm key={`${match}-${offset}`} term={match} />);
    last = offset + match.length;
    return match;
  });
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/* =========================================
   DADOS (todo o conteúdo que já construímos)
   ========================================= */
//  ⚠️  >>>>>>>  MANTIVE 100% DOS BLOCOS QUE JÁ CRIAMOS  <<<<<<< ⚠️
//  Para caber aqui, mantive exatamente o mesmo DATA da sua última versão.

const DATA: NodeItem[] = [
  // --- Direção Estratégica ---
  {
    id: '1',
    title: 'Direção Estratégica (Posicionamento & Oferta)',
    tag: 'MÊS 1',
    icon: 'target',
    refs: [
      "April Dunford — 'Obviously Awesome': posicionamento orientado a contexto (segmentos-alvo, categoria, alternativas, atributos, prova).",
      "Byron Sharp — 'How Brands Grow': disponibilidade mental/física, alcance e consistência de ativos distintivos.",
      "David C. Baker — 'The Business of Expertise': especialização, 'não fazemos' e proteção de margem.",
    ],
    kpis: [
      'Win rate por ICP (%)',
      'Tempo para validar mensagem (dias)',
      'CAC payback (meses)',
      '% de leads fora do fit (baixa)',
      "% de propostas com 'Não Fazemos' aplicado",
    ],
    insights: [
      "Siga April Dunford: posicionamento é sobre contexto — deixe claro 'para quem', 'contra o quê' e 'por que agora'.",
      "Evite escopo elástico: um 'Não Fazemos' forte protege margem e foco (David C. Baker).",
      'Mensagem testável: headline + prova + CTA com prazo. Teste A/B em 30–45 dias.',
      'Disponibilidade mental e física (Byron Sharp): simplifique a escolha e reduza atrito de compra.',
    ],
    examples: [
      'ICP: Produtores e marcas com ativações > R$ 50k e prazos curtos; decisor: Head de Marketing/Trade.',
      'Posicionamento: Agência ágil para eventos presenciais — discovery estratégico separado da execução.',
      "Mensagens: 'Entrega em 72h com QA de evento' vs 'Criação rápida' (teste o específico).",
    ],
    solutions: [
      "Workshop 2h (liderança + vendas): tese, 3 provas, lista de 'Não Fazemos'.",
      'Deck: 3 cases com antes/depois, limitações de escopo e prazos padrão.',
      'Landing de qualificação (3 perguntas): deadline, orçamento, decisor. Integre ao CRM.',
    ],
    children: [
      {
        id: '1.1',
        title: 'ICP — Ideal Customer Profile',
        kpis: ['Win rate por ICP', 'Ticket médio por ICP'],
        insights: ['Pontuar Receita/Deadline/Repetição/Risco em 1–5.'],
        solutions: [
          "Planilha de scoring com cut-off; 'lista cinza' para leads duvidosos.",
        ],
      },
      {
        id: '1.2',
        title: 'Oferta & Não Fazemos',
        insights: ['Empacote discovery (pago) e execução (escopo fechado).'],
        solutions: [
          'Tabelas por complexidade/velocidade; 2 revisões no pacote.',
        ],
      },
      {
        id: '1.3',
        title: 'Mensagem Testável',
        insights: ['Prova concreta > adjetivo (Ogilvy).'],
        solutions: [
          'Teste 2 headlines/CTA por 2 semanas; manter vencedora ≥ 90 dias.',
        ],
      },
    ],
  },
  // --- Modelo Comercial ---
  {
    id: '2',
    title: 'Modelo Comercial & Receita',
    tag: 'MÊS 1',
    icon: 'money',
    refs: [
      "Chris Voss — 'Never Split the Difference': ancoragem, espelhamento e concessões inteligentes.",
      "Mark Ritson — 'Mini MBA' e colunas: 3 escolhas estratégicas (segmentação, posicionamento, execução disciplinada).",
    ],
    kpis: [
      'Cobertura de pipeline (≥3x meta)',
      'Tempo de ciclo (dias)',
      'Taxa de ganho por etapa (%)',
      'Desconto médio (%)',
      'ARPA (ticket médio) e mix fixo/variável',
    ],
    insights: [
      'Separar pensar (estratégia) de fazer (execução) aumenta taxa de fechamento e reduz retrabalho.',
      'Outbound disciplinado + inbound qualificado — use SLAs por etapa e alerte estagnação.',
      'Negociação: ancore valor e troque concessões (Chris Voss/Mark Ritson).',
    ],
    examples: [
      'Sequência: D+0 diagnóstico; D+2 proposta; D+5 follow-up prova; D+10 alternativa Good/Better/Best.',
      'Proposta com 3 opções: Good (escopo base), Better (+QA expresso), Best (+plantão evento).',
    ],
    solutions: [
      'CRM com estágios: Qualificar → Diagnóstico → Proposta → Negociação → Fechado; SLAs claros.',
      'Modelo de proposta com impacto, hipótese de ROI, prazos e limites de revisão (2 rodadas).',
    ],
    children: [
      {
        id: '2.1',
        title: 'Qualificação (Fit & Urgência)',
        insights: [
          'Pergunte objetivo, deadline, orçamento e decisor. Desqualifique cedo.',
        ],
        solutions: [
          "Form de 6 perguntas; leads fora do fit entram na 'lista cinza'.",
        ],
      },
      {
        id: '2.2',
        title: 'Proposta Value-Based',
        insights: ['Contextualize preço com valor entregue e risco evitado.'],
        solutions: [
          'Discovery pago separado; cronograma e limites de revisão explícitos.',
        ],
      },
      {
        id: '2.3',
        title: 'Pipeline & SLAs',
        insights: ['Tempo máx. por etapa (ex.: 5 dias em Proposta).'],
        solutions: [
          'Alertas automáticos para deal estagnado; revisão semanal de forecast.',
        ],
      },
    ],
  },
  // --- Agency OS ---
  {
    id: '3',
    title: 'Agency OS (SOPs Essenciais)',
    tag: 'MÊS 2',
    icon: 'os',
    refs: [
      "Atul Gawande — 'The Checklist Manifesto': checklists simples reduzem erros, definem pontos críticos e ritmo de equipe.",
    ],
    kpis: [
      '% de jobs com checklist completo',
      'Lead time por fase (dias)',
      'Taxa de retrabalho (%)',
      '% de SOPs atualizados mês a mês',
    ],
    insights: [
      'Checklists salvam tempo e evitam erros (Atul Gawande).',
      'Portas entre fases (Definition of Done) reduzem retrabalho e conflito.',
    ],
    solutions: [
      'SOPs mínimos viáveis: Prospecção, Kickoff, Briefing, Aprovação, Change Request, Fechamento/NPS.',
      'Padrão de nomes: CLIENTE_PROJETO_PEÇA_V01.ext; controle de versão simples.',
    ],
    children: [
      {
        id: '3.1',
        title: 'Kickoff',
        insights: ['Acordo de sucesso, riscos, papeis e calendário.'],
        solutions: ['Checklist 12 itens + agenda 45min + mural de riscos.'],
      },
      {
        id: '3.2',
        title: 'Briefing',
        insights: ['Contexto, público, restrições, assets, métricas.'],
        solutions: ["Perguntas fechadas + campo 'assumimos/evitamos'."],
      },
      {
        id: '3.3',
        title: 'Aprovação',
        insights: ['2 rodadas padrão; extra faturado.'],
        solutions: ['Matriz de aprovação por peça + prazos de resposta.'],
      },
      {
        id: '3.4',
        title: 'Change Request',
        insights: ['Mudanças após X geram novo escopo.'],
        solutions: ['Form com impacto em prazo/custo e aceite formal.'],
      },
      {
        id: '3.5',
        title: 'Fechamento & NPS',
        insights: ['Aprender e abrir próxima oportunidade.'],
        solutions: ['Pós-mortem 30min; survey NPS; play de upsell.'],
      },
    ],
  },
  // --- Produção & Capacidade ---
  {
    id: '4',
    title: 'Produção & Capacidade',
    tag: 'MÊS 2',
    icon: 'prod',
    refs: [
      "Eliyahu Goldratt — 'The Goal': Teoria das Restrições (foco no gargalo, reduzir WIP, aumentar throughput).",
    ],
    kpis: [
      'Utilização por skill (%)',
      'Throughput semanal (entregas)',
      'WIP médio',
      '% de on-time delivery',
      'Defeitos escapados por job',
    ],
    insights: [
      'Gerencie WIP e gargalos (Teoria das Restrições – Goldratt).',
      'Buffers protegem prazos em semanas de pico; QA antes do envio reduz retrabalho.',
    ],
    examples: [
      '1 designer 40h/sem × 70% utilizável = 28h úteis; 3 designers = 84h/sem.',
      'Política: máx. 2 peças complexas por pessoa simultaneamente.',
    ],
    solutions: [
      'Kanban por job + calendário; tempo real via Toggl/Harvest; stand-up diário 15min.',
      'Checklist de QA por tipo de peça (cores, fontes, specs, ortografia, direitos).',
    ],
    children: [
      {
        id: '4.1',
        title: 'Capacidade (FTE)',
        insights: ['Horas úteis = horas semanais × utilização.'],
        solutions: ['Planilha por skill com buffers de 20–30% para picos.'],
      },
      {
        id: '4.2',
        title: 'Alocação & Tráfego',
        insights: ['PM prioriza e libera gargalos.'],
        solutions: [
          "Quadro 'próximas 72h'; regra 'pare de começar, comece a terminar'.",
        ],
      },
      {
        id: '4.3',
        title: 'QA — Quality Assurance',
        insights: ['Primeira impressão decide aprovação.'],
        solutions: [
          'Preflight e dupla checagem; checklist de evento (mapa, prazos, credenciais).',
        ],
      },
    ],
  },
  // --- Financeiro ---
  {
    id: '5',
    title: 'Financeiro & Margem',
    tag: 'MÊS 3',
    icon: 'fin',
    refs: [
      'David C. Baker — margens e métricas para agências: foco em AGI%, ABR e disciplina de escopo.',
    ],
    kpis: [
      'AGI% (margem de contribuição)',
      'ABR (R$/h faturável)',
      'Margem por job (%)',
      'DSO (dias a receber)',
      'Acurácia de forecast (±%)',
    ],
    insights: [
      'Agências saudáveis protegem AGI% e ABR (David C. Baker).',
      'Faturamento em marcos (50/30/20) melhora caixa e disciplina de escopo.',
    ],
    examples: [
      'Job R$ 80k com R$ 30k de terceiros → AGI R$ 50k; 200h → ABR R$ 250/h.',
      'Preço de urgência +30% a +100% conforme janela e risco.',
    ],
    solutions: [
      'P&L mensal por cliente/serviço; rate card por complexidade/velocidade.',
      'Política de adiantamento e cobrança ativa D-3/D+3; auditoria de escopo.',
    ],
    children: [
      {
        id: '5.1',
        title: 'AGI — Adjusted Gross Income',
        insights: ['Receita - custos diretos de terceiros.'],
        solutions: ['Dashboard por cliente/serviço com metas.'],
      },
      {
        id: '5.2',
        title: 'ABR — Average Billable Rate',
        insights: ['AGI / horas faturáveis.'],
        solutions: ['Rastrear horas reais e renegociar quando ABR cair.'],
      },
      {
        id: '5.3',
        title: 'Margem por Job',
        insights: ['Margem = AGI - (salários proporcionais + overhead).'],
        solutions: ['Comparar previsto vs. realizado e registrar causas.'],
      },
      {
        id: '5.4',
        title: 'P&L Mensal',
        insights: ['Visibilidade mensal acelera decisões.'],
        solutions: ['Fechamento até D+5 com notas explicativas.'],
      },
    ],
  },
  // --- Pessoas ---
  {
    id: '6',
    title: 'Pessoas & Cultura',
    icon: 'people',
    refs: [
      "Kim Scott — 'Radical Candor': franqueza com cuidado pessoal.",
      "Patty McCord — 'Powerful': cultura de alta responsabilidade e contexto > controle.",
    ],
    kpis: [
      'eNPS trimestral',
      'Turnover voluntário (%)',
      'Tempo até produtividade (dias)',
      'Horas de treinamento/semestre',
    ],
    insights: [
      'Clareza de papéis (RACI) reduz conflito e acelera decisões.',
      'Feedback direto com respeito (Radical Candor – Kim Scott).',
      'Expectativas explícitas e cultura de alta responsabilidade (Patty McCord).',
    ],
    solutions: [
      '1:1 quinzenal com pauta fixa; cerimônias curtas (daily/weekly/mensal).',
      'Trilhas de carreira por skill e plano de capacitação por semestre.',
    ],
    children: [
      {
        id: '6.1',
        title: 'RACI — Responsible/Accountable/Consulted/Informed',
        insights: ['Quem faz, quem decide, quem opina, quem é informado.'],
        solutions: ['Matriz por etapa do fluxo; publique no Notion.'],
      },
      {
        id: '6.2',
        title: 'Rituais',
        insights: ['Ritmos curtos criam cadência e transparência.'],
        solutions: ['Diário 15min; semanal produção + pipeline; mensal P&L.'],
      },
      {
        id: '6.3',
        title: 'eNPS — Employee NPS',
        insights: ['Mede satisfação do time.'],
        solutions: ['Pesquisa trimestral anônima com plano de ação público.'],
      },
    ],
  },
  // --- Clientes ---
  {
    id: '7',
    title: 'Clientes & Relacionamento',
    icon: 'rel',
    refs: [
      'Lincoln Murphy — Customer Success: QBRs orientados a outcomes, não a outputs.',
    ],
    kpis: [
      'NPS por projeto',
      'Retenção (logo/receita)',
      'NRR (receita líquida)',
      'Tempo até primeiro valor (dias)',
    ],
    insights: [
      'QBRs focados em outcomes geram upsell natural (Lincoln Murphy).',
      'Onboarding claro reduz tempo até valor e evita atritos.',
    ],
    solutions: [
      'QBR trimestral com metas, impacto, riscos e próximos passos.',
      'NPS ao final de cada projeto e plano de melhoria contínua.',
    ],
    children: [
      {
        id: '7.1',
        title: 'Onboarding',
        insights: ['Acessos, assets, aprovações e calendário.'],
        solutions: ['Form + pasta padrão + responsáveis por área.'],
      },
      {
        id: '7.2',
        title: 'Relatórios de Impacto',
        insights: ['KPIs de negócio, não só de produção.'],
        solutions: ['Relato de metas batidas, aprendizados e próximos passos.'],
      },
      {
        id: '7.3',
        title: 'Upsell Playbook',
        insights: ['Ofertas complementares contextualizadas funcionam melhor.'],
        solutions: ['2–3 hipóteses de upsell no fechamento de cada job.'],
      },
    ],
  },
  // --- Roadmap ---
  {
    id: '8',
    title: 'Roadmap 90 Dias (Saídas Claras)',
    icon: 'roadmap',
    kpis: ['% de saídas concluídas em 90 dias', 'Tempo médio por saída'],
    insights: ['Mês 1: Direção/Comercial; Mês 2: Operação; Mês 3: Finanças.'],
    children: [
      {
        id: '8.1',
        title: 'Mês 1 — Fundamentos',
        solutions: [
          'ICP decidido, tese publicada, pipeline ativo, proposta-padrão.',
        ],
      },
      {
        id: '8.2',
        title: 'Mês 2 — Operação',
        solutions: [
          'SOPs no Notion, projetos ativos, FTE calculada, QA rodando.',
        ],
      },
      {
        id: '8.3',
        title: 'Mês 3 — Financeiro',
        solutions: [
          'P&L, dashboard AGI/ABR/Margem, NPS em clientes entregues.',
        ],
      },
    ],
  },
  // --- Escala (Vendors) ---
  {
    id: '9',
    title: 'Escala via Terceirização (Talent Cloud & Parcerias)',
    tag: 'ESCALA',
    icon: 'scale',
    refs: [
      "Boas práticas de Vendor Management (PMI/Agile): contratos MSA/NDA/SoW, 'first article', SLAs claros e auditorias amostrais.",
    ],
    kpis: [
      'On-time delivery dos vendors (%)',
      'Aderência a SLA (%)',
      'NPS do vendor',
      'Variação de custo vs. orçamento (%)',
    ],
    insights: [
      'Cadastre 2 fornecedores por skill crítica (Rule of Two) para resiliência.',
      'First Article: valide padrão do vendor com uma peça piloto antes do volume.',
      'Exclusividade modular por cliente/vertical/região com janela temporal evita conflito.',
    ],
    examples: [
      'Tiers Bronze/Prata/Ouro com rate card e NPS do vendor.',
      'Plantão de evento com escalonamento de chamada e taxa de urgência.',
    ],
    solutions: [
      'Docs: MSA, NDA, SoW, matriz de SLAs e kit de marca; assinatura digital.',
      'Canal Slack Connect por vendor; ClickUp para tarefas; auditoria amostral 1/5.',
    ],
    children: [
      {
        id: '9.1',
        title: 'Sourcing & Onboarding de Vendors',
        insights: ["Teste 'first article' com prazos e QA definidos."],
        solutions: [
          'Cadastro com portfólio, fuso, idiomas e referências; contrato padrão.',
        ],
      },
      {
        id: '9.2',
        title: 'Exclusividade & Conflito',
        insights: [
          'Exclusividade por cliente-chave (6–12 meses) com território/categoria.',
        ],
        solutions: ['Anexo com duração e não-solicitação de talentos.'],
      },
      {
        id: '9.3',
        title: 'SLAs, Qualidade & Entrega',
        insights: ['SLA por tipo de peça; auditoria amostral 1/5.'],
        solutions: [
          'Painel de prazos, checklist de QA e rotas de escalonamento.',
        ],
      },
      {
        id: '9.4',
        title: 'Modelo de Preços & Pagamento',
        insights: ['Rate por tier/complexidade; urgência +30% a +100%.'],
        solutions: [
          'OC vinculada à SoW; pagamentos quinzenais; auditoria por entregável.',
        ],
      },
      {
        id: '9.5',
        title: 'Expansão para Outros Serviços',
        insights: ['Pacotes para Social Ads, Landing Pages, Performance.'],
        solutions: ['Replicar OS e SLAs; treinamento de vendors por playbook.'],
      },
    ],
  },
  // --- Fluxos de Projeto por Serviço (sem CRM) ---
  {
    id: '10',
    title: 'Fluxos de Projeto por Serviço (sem CRM)',
    icon: 'os',
    kpis: [
      '% de jobs on-time',
      'Rodadas de revisão por projeto',
      'Satisfação/NPS por serviço',
    ],
    insights: [
      "Cada serviço tem 'porta' (DoD) entre fases para evitar retrabalho.",
    ],
    children: [
      {
        id: '10.1',
        title: 'Branding / Identidade Visual',
        insights: [
          'Fluxo: Entrada → Diagnóstico → Proposta (3 níveis) → Kickoff → Pesquisa → Rotas criativas (2) → Iterações (até 2 rodadas) → Manual da marca → Entrega → Offboarding.',
        ],
        solutions: [
          'Templates: Brief de Branding (Google Docs), Agenda de Kickoff, Checklist de Pesquisa, Modelo de Manual (Docs).',
          'Pastas padrão no Drive: 01_Brief/02_Referências/03_Rotas/04_Aprovados/05_Entrega.',
        ],
      },
      {
        id: '10.2',
        title: 'Social Media (Always-on)',
        insights: [
          'Fluxo: Entrada → Proposta → Kickoff → Calendário mensal (Sheets) → Produção → Aprovação (WhatsApp/Docs) → Publicação → Monitoramento → Relatório quinzenal (Docs).',
        ],
        solutions: [
          'Template: Calendário editorial (Sheets) com status e donos; Guia de tom de voz (Docs).',
          'Padronize naming das peças e check de direitos autorais antes de publicar.',
        ],
      },
      {
        id: '10.3',
        title: 'Landing Page / Website Simples',
        insights: [
          'Fluxo: Entrada → Diagnóstico → Proposta → Kickoff → Wireframe (Docs/Slides) → Copy → Design → Montagem (Google Sites ou ferramenta atual) → QA → Entrega.',
        ],
        solutions: [
          'Template: Wireframe em Slides; Checklist SEO básico; Lista de assets (logos, fontes, imagens).',
          'Uso de Google Sites como solução provisória sem servidor; publicação rápida.',
        ],
      },
      {
        id: '10.4',
        title: 'Campanha de Mídia Paga (Evento)',
        insights: [
          'Fluxo: Entrada → Diagnóstico → Proposta → Kickoff → Plano de mídia (Sheets) → Criativos/KV → Configuração (contas) → Execução/otimização → Relatório final.',
        ],
        solutions: [
          'Planilha de tracking diário (Sheets) e relatório final com aprendizados.',
          'Biblioteca de criativos no Drive por campanha/data.',
        ],
      },
      {
        id: '10.5',
        title: 'Ativação de Evento',
        insights: [
          'Fluxo: Entrada → Proposta → Kickoff → Pré-produção (credenciais/prazos/logística) → Produção → Execução (plantão) → Pós (relatório/NPS).',
        ],
        solutions: [
          'Checklist por fase (pré/execução/pós), mapa do evento, contatos e plano de contingência.',
          'Pasta Drive compartilhada com cliente com versões finais e fotos.',
        ],
      },
    ],
  },
  // --- Captação & Funil (sem CRM) ---
  {
    id: '11',
    title: 'Captação & Funil (Google + WhatsApp, sem CRM)',
    icon: 'money',
    kpis: [
      'Tempo de resposta (min)',
      'Taxa de resposta a follow-up (%)',
      'Win rate por canal',
      '% de leads padronizados',
    ],
    insights: [
      'Padronize entrada via Formulário Google e organize tudo numa Planilha-mestra.',
      'Use etiquetas do WhatsApp (ou listas de transmissão) como pseudo-CRM.',
    ],
    children: [
      {
        id: '11.1',
        title: 'Entrada & Qualificação',
        insights: [
          'Canais: Form Google (embed no site quando pronto) e WhatsApp (mensagem padrão inicial).',
          'Campos mínimos: nome, e-mail, telefone, objetivo, orçamento, deadline, decisor.',
        ],
        solutions: [
          'Automação simples: Form → Planilha (Sheets) + notificação por e-mail.',
          'Criar rótulos WhatsApp: Novo, Qualificando, Proposta, Negociação, Ganho, Perdido.',
        ],
      },
      {
        id: '11.2',
        title: 'Follow-up disciplinado',
        insights: [
          'Ritmo: D+2, D+5, D+10 com mensagens curtas (valor, prova, pergunta de avanço).',
          'Use modelos no Gmail e listas de transmissão no WhatsApp.',
        ],
        solutions: [
          'Planilha de cadência com datas automáticas; destaque em amarelo quando passar do prazo.',
          'Script pronto para WhatsApp e e-mail (Docs).',
        ],
      },
      {
        id: '11.3',
        title: 'Remarketing & Reengajamento',
        insights: [
          'Mensalmente: enviar case novo e oferta específica para leads frios (até 2/trim).',
        ],
        solutions: [
          'Lista de transmissão segmentada por interesse; não spam — sempre um valor claro.',
          'Doc base de cases com antes/depois e resultados.',
        ],
      },
      {
        id: '11.4',
        title: 'Recuperação de Oportunidade',
        insights: [
          "Para 'perdido' ou 'sem resposta': última chamada com alternativa menor (Good), ou diagnóstico gratuito de 15 minutos.",
        ],
        solutions: [
          "Template de 'última chamada' (Docs) e pergunta de timing para revisitar.",
          'Registro do motivo de perda na planilha para aprender (preço, timing, fit).',
        ],
      },
      {
        id: '11.5',
        title: 'Contratação & Onboarding',
        insights: [
          'Sem e-sign: aceite por e-mail + pagamento inicial valem como confirmação prática.',
          'No onboarding, peça acessos/arquivos e confirme calendário e responsáveis.',
        ],
        solutions: [
          'Templates: Proposta/Contrato (Docs), Termo de aceite por e-mail, Pasta Drive do projeto criada no padrão.',
          'Checklist de onboarding por serviço (Docs); mensagem padrão no WhatsApp com próximos passos.',
        ],
      },
    ],
  },
  // --- Padrão de Entrada & Saída ---
  {
    id: '12',
    title: 'Padrão de Entrada & Saída (Lead/Cliente)',
    icon: 'rel',
    kpis: [
      '% entradas padronizadas',
      'Tempo de handoff (min)',
      '% projetos com offboarding completo',
    ],
    insights: [
      'Processo padrão evita perdas de informação e melhora experiência.',
    ],
    children: [
      {
        id: '12.1',
        title: 'Entrada Padrão',
        insights: [
          'Recepção: responder em até 2h úteis com mensagem padrão.',
          'Criar pasta no Drive com naming padrão; registrar lead na planilha e rotular no WhatsApp.',
        ],
        solutions: [
          'Mensagem-padrão de recepção (WhatsApp/Gmail).',
          'Planilha-mestra com status e dono; SLA de resposta em destaque.',
        ],
      },
      {
        id: '12.2',
        title: 'Saída/Offboarding Padrão',
        insights: [
          'Conferir entregáveis, revogar acessos, enviar guia de uso e solicitar NPS/caso.',
        ],
        solutions: [
          "Checklist de offboarding (Docs) + link de NPS; pasta 'Entrega Final' organizada.",
          'Registrar lições aprendidas e hipótese de upsell futuro.',
        ],
      },
    ],
  },
];

/* =========================================
   COMPONENTE DE NÓ (expandir, marcar, comentar)
   ========================================= */
function Node({
  item,
  level = 0,
  query,
  collapsedMap,
  setCollapsedMap,
  checkedMap,
  setCheckedMap,
  commentsMap,
  setCommentsMap,
}: {
  item: NodeItem;
  level?: number;
  query: string;
  collapsedMap: Record<string, boolean>;
  setCollapsedMap: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  checkedMap: Record<string, boolean>;
  setCheckedMap: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  commentsMap: Record<string, string>;
  setCommentsMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const [showComments, setShowComments] = useState(false);
  const id = item.id;
  const isCollapsed = !!collapsedMap[id];
  const hasChildren = !!item.children?.length;

  const toggle = () => setCollapsedMap((m) => ({ ...m, [id]: !m[id] }));
  const toggleCheck = () => setCheckedMap((m) => ({ ...m, [id]: !m[id] }));
  const updateComment = (text: string) =>
    setCommentsMap((m) => ({ ...m, [id]: text }));

  const matchesQuery = useMemo(() => {
    if (!query) return true;
    const q = query.toLowerCase();
    const inArr = (arr?: string[]) =>
      !!arr?.some((s) => s.toLowerCase().includes(q));
    return (
      item.title.toLowerCase().includes(q) ||
      inArr(item.kpis) ||
      inArr(item.insights) ||
      inArr(item.examples) ||
      inArr(item.solutions)
    );
  }, [query, item]);

  if (!matchesQuery) return null;

  const iconEl = item.icon ? ICONS[item.icon] : <Layers size={16} />;

  const openTaskChat = (title: string) => {
    const prompt = `Atue como PM de agência. Crie um plano de execução detalhado para: ${title}. Inclua checklists, KPIs, riscos e cronograma.`;
    const url = `https://chat.openai.com/?q=${encodeURIComponent(prompt)}`;
    window.open(url, '_blank');
  };

  return (
    <div
      className="rounded-xl border"
      style={{ background: COLOR_SURFACE, borderColor: COLOR_TITLE + '33' }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5" style={{ color: COLOR_ACCENT }}>
            {iconEl}
          </div>

        <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className="font-semibold text-lg"
                style={{ color: COLOR_TITLE }}
              >
                {renderWithGlossary(item.title)}
              </h3>
              {item.tag && (
                <Badge style={{ background: COLOR_ACCENT, color: 'white' }}>
                  {item.tag}
                </Badge>
              )}

              {item.refs?.length ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        style={{
                          background: COLOR_BG_PAGE,
                          borderColor: COLOR_TITLE + '44',
                          color: COLOR_TEXT,
                        }}
                      >
                        <Info className="h-4 w-4 mr-1" /> Fontes
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      style={{
                        background: COLOR_BG_PAGE,
                        border: `1px solid ${COLOR_TITLE}33`,
                        color: COLOR_TEXT,
                        maxWidth: 420,
                      }}
                    >
                      <div className="text-xs">
                        <div
                          className="font-semibold mb-1"
                          style={{ color: COLOR_TITLE }}
                        >
                          Referências
                        </div>
                        <ul className="list-disc pl-4 space-y-1">
                          {item.refs.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
            </div>

            {/* AÇÕES */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={toggle}
                variant="outline"
                style={{
                  background: COLOR_BG_PAGE,
                  borderColor: COLOR_ACCENT,
                  color: COLOR_ACCENT,
                }}
              >
                {isCollapsed ? (
                  <>
                    <Maximize2 className="h-4 w-4 mr-1" />
                    Expandir
                  </>
                ) : (
                  <>
                    <Minimize2 className="h-4 w-4 mr-1" />
                    Recolher
                  </>
                )}
              </Button>

              <Button
                size="sm"
                onClick={toggleCheck}
                variant="outline"
                style={{
                  background: COLOR_BG_PAGE,
                  borderColor: COLOR_TITLE + '44',
                  color: COLOR_TEXT,
                }}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />{' '}
                {checkedMap[id] ? 'Marcado' : 'Marcar'}
              </Button>

              <Button
                size="sm"
                onClick={() => setShowComments((s) => !s)}
                variant="outline"
                style={{
                  background: COLOR_BG_PAGE,
                  borderColor: COLOR_TITLE + '44',
                  color: COLOR_TEXT,
                }}
              >
                Comentários
              </Button>

              <Button
                size="sm"
                onClick={() => copyText(composeSectionText(item))}
                style={{ background: COLOR_ACCENT, color: 'white' }}
              >
                <Copy className="h-4 w-4 mr-1" /> Copiar resumo da seção
              </Button>

              <Button
                size="sm"
                onClick={() => openTaskChat(item.title)}
                style={{ background: COLOR_ACCENT, color: 'white' }}
              >
                Abrir no GPT5
              </Button>
            </div>

            {/* CONTEÚDO */}
            {!isCollapsed && (
              <>
                {(item.kpis?.length ||
                  item.insights?.length ||
                  item.examples?.length ||
                  item.solutions?.length) && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {item.kpis?.length ? (
                      <Card
                        style={{
                          background: COLOR_BG_PAGE,
                          borderColor: COLOR_TITLE + '33',
                        }}
                        className="shadow-sm"
                      >
                        <CardHeader className="py-3">
                          <CardTitle
                            className="text-sm"
                            style={{ color: COLOR_TITLE }}
                          >
                            KPIs do bloco
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <ul
                            className="list-disc pl-4 text-sm space-y-1"
                            style={{ color: COLOR_TEXT }}
                          >
                            {item.kpis.map((x, i) => (
                              <li key={i}>{renderWithGlossary(x)}</li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    ) : null}

                    {item.insights?.length ? (
                      <Card
                        style={{
                          background: COLOR_BG_PAGE,
                          borderColor: COLOR_TITLE + '33',
                        }}
                        className="shadow-sm"
                      >
                        <CardHeader className="py-3">
                          <CardTitle
                            className="text-sm"
                            style={{ color: COLOR_TITLE }}
                          >
                            Insights práticos
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <ul
                            className="list-disc pl-4 text-sm space-y-1"
                            style={{ color: COLOR_TEXT }}
                          >
                            {item.insights.map((x, i) => (
                              <li key={i}>{renderWithGlossary(x)}</li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    ) : null}

                    {item.examples?.length ? (
                      <Card
                        style={{
                          background: COLOR_BG_PAGE,
                          borderColor: COLOR_TITLE + '33',
                        }}
                        className="shadow-sm"
                      >
                        <CardHeader className="py-3">
                          <CardTitle
                            className="text-sm"
                            style={{ color: COLOR_TITLE }}
                          >
                            Exemplos
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <ul
                            className="list-disc pl-4 text-sm space-y-1"
                            style={{ color: COLOR_TEXT }}
                          >
                            {item.examples.map((x, i) => (
                              <li key={i}>{renderWithGlossary(x)}</li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    ) : null}

                    {item.solutions?.length ? (
                      <Card
                        style={{
                          background: COLOR_BG_PAGE,
                          borderColor: COLOR_TITLE + '33',
                        }}
                        className="shadow-sm"
                      >
                        <CardHeader className="py-3">
                          <CardTitle
                            className="text-sm"
                            style={{ color: COLOR_TITLE }}
                          >
                            Soluções práticas
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <ul
                            className="list-disc pl-4 text-sm space-y-1"
                            style={{ color: COLOR_TEXT }}
                          >
                            {item.solutions.map((x, i) => (
                              <li key={i}>{renderWithGlossary(x)}</li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    ) : null}
                  </div>
                )}

                {showComments && (
                  <div className="mt-3">
                    <textarea
                      value={commentsMap[id] || ''}
                      onChange={(e) => updateComment(e.target.value)}
                      placeholder="Anote decisões, riscos, pendências..."
                      className="w-full rounded-md p-3"
                      style={{
                        background: COLOR_BG_PAGE,
                        color: COLOR_TEXT,
                        border: `1px solid ${COLOR_TITLE}33`,
                      }}
                      rows={4}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {!isCollapsed && hasChildren && (
        <div
          className="ml-8 border-l pl-4 space-y-2 pb-3"
          style={{ borderColor: COLOR_TITLE + '33' }}
        >
          {item.children!.map((child) => (
            <Node
              key={child.id}
              item={child}
              level={level + 1}
              query={query}
              collapsedMap={collapsedMap}
              setCollapsedMap={setCollapsedMap}
              checkedMap={checkedMap}
              setCheckedMap={setCheckedMap}
              commentsMap={commentsMap}
              setCommentsMap={setCommentsMap}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================
   DOWNLOAD
   ========================================= */
function downloadJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* =========================================
   CÓDIGO SECRETO (3 acessos) — progresso COMPARTILHADO
   ========================================= */
// Hashes SHA-256 dos 3 códigos (os textos em claro estão abaixo no chat)
const PASSCODE_LABELS: Record<string, string> = {
  // hash -> rótulo exibido
  c012711a8cd078087d28ed1987e8201e79c9b8615064afb4a6e9e482f141eb68: 'Sócio A',
  '91bcc18f0dfaae07f602daabdcb35b52e74889f619384315a20993372c9c7787': 'Sócio B',
  '29e3354224abeafb651599f0163838b34635adaf7772ef653dc954c62eb51a70': 'Sócio C',
};

// Único documento compartilhado (mesmo progresso p/ todos)
const WS_ID = 'synth'; // workspace fixo
const STATE_DOC_PATH = ['workspaces', WS_ID, 'states', 'default'] as const;

/* =========================================
   MAIN
   ========================================= */
export default function AgencyMindMap() {
  const [query, setQuery] = useState('');

  // Gate por código (salvo em sessionStorage)
  const [access, setAccess] = useState<{ granted: boolean; label?: string }>(
    () => {
      try {
        const raw = sessionStorage.getItem('agencyos_access');
        if (!raw) return { granted: false };
        return JSON.parse(raw);
      } catch {
        return { granted: false };
      }
    }
  );

  // Estado do app
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('checkedMap') || '{}');
    } catch {
      return {};
    }
  });
  const [commentsMap, setCommentsMap] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('commentsMap') || '{}');
    } catch {
      return {};
    }
  });

  // Persistência local
  useEffect(() => {
    localStorage.setItem('checkedMap', JSON.stringify(checkedMap));
  }, [checkedMap]);
  useEffect(() => {
    localStorage.setItem('commentsMap', JSON.stringify(commentsMap));
  }, [commentsMap]);

  // Expandir/Recolher global
  const setAll = useCallback((collapsed: boolean) => {
    const map: Record<string, boolean> = {};
    const walk = (items: NodeItem[]) => {
      for (const it of items) {
        map[it.id] = collapsed;
        if (it.children) walk(it.children);
      }
    };
    walk(DATA);
    setCollapsedMap(map);
  }, []);

  // Firestore — leitura/gravação em tempo real (usa a constante definida acima)
 // 'db' e STATE_DOC_PATH não mudam em runtime; memoize uma única vez
// eslint-disable-next-line react-hooks/exhaustive-deps
const stateDoc: DocumentReference<DocumentData> | null = useMemo(
  () => (db ? doc(db, ...STATE_DOC_PATH) : null),
  []
);


  // --- LEITURA EM TEMPO REAL ---
  useEffect(() => {
    if (!access.granted || !stateDoc) return; // sem Firestore ou sem acesso -> sai

    return onSnapshot(stateDoc, (snap) => {
      const d = snap.data() || {};
      if (d.checkedMap) setCheckedMap(d.checkedMap);
      if (d.commentsMap) setCommentsMap(d.commentsMap);
    });
  }, [access.granted, stateDoc]);

  // --- GRAVAÇÃO COM DEBOUNCE ---
  useEffect(() => {
    if (!access.granted || !stateDoc) return; // sem Firestore ou sem acesso -> não grava

    const t = setTimeout(() => {
      setDoc(
        stateDoc,
        {
          checkedMap,
          commentsMap,
          updatedAt: Date.now(),
          updatedBy: 'codigo-secreto', // sem identidade pessoal
        },
        { merge: true }
      );
    }, 300);

    return () => clearTimeout(t);
  }, [checkedMap, commentsMap, access.granted, stateDoc]);

  const flat = useMemo(() => flatten(DATA), []);
  const total = flat.length;
  const completed = useMemo(
    () => Object.values(checkedMap).filter(Boolean).length,
    [checkedMap]
  );
  const pct = total ? Math.round((completed / total) * 100) : 0;

  const exportText = useMemo(() => {
    const lines: string[] = [];
    const walk = (items: NodeItem[], depth = 0) => {
      for (const it of items) {
        lines.push(`${'  '.repeat(depth)}- ${it.title}`);
        if (it.insights?.length)
          for (const s of it.insights)
            lines.push(`${'  '.repeat(depth + 1)}• Insight: ${s}`);
        if (it.examples?.length)
          for (const s of it.examples)
            lines.push(`${'  '.repeat(depth + 1)}• Exemplo: ${s}`);
        if (it.solutions?.length)
          for (const s of it.solutions)
            lines.push(`${'  '.repeat(depth + 1)}• Solução: ${s}`);
        if (it.children?.length) walk(it.children, depth + 1);
      }
    };
    walk(DATA);
    return lines.join('\n');
  }, []);

  // Dev auto-checks
  try {
    console.assert(
      Array.isArray(DATA) && DATA.length > 0,
      'DATA deve existir e conter itens'
    );
    console.assert(
      typeof exportText === 'string' && exportText.length > 0,
      'exportText deve ser string não-vazia'
    );
    const rx = new RegExp(TERMS_REGEX.source, TERMS_REGEX.flags);
    console.assert(rx.test('Nosso ABR está em alta'), "Regex deve casar 'ABR'");
    console.assert(
      !rx.test('ABRA cadabra'),
      'Regex não deve casar dentro de palavras maiores'
    );
  } catch (e) {
    console.warn('Auto-check falhou:', e);
  }

  // Prompt simples para inserir/trocar código (sem texto de exemplo)
  const askCode = async () => {
    const code = window.prompt('Digite o código de acesso:');
    if (!code) return;
    const hash = await sha256Hex(code.trim());
    const label = PASSCODE_LABELS[hash];
    if (label) {
      const next = { granted: true, label };
      setAccess(next);
      sessionStorage.setItem('agencyos_access', JSON.stringify(next));
    } else {
      alert('Código inválido.');
    }
  };

  const clearCode = () => {
    sessionStorage.removeItem('agencyos_access');
    setAccess({ granted: false });
  };

  // BLOQUEIO: se não liberou o código, só mostra a tela de acesso
  if (!access.granted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: COLOR_BG_PAGE, color: COLOR_TEXT }}
      >
        <Card
          style={{
            background: COLOR_SURFACE,
            borderColor: COLOR_TITLE + '33',
            maxWidth: 520,
            width: '100%',
          }}
        >
          <CardHeader className="pb-2">
            <CardTitle
              style={{ color: COLOR_TITLE }}
              className="flex items-center gap-2"
            >
              <Lock className="h-5 w-5" /> Acesso restrito
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm" style={{ color: COLOR_TEXT }}>
              Este painel é protegido por código. Insira o seu para visualizar e
              editar o progresso compartilhado.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={askCode}
                style={{ background: COLOR_ACCENT, color: 'white' }}
              >
                <KeyRound className="h-4 w-4 mr-1" /> Inserir código
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="p-6 min-h-screen"
      style={{ background: COLOR_BG_PAGE, color: COLOR_TEXT }}
    >
      {/* Top bar: status de acesso + ações rápidas */}
      <div className="mb-4 flex flex-col md:flex-row md:items-center gap-2 md:gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: COLOR_TITLE }}>
            Agency OS — Mind Map Operacional e Escala
          </h1>
          <p className="text-sm mt-1" style={{ color: COLOR_TEXT + 'cc' }}>
            Minimalista, interativo, com ícones, glossário e controle global de
            janelas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            style={{
              background: COLOR_BG_PAGE,
              border: `1px solid ${COLOR_TITLE}33`,
              color: COLOR_TEXT,
            }}
          >
            Acesso: {access.label || 'Liberado'}
          </Badge>

          <Button
            onClick={askCode}
            variant="outline"
            style={{
              background: COLOR_BG_PAGE,
              borderColor: COLOR_TITLE + '44',
              color: COLOR_TEXT,
            }}
          >
            Trocar código
          </Button>

          <Button
            onClick={clearCode}
            variant="outline"
            style={{
              background: COLOR_BG_PAGE,
              borderColor: COLOR_TITLE + '44',
              color: COLOR_TEXT,
            }}
          >
            Bloquear
          </Button>
        </div>
      </div>

      {/* Progresso geral */}
      <Card
        className="mb-6"
        style={{ background: COLOR_SURFACE, borderColor: COLOR_TITLE + '33' }}
      >
        <CardHeader className="py-3">
          <CardTitle className="text-sm" style={{ color: COLOR_TITLE }}>
            Progresso geral
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs mb-2" style={{ color: COLOR_TEXT }}>
            {completed}/{total} etapas concluídas ({pct}%)
          </div>
          <div
            className="w-full h-3 rounded-full"
            style={{ background: COLOR_BG_PAGE }}
          >
            <div
              className="h-3 rounded-full"
              style={{ width: `${pct}%`, background: COLOR_ACCENT }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => setAll(false)}
              variant="outline"
              style={{
                background: COLOR_BG_PAGE,
                borderColor: COLOR_TITLE + '44',
                color: COLOR_TEXT,
              }}
            >
              Expandir tudo
            </Button>
            <Button
              size="sm"
              onClick={() => setAll(true)}
              variant="outline"
              style={{
                background: COLOR_BG_PAGE,
                borderColor: COLOR_TITLE + '44',
                color: COLOR_TEXT,
              }}
            >
              Recolher tudo
            </Button>
            <Button
              size="sm"
              onClick={() =>
                downloadJSON(
                  { checkedMap, commentsMap },
                  'agencyos-progresso.json'
                )
              }
              style={{ background: COLOR_ACCENT, color: 'white' }}
            >
              Exportar progresso (.json)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Busca */}
      <Card
        className="mb-4"
        style={{ background: COLOR_SURFACE, borderColor: COLOR_TITLE + '33' }}
      >
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4" style={{ color: COLOR_ACCENT }} />
            <Input
              placeholder="Filtrar por palavra-chave (ex.: SLA, NPS, KV)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                background: COLOR_BG_PAGE,
                borderColor: COLOR_TITLE + '33',
                color: COLOR_TEXT,
              }}
            />
          </div>
          <div className="text-xs mt-2" style={{ color: COLOR_TEXT + '99' }}>
            {total} itens no mapa • Dica: copie qualquer seção para virar SOP.
          </div>
        </CardContent>
      </Card>

      {/* Árvore */}
      <div className="space-y-3">
        {DATA.map((item) => (
          <Node
            key={item.id}
            item={item}
            query={query}
            collapsedMap={collapsedMap}
            setCollapsedMap={setCollapsedMap}
            checkedMap={checkedMap}
            setCheckedMap={setCheckedMap}
            commentsMap={commentsMap}
            setCommentsMap={setCommentsMap}
          />
        ))}
      </div>

      <Separator className="my-8" style={{ background: COLOR_TITLE + '33' }} />

      {/* Como usar */}
      <Card
        style={{ background: COLOR_SURFACE, borderColor: COLOR_TITLE + '33' }}
      >
        <CardHeader>
          <CardTitle
            className="flex items-center gap-2"
            style={{ color: COLOR_TITLE }}
          >
            <Layers className="h-5 w-5" /> Como usar este mapa
          </CardTitle>
        </CardHeader>
        <CardContent
          className="text-sm space-y-2"
          style={{ color: COLOR_TEXT }}
        >
          <p>
            <strong>1) Planejar →</strong> use os insights para decidir agora
            vs. depois.
          </p>
          <p>
            <strong>2) Documentar →</strong> copie seções para SOP no Notion.
          </p>
          <p>
            <strong>3) Delegar →</strong> transforme nós em tarefas com dono e
            prazo.
          </p>
          <p>
            <strong>4) Escalar →</strong> ative o bloco{' '}
            <em>Escala via Terceirização</em> para o seu Talent Cloud.
          </p>
          <div className="flex items-center gap-2 pt-2">
            <CheckCircle2 className="h-4 w-4" style={{ color: COLOR_ACCENT }} />
            <span>
              Próximos: SOPs de Kickoff, Briefing, Aprovação e Change Request;
              planilhas de Capacidade (FTE) e P&L; matriz de SLAs.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

