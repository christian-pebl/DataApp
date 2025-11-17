# Pro-Job Skill

This skill implements a professional workflow using parallel specialized agents to analyze complex implementation tasks.

## Workflow

1. **Launch Two Parallel Agents:**
   - **Agent 1 (Explore)**: Deep codebase exploration to understand relevant implementation patterns
   - **Agent 2 (Plan)**: Draft implementation plan based on requirements

2. **Synthesis Phase:**
   - Analyze findings from both agents
   - Create revised implementation plan
   - Generate clarification questions with multiple options
   - Provide recommendations for each option

3. **Clarification Format:**
   - Questions numbered (1, 2, 3, etc.)
   - Options labeled with letters (a, b, c, etc.)
   - User responds with: "1.a, 2.b, 3.c" format

## Instructions

When this skill is invoked, you should:

1. **Parse the user's requirement** from the conversation context
2. **Launch Agent 1** using Task tool with subagent_type="Explore" with thorough exploration level
3. **Launch Agent 2** using Task tool with subagent_type="general-purpose" to create implementation plan
4. **Wait for both agents** to complete
5. **Synthesize findings** and create:
   - Revised implementation plan incorporating codebase insights
   - Numbered clarification questions with:
     - Lettered options (a, b, c, etc.)
     - Recommendation for each option
     - Trade-offs explained
6. **Present to user** in clear format for easy response

## Output Format

```
## Implementation Plan (Draft)
[Synthesized plan from both agents]

## Clarification Questions

**Question 1: [Topic]**
- a) [Option A]
  - Trade-offs: [...]
  - Recommendation: ⭐ [Recommended/Not Recommended]
- b) [Option B]
  - Trade-offs: [...]
  - Recommendation: ⭐ [Recommended/Not Recommended]

**Question 2: [Topic]**
...

---
**To proceed, please respond with your choices in format: `1.a, 2.b, 3.a`**
```
