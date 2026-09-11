export type FacetGroup = 'core' | 'career' | 'life';

export type FacetNode = {
  id: string;
  name: string;
  group: FacetGroup;
  val: number;
  color: string;
  summary: string;
  facts: string[];
  links?: { label: string; href: string }[];
  askPrompt?: string;
};

export type FacetLink = {
  source: string;
  target: string;
};

export const FACET_NODES: FacetNode[] = [
  {
    id: 'you',
    name: 'Ask me',
    group: 'core',
    val: 18,
    color: '#67e8f9',
    summary:
      'I am Esteban Ruiz — mechatronics engineer and MSc in Applied AI, based in Bilbao. Ask the chat anything about my work.',
    facts: [
      'I work where physical systems meet production machine learning.',
      'Open a node, or type a question on the right.',
    ],
    askPrompt: 'Give a short overview of who you are and what you work on.',
  },
  {
    id: 'thesis',
    name: 'Thesis',
    group: 'career',
    val: 12,
    color: '#7dd3fc',
    summary:
      'Master’s thesis: Real-Time Robotic Trajectory Evaluation via Surrogate Models and Deep Latent Representations.',
    facts: [
      'Mondragon Unibertsitatea. Grade 9.1/10.',
      'Surrogate models replaced the physics engine of a 7-DoF KUKA IIWA.',
      'R² 0.933, up to 17,301× faster than the simulator, PINN collision recall 94.0%.',
    ],
    links: [{ label: 'Thesis on GitHub', href: 'https://github.com/esteb01/TFM_Surrogate_Robot' }],
    askPrompt: "What is your master's thesis about?",
  },
  {
    id: 'mlops',
    name: 'MLOps',
    group: 'career',
    val: 11,
    color: '#93c5fd',
    summary:
      'AI Engineer Intern at Managing Innovation Strategies — production ML on European Commission portal traffic.',
    facts: [
      'Random Forest over 59,000 sessions; more than half behaved as aggressive scanners.',
      'LSTM forecasting went from R² −0.693 to 0.69 on a 365-day multivariate horizon.',
      'MLflow, Optuna, and SHAP. Institutional traffic, not a public dataset.',
    ],
    askPrompt: 'What did you do in your MLOps internship?',
  },
  {
    id: 'qa',
    name: 'QA',
    group: 'career',
    val: 8,
    color: '#94a3b8',
    summary:
      'Software Engineer Trainee in QA at Getecsa, on a client engagement with Internet Brands / Nolo Legal.',
    facts: [
      'Getecsa was the employer in Monterrey. Internet Brands / Nolo Legal in Los Angeles was the client.',
      'Eight months fully remote on NoloLeadgen, Nolo Sales, and Martindale Nolo.',
    ],
    askPrompt: 'Where have you worked in QA?',
  },
  {
    id: 'twin',
    name: 'This twin',
    group: 'career',
    val: 11,
    color: '#67e8f9',
    summary: 'This site answers questions about my career. It is not the robotics thesis.',
    facts: [
      'Ask about my thesis, jobs, cooking, games, or how this project is built.',
      'Serverless on AWS: Lambda, Bedrock, S3, CloudFront, and Terraform.',
    ],
    links: [{ label: 'GitHub', href: 'https://github.com/esteb01/digital-twin' }],
    askPrompt: 'How is this digital twin built and deployed?',
  },
  {
    id: 'cooking',
    name: 'Cooking',
    group: 'life',
    val: 10,
    color: '#fbbf24',
    summary:
      'I cook with a systematic, international approach — process, ingredient chemistry, and high-quality protein.',
    facts: [
      'Cures such as salmon gravlax, emulsions, and offal (sweetbreads, tartare).',
      'Convection frying (KFC-style wings) and long broths (ramen).',
      'Slow dishes: beef tongue adobo, cochinita pibil, pork tenderloin with truffles.',
    ],
    askPrompt: 'What kind of cooking do you do?',
  },
  {
    id: 'gaming',
    name: 'Gaming',
    group: 'life',
    val: 10,
    color: '#c4b5fd',
    summary: 'I play competitively, and I also design games.',
    facts: [
      'CS2, Valorant, and League of Legends. I care about latency and netcode.',
      'Game developer intern at Hammerbyte Games on GambitGun (Unreal Engine 4).',
      'I am designing a sourdough bakery game called MasaMadre.',
    ],
    askPrompt: 'What do you play and what are you designing?',
  },
  {
    id: 'gym',
    name: 'Gym',
    group: 'life',
    val: 8,
    color: '#64748b',
    summary: 'I train; the numbers are not on this site.',
    facts: ['Ask about work, thesis, cooking, or games instead.'],
  },
];

export const FACET_LINKS: FacetLink[] = [
  { source: 'you', target: 'thesis' },
  { source: 'you', target: 'mlops' },
  { source: 'you', target: 'qa' },
  { source: 'you', target: 'twin' },
  { source: 'you', target: 'cooking' },
  { source: 'you', target: 'gaming' },
  { source: 'you', target: 'gym' },
  { source: 'thesis', target: 'twin' },
  { source: 'mlops', target: 'twin' },
];

export function graphPayload() {
  return {
    nodes: FACET_NODES.map((node) => ({ ...node })),
    links: FACET_LINKS.map((link) => ({ ...link })),
  };
}

export function kindLabel(group: FacetGroup): string | null {
  if (group === 'career') return 'Work';
  if (group === 'life') return 'Life';
  return null;
}
