/**
 * Repeated-pain detection. One post is noise; the same problem from many
 * different people is a business. This groups demand signals from the last N
 * days by text similarity (TF-IDF cosine, no ML dependency) using a simple
 * incremental "join the nearest group or start a new one" pass.
 *
 * When Claude has reviewed a post we cluster on its one-line `problem`
 * statement, which groups far better than raw post text. Embeddings are the
 * planned upgrade (docs/ROADMAP.md) once there are a few weeks of data.
 */
import type { Cluster, Signal } from '../types.ts';
import { tokenize } from '../util/text.ts';
import { finalScore } from './score.ts';

type Vec = Map<string, number>;

export interface ClusterOptions {
  similarity: number;
  minSize: number;
}

export function clusterText(s: Signal): string {
  if (s.ai?.problem) return `${s.ai.problem} ${s.ai.niche} ${s.ai.who}`;
  const title = s.title.replace(/^(Comment on: )?(Ask HN|Show HN|Tell HN):?\s*/i, '').replace(/^\[[^\]]+\]\s*/, '');
  return `${title} ${s.body.slice(0, 400)}`;
}

function tfidf(docs: string[][]): Vec[] {
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const n = docs.length;
  return docs.map((d) => {
    const tf = new Map<string, number>();
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1);
    const v: Vec = new Map();
    for (const [t, c] of tf) {
      const idf = Math.log((1 + n) / (1 + (df.get(t) ?? 0))) + 1;
      v.set(t, (c / d.length) * idf);
    }
    return v;
  });
}

function cosine(a: Vec, b: Vec): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [t, w] of a) {
    na += w * w;
    const o = b.get(t);
    if (o) dot += w * o;
  }
  for (const w of b.values()) nb += w * w;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function addInto(target: Vec, v: Vec) {
  for (const [t, w] of v) target.set(t, (target.get(t) ?? 0) + w);
}

export function clusterSignals(signals: Signal[], opts: ClusterOptions): Cluster[] {
  const demand = signals
    .filter((s) => s.kind === 'demand' && s.ai?.isRealPain !== false && (s.painScore ?? 0) >= 20)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const vecs = tfidf(demand.map((s) => tokenize(clusterText(s))));

  const groups: { centroid: Vec; members: number[] }[] = [];
  demand.forEach((_, i) => {
    if (vecs[i].size === 0) return;
    let best = -1;
    let bestSim = 0;
    groups.forEach((g, gi) => {
      const sim = cosine(vecs[i], g.centroid);
      if (sim > bestSim) {
        bestSim = sim;
        best = gi;
      }
    });
    if (best >= 0 && bestSim >= opts.similarity) {
      groups[best].members.push(i);
      addInto(groups[best].centroid, vecs[i]);
    } else {
      groups.push({ centroid: new Map(vecs[i]), members: [i] });
    }
  });

  return groups
    .filter((g) => g.members.length >= opts.minSize)
    .map((g, gi) => {
      const members = g.members.map((i) => demand[i]);
      const authors = new Set(members.map((m) => m.author ?? m.id));
      const top = [...members].sort((a, b) => finalScore(b) - finalScore(a))[0];
      const label = [...g.centroid.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([t]) => t)
        .join(' · ');
      return {
        id: `cluster-${gi}`,
        label,
        signalIds: members.map((m) => m.id),
        size: members.length,
        distinctAuthors: authors.size,
        sources: [...new Set(members.map((m) => m.source))],
        firstSeen: members[0].createdAt,
        lastSeen: members[members.length - 1].createdAt,
        top,
      };
    })
    .filter((c) => c.distinctAuthors >= 2)
    .sort((a, b) => b.distinctAuthors - a.distinctAuthors || b.lastSeen.localeCompare(a.lastSeen));
}
