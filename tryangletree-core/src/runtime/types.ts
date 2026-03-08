export type NodeId = string;

export type Node = string | { id: NodeId; [k: string]: any };

export type Edge =
  | [NodeId, NodeId]
  | [NodeId, string, NodeId]
  | { from: NodeId; to: NodeId; rel?: string; type?: string; data?: any; [k: string]: any };

export type WeightContract = {
  default?: number;
  nodes?: Record<string, number>;
  edges?: Record<string, number>;
  motifs?: Record<string, number>;
  ops?: Record<string, number>;
};

export type GraphContract = {
  nodes: Node[];
  edges: Edge[];
  root: NodeId | null;
  weights?: WeightContract;
  [k: string]: any;
};

export type GraphLike = GraphContract | Record<string, any> | null;

export type Registry = Record<string, (payload: any) => any>;

export type ArtifactEnvelope = {
  type: string;
  value: any;
  meta?: any;
};

export type ActionScaffold = {
  params: NodeId[];
  handlers: Record<string, any>;
  body?: string | null;
};

export type RuntimeContext = {
  graph: GraphLike;
  registry: Registry;
  env: {
    mode?: string;
    debug?: boolean;
    flags?: Record<string, boolean>;
  };
  meta?: {
    trellisName?: string;
    source?: string;
  };
};

export type RunTatResult = {
  value: any;
  artifacts: ArtifactEnvelope[];
};
