# Taxonomía

Taxonomía **controlada y jerárquica** ([prompt maestro](prompts/00-prompt-maestro.md) §15 y §16). La IA sugiere categorías; el catálogo manda. **La IA no crea categorías raíz** y los topics de GitHub **no se convierten automáticamente en categorías**: son otra cosa (`tags` de tipo `GITHUB_TOPIC`).

Tres capas que no se mezclan:

| Capa | Quién la escribe | Dónde vive | Para qué |
|---|---|---|---|
| **Categorías** | El catálogo de abajo, como seed. Un ADMIN podrá editarlo (roadmap) | `categories`, `repository_categories` | Navegar y filtrar. Jerárquicas |
| **Tags de IA** | El análisis, libremente | `tags` con `kind = AI` | Matices que el catálogo no tiene |
| **Topics de GitHub** | GitHub | `tags` con `kind = GITHUB_TOPIC` | Lo que el repositorio dice de sí mismo |
| **Tags de usuario** | Cada cuenta, privados | roadmap | Organización personal |

## Cómo mapea la IA

El análisis devuelve `categories` como texto libre. `packages/ai/src/taxonomy-mapper.ts` las mapea al catálogo por `slug`, por nombre exacto y por sinónimos declarados aquí; lo que no mapea se guarda como tag de IA y se cuenta en `AIUsage` como «categoría no mapeada» para revisar el catálogo. Cada `repository_categories` guarda `origin = AI` y `confidence`; un ADMIN podrá corregirla con `origin = ADMIN`, y esa gana.

## Catálogo inicial (seed)

`slug` es estable y es lo que viaja en la URL de los filtros. `path` es la jerarquía.

```text
artificial-intelligence          Artificial Intelligence
├── agents                       Agents
│   ├── agent-frameworks         Agent Frameworks
│   ├── multi-agent              Multi-Agent
│   ├── agent-orchestration      Agent Orchestration
│   ├── agent-memory             Agent Memory
│   └── agent-tools              Agent Tools
├── llm                          LLM
│   ├── inference                Inference
│   ├── rag                      RAG
│   ├── embeddings               Embeddings
│   ├── fine-tuning              Fine-tuning
│   └── evaluation               Evaluation
├── ml                           Machine Learning
│   ├── training                 Training
│   └── datasets                 Datasets
└── ai-applications              AI Applications
    ├── chat                     Chat
    ├── coding-assistants        Coding Assistants
    └── automation               Automation

media                            Media
├── image                        Image
│   ├── generation               Generation
│   ├── editing                  Editing
│   └── computer-vision          Computer Vision
├── audio                        Audio
│   ├── voice                    Voice
│   ├── speech-to-text           Speech-to-Text
│   ├── text-to-speech           Text-to-Speech
│   └── audio-editing            Audio Editing
└── video                        Video
    ├── video-generation         Generation
    └── video-editing            Editing

developer-tools                  Developer Tools
├── ide                          IDE
├── cli                          CLI
├── testing                      Testing
├── documentation                Documentation
├── code-analysis                Code Analysis
├── build                        Build
└── devops                       DevOps
    ├── ci-cd                    CI/CD
    ├── containers               Containers
    └── infrastructure-as-code   Infrastructure as Code

data                             Data
├── databases                    Databases
│   ├── relational               Relational
│   ├── vector                   Vector
│   ├── key-value                Key-Value
│   └── graph                    Graph
├── search                       Search
├── data-pipelines               Data Pipelines
└── analytics                    Analytics

web                              Web
├── frontend-frameworks          Frontend Frameworks
├── backend-frameworks           Backend Frameworks
├── ui-components                UI Components
├── cms                          CMS
└── auth                         Auth

self-hosted                      Self-hosted
├── productivity                 Productivity
├── communication                Communication
├── home                         Home
└── monitoring                   Monitoring

security                         Security
├── scanning                     Scanning
├── secrets                      Secrets
└── identity                     Identity

mobile                           Mobile
├── cross-platform               Cross-platform
├── ios                          iOS
└── android                      Android

utilities                        Utilities
└── other                        Other
```

## Sinónimos para el mapeo

| Sugerencia habitual de la IA | Categoría |
|---|---|
| `vector search`, `vector database`, `similarity search` | `data/databases/vector` |
| `agentic`, `autonomous agents` | `artificial-intelligence/agents/agent-frameworks` |
| `memory`, `long-term memory` | `artificial-intelligence/agents/agent-memory` |
| `retrieval`, `retrieval augmented generation` | `artificial-intelligence/llm/rag` |
| `stt`, `asr`, `transcription` | `media/audio/speech-to-text` |
| `tts` | `media/audio/text-to-speech` |
| `ci`, `github actions`, `pipelines` | `developer-tools/devops/ci-cd` |
| `docker`, `kubernetes` | `developer-tools/devops/containers` |
| `homelab` | `self-hosted` |

La lista crece cuando `AIUsage` acumule categorías no mapeadas. No antes.

## Lo que no se hace

- No se deja a la IA inventar categorías nuevas: van a tags.
- No se muestra `confidence` como precisión al usuario: es una valoración, no un hecho (§36).
- No se construye un panel de administración de la taxonomía en esta vertical (§78, roadmap).
