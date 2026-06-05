import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflowFiles = readdirSync(".github/workflows").filter(
  (file) => file.endsWith(".yml") || file.endsWith(".yaml"),
);
const deployWorkflow = readFileSync(
  ".github/workflows/vercel-deploy.yml",
  "utf8",
);

describe("GitHub Actions minute budget", () => {
  it("keeps only the post-merge deploy workflow in GitHub Actions", () => {
    expect(workflowFiles).toEqual(["vercel-deploy.yml"]);
    expect(deployWorkflow).toContain("name: Vercel Deploy");
    expect(deployWorkflow).toContain("push:");
    expect(deployWorkflow).toContain("branches:");
    expect(deployWorkflow).toContain("- main");
    expect(deployWorkflow).toContain("vercel build --prod");
    expect(deployWorkflow).toContain("vercel deploy --prebuilt --prod");

    expect(deployWorkflow).not.toContain("pull_request");
    expect(deployWorkflow).not.toContain("workflow_dispatch");
    expect(deployWorkflow).not.toContain("npm test");
    expect(deployWorkflow).not.toContain("npm --prefix mobile");
    expect(deployWorkflow).not.toContain("npm run smoke");
  });

  it("documents local verification as the pre-merge quality gate", () => {
    const agentInstructions = readFileSync("AGENTS.md", "utf8");
    const claudeInstructions = readFileSync("CLAUDE.md", "utf8");

    for (const instructions of [agentInstructions, claudeInstructions]) {
      expect(instructions).toContain(
        "GitHub Actions is reserved for post-merge production deploys only",
      );
      expect(instructions).toContain(
        "Before merging, run focused local checks plus the relevant smoke command",
      );
      expect(instructions).toContain("npm run smoke:release");
      expect(instructions).not.toContain(
        "GitHub Actions - lint + type check + test on every PR",
      );
    }
  });
});
