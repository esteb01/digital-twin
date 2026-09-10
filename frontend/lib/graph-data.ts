export type FacetGroup = 'core' | 'career' | 'life' | 'pending';

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
  pending?: boolean;
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
    summary: 'Career digital twin of Esteban Ruiz. Ask in the chat about work, thesis, or the published notes on this graph.',
    facts: [
      'Mechatronics engineer, MSc Applied AI, based in Bilbao.',
      'The graph is a map. The chat answers from public notes only.',
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
      'Official title: Real-Time Robotic Trajectory Evaluation via Surrogate Models and Deep Latent Representations.',
    facts: [
      'Mondragon Unibertsitatea. Grade 9.1/10.',
      'Replaced the physics engine of a 7-DoF KUKA IIWA with surrogate models.',
      'R² 0.933, 17,301× faster than the simulator, PINN collision recall 94.0%.',
    ],
    links: [{ label: 'TFM_Surrogate_Robot', href: 'https://github.com/esteb01/TFM_Surrogate_Robot' }],
    askPrompt: "What is your master's thesis about?",
  },
  {
    id: 'mlops',
    name: 'MLOps',
    group: 'career',
    val: 11,
    color: '#93c5fd',
    summary: 'AI Engineer Intern at Managing Innovation Strategies: production ML on institutional web traffic.',
    facts: [
      'Random Forest over 59,000 sessions; more than 50% behaved as aggressive scanners.',
      'LSTM forecasting improved from R² −0.693 to 0.69 on 365-day multivariate prediction.',
      'MLflow, Optuna, and SHAP under confidentiality constraints.',
      'No in-browser model demo: the training data is not public.',
    ],
    askPrompt: 'What did you do in your MLOps internship?',
  },
  {
    id: 'qa',
    name: 'QA',
    group: 'career',
    val: 8,
    color: '#94a3b8',
    summary: 'Software Engineer Trainee (QA) at Getecsa. Client: Internet Brands / Nolo Legal.',
    facts: [
      'Employer was Getecsa (Monterrey). Client was Internet Brands / Nolo Legal (Los Angeles).',
      'Remote for eight months on NoloLeadgen, Nolo Sales, and Martindale Nolo.',
    ],
    askPrompt: 'Where have you worked in QA?',
  },
  {
    id: 'twin',
    name: 'This twin',
    group: 'career',
    val: 11,
    color: '#67e8f9',
    summary: 'This site: a serverless conversational twin on AWS, not the robotics thesis.',
    facts: [
      'Next.js static export on S3 + CloudFront.',
      'FastAPI on Lambda, Bedrock Nova Micro, S3 Vectors RAG, Terraform.',
      'Public repo: esteb01/digital-twin.',
    ],
    links: [{ label: 'digital-twin', href: 'https://github.com/esteb01/digital-twin' }],
    askPrompt: 'How is this digital twin built and deployed?',
  },
  {
    id: 'cooking',
    name: 'Cooking',
    group: 'life',
    val: 10,
    color: '#fbbf24',
    summary:
      'Experimental cooking: process, ingredient chemistry, and high-quality protein — not basic everyday food.',
    facts: [
      'Cures (salmon gravlax), emulsions, offal (sweetbreads, tartare).',
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
    summary: 'Competitive play on one side, indie game design on the other. MasaMadre stays private.',
    facts: [
      'Plays CS2, Valorant, and League of Legends.',
      'Interested in transcontinental latency and netcode.',
      'MasaMadre is a GDD in progress (sourdough / bakery sim). Private work — no public repo.',
      'Earlier: game developer intern at Hammerbyte Games (GambitGun, Unreal Engine 4).',
    ],
    askPrompt: 'What do you play and what are you designing?',
  },
  {
    id: 'gym',
    name: 'Gym',
    group: 'pending',
    val: 8,
    color: '#4b5d73',
    summary: 'Lifts and routine are not in the public record yet.',
    facts: [
      'A markdown of maxes, current split, reps, and weights is still unpublished.',
      'Whoop and recovery data are a separate project and are not connected here.',
    ],
    pending: true,
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
