import { runTat } from "@tryangletree/core";

const tatSource = `
@g:
  nodes: ["A", "B", "C"]
  edges: [["A", "B"], ["B", "C"]]
  root: "A"

g := @g
g -> @wander(steps: 3)
`;

const result = runTat(tatSource);

console.log(result.value);
console.log(result.artifacts);
